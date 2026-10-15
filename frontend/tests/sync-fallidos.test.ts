import { QueryClient } from "@tanstack/react-query"
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from "@tanstack/query-persist-client-core"
import { AxiosError, AxiosHeaders } from "axios"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/modules/entrenamientos/api/entrenamientos.api", () => ({
  EntrenamientosAPI: {
    createEntrenoFuerza: vi.fn(),
    createSerieFuerza: vi.fn(),
    closeEntrenoFuerzaActivo: vi.fn(),
  },
}))

import { queryKeys } from "@/lib/query-keys"
import {
  QUERY_CACHE_SCHEMA_VERSION,
  clearPersistedQueryCache,
  createQueryPersister,
} from "@/lib/query-persistence"
import {
  FALLIDOS_KEY,
  esErrorTransitorio,
  reintentoCola,
  registerFallidosDefaults,
  type Fallido,
} from "@/lib/sync-fallidos"
import { EntrenamientosAPI } from "@/modules/entrenamientos/api/entrenamientos.api"
import {
  entrenamientosMutationKeys,
  registerEntrenamientosMutationDefaults,
} from "@/modules/entrenamientos/offline/entrenamientos-offline"
import type {
  EntrenoFuerzaSerieResponse,
  SerieFuerzaCreate,
} from "@/modules/entrenamientos/types/entrenamientos"

const ONE_WEEK = 1000 * 60 * 60 * 24 * 7
const esperarEscritura = () => new Promise((resolve) => setTimeout(resolve, 1200))

const errorHttp = (status?: number) =>
  new AxiosError(
    "fallo",
    status === undefined ? "ERR_NETWORK" : "ERR_BAD_RESPONSE",
    undefined,
    undefined,
    status === undefined
      ? undefined
      : { status, statusText: "", headers: {}, config: { headers: new AxiosHeaders() }, data: {} },
  )

const crearClient = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: ONE_WEEK }, mutations: { retry: 0 } },
  })
  registerEntrenamientosMutationDefaults(queryClient)
  registerFallidosDefaults(queryClient)
  return queryClient
}

const sembrarEntreno = (queryClient: QueryClient) =>
  queryClient.setQueryData<EntrenoFuerzaSerieResponse>(queryKeys.entrenamientos.fuerzaActivo, {
    id_entrenamiento_fuerza: 7,
    estado: "activo",
    inicio_at: "2026-10-15T10:00:00",
    fin_at: null,
    series: [],
  })

const enviarSerie = (queryClient: QueryClient, variables: SerieFuerzaCreate) =>
  queryClient
    .getMutationCache()
    .build(queryClient, { mutationKey: entrenamientosMutationKeys.serieCreate })
    .execute(variables)
    .catch(() => undefined)

const serie: SerieFuerzaCreate = {
  id_ejercicio: 1,
  es_calentamiento: false,
  cantidad_peso: 80,
  repeticiones: 6,
  client_request_id: "serie-1",
}

const fallidos = (queryClient: QueryClient) =>
  queryClient.getQueryData<Fallido[]>(FALLIDOS_KEY) ?? []

beforeEach(() => {
  vi.mocked(EntrenamientosAPI.createSerieFuerza).mockReset()
})

afterEach(async () => {
  await clearPersistedQueryCache()
})

describe("reintentos de la cola", () => {
  it("solo reintenta errores de red o del servidor", () => {
    expect(esErrorTransitorio(errorHttp())).toBe(true)
    expect(esErrorTransitorio(errorHttp(502))).toBe(true)
    expect(esErrorTransitorio(errorHttp(429))).toBe(true)
    expect(esErrorTransitorio(errorHttp(404))).toBe(false)
    expect(esErrorTransitorio(errorHttp(422))).toBe(false)
    expect(esErrorTransitorio(new Error("otra cosa"))).toBe(false)
  })

  it("corta despues de cuatro reintentos y espera cada vez mas", () => {
    expect(reintentoCola.retry(3, errorHttp())).toBe(true)
    expect(reintentoCola.retry(4, errorHttp())).toBe(false)
    expect(reintentoCola.retry(0, errorHttp(422))).toBe(false)
    expect([0, 1, 2, 3].map(reintentoCola.retryDelay)).toEqual([1000, 2000, 4000, 8000])
  })
})

describe("bandeja de no sincronizados", () => {
  it("una serie rechazada sale de la sesion pero queda en la bandeja", async () => {
    const queryClient = crearClient()
    sembrarEntreno(queryClient)
    vi.mocked(EntrenamientosAPI.createSerieFuerza).mockRejectedValue(errorHttp(404))

    await enviarSerie(queryClient, serie)

    expect(
      queryClient.getQueryData<EntrenoFuerzaSerieResponse>(queryKeys.entrenamientos.fuerzaActivo)
        ?.series,
    ).toEqual([])
    expect(fallidos(queryClient)).toMatchObject([
      { id: "serie-1", tipo: "serie", payload: serie, descripcion: "Serie · 80 kg × 6" },
    ])
  })

  it("reintentarla con exito la saca de la bandeja", async () => {
    const queryClient = crearClient()
    sembrarEntreno(queryClient)
    vi.mocked(EntrenamientosAPI.createSerieFuerza).mockRejectedValueOnce(errorHttp(404))
    await enviarSerie(queryClient, serie)

    vi.mocked(EntrenamientosAPI.createSerieFuerza).mockResolvedValueOnce({
      id_fuerza_detalle: 50,
      es_calentamiento: false,
      cantidad_peso: 80,
      repeticiones: 6,
      id_ejercicio: 1,
    })
    await enviarSerie(queryClient, serie)

    expect(fallidos(queryClient)).toEqual([])
  })

  it("sobrevive a una recarga de la app", async () => {
    const persister = createQueryPersister()
    const opciones = {
      persister,
      maxAge: ONE_WEEK,
      buster: QUERY_CACHE_SCHEMA_VERSION,
      dehydrateOptions: {
        shouldDehydrateQuery: (query: { meta?: Record<string, unknown> }) =>
          query.meta?.persist === true,
      },
    }

    const antes = crearClient()
    const desuscribir = persistQueryClientSubscribe({ ...opciones, queryClient: antes })
    sembrarEntreno(antes)
    vi.mocked(EntrenamientosAPI.createSerieFuerza).mockRejectedValue(errorHttp(404))
    await enviarSerie(antes, serie)
    await esperarEscritura()
    desuscribir()

    const despues = crearClient()
    await persistQueryClientRestore({ ...opciones, queryClient: despues })

    expect(fallidos(despues).map((item) => item.id)).toEqual(["serie-1"])
  })
})
