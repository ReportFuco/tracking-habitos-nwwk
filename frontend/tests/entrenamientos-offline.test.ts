import { QueryClient, onlineManager } from "@tanstack/react-query"
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from "@tanstack/query-persist-client-core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Se sustituye la capa HTTP: los tests verifican la cola, no axios.
vi.mock("@/modules/entrenamientos/api/entrenamientos.api", () => ({
  EntrenamientosAPI: {
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
import { EntrenamientosAPI } from "@/modules/entrenamientos/api/entrenamientos.api"
import {
  ENTRENO_ACTIVO_SCOPE_ID,
  entrenamientosMutationKeys,
  isSeriePendiente,
  registerEntrenamientosMutationDefaults,
} from "@/modules/entrenamientos/offline/entrenamientos-offline"
import type {
  EntrenoFuerzaSerieResponse,
  SerieFuerzaCreate,
} from "@/modules/entrenamientos/types/entrenamientos"

const ONE_WEEK = 1000 * 60 * 60 * 24 * 7
const ACTIVO_KEY = queryKeys.entrenamientos.fuerzaActivo

const esperarEscritura = () => new Promise((resolve) => setTimeout(resolve, 1200))
const settle = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms))

const crearClient = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: ONE_WEEK, retry: 1 },
      mutations: { retry: 0 },
    },
  })
  registerEntrenamientosMutationDefaults(queryClient)
  return queryClient
}

const sembrarEntrenoActivo = (queryClient: QueryClient) =>
  queryClient.fetchQuery({
    queryKey: ACTIVO_KEY,
    queryFn: async (): Promise<EntrenoFuerzaSerieResponse> => ({
      id_entrenamiento_fuerza: 7,
      estado: "activo",
      inicio_at: "2026-07-28T10:00:00",
      fin_at: null,
      series: [],
    }),
    meta: { persist: true },
  })

// Dispara la mutacion por su key: los defaults registrados aportan mutationFn, scope,
// onMutate y onSettled. Es el mismo camino que usa resumePausedMutations al rehidratar.
// El rechazo se ignora aqui: quien lo maneja es el onError de los defaults. Sin el
// catch, una serie rechazada dejaria una promesa colgada que vitest reporta aparte.
const encolarSerie = (queryClient: QueryClient, variables: SerieFuerzaCreate) =>
  queryClient
    .getMutationCache()
    .build(queryClient, { mutationKey: entrenamientosMutationKeys.serieCreate })
    .execute(variables)
    .catch(() => undefined)

const serie = (repeticiones: number): SerieFuerzaCreate => ({
  id_ejercicio: 1,
  es_calentamiento: false,
  cantidad_peso: 20,
  repeticiones,
})

const seriesDe = (queryClient: QueryClient) =>
  queryClient.getQueryData<EntrenoFuerzaSerieResponse>(ACTIVO_KEY)?.series ?? []

beforeEach(() => {
  vi.mocked(EntrenamientosAPI.createSerieFuerza).mockReset()
  vi.mocked(EntrenamientosAPI.closeEntrenoFuerzaActivo).mockReset()
  onlineManager.setOnline(true)
})

afterEach(async () => {
  onlineManager.setOnline(true)
  await clearPersistedQueryCache()
})

describe("cola offline del entreno activo", () => {
  it("muestra al instante todas las series encoladas sin conexion", async () => {
    // Regresion: los onMutate corren en paralelo. Si cada uno partiera de un snapshot
    // previo se pisarian entre si y solo sobreviviria la ultima serie.
    const queryClient = crearClient()
    await sembrarEntrenoActivo(queryClient)

    onlineManager.setOnline(false)
    void encolarSerie(queryClient, serie(8))
    void encolarSerie(queryClient, serie(10))
    void encolarSerie(queryClient, serie(12))
    await settle()

    expect(seriesDe(queryClient)).toHaveLength(3)
    expect(seriesDe(queryClient).map((item) => item.repeticiones)).toEqual([8, 10, 12])
    expect(seriesDe(queryClient).every(isSeriePendiente)).toBe(true)
    expect(EntrenamientosAPI.createSerieFuerza).not.toHaveBeenCalled()
  })

  it("completa la serie encolada con el ejercicio que haya en el cache de catalogos", async () => {
    const queryClient = crearClient()
    queryClient.setQueryData(queryKeys.entrenamientos.ejercicios(), [
      {
        id_ejercicio: 1,
        nombre: "Press banca",
        id_subcategoria_musculo: null,
        url_video: null,
        id_musculo: null,
        musculo_codigo: null,
        musculo_nombre: "Pecho",
        subcategoria_codigo: null,
        subcategoria_nombre: null,
        tipo: null,
      },
    ])
    await sembrarEntrenoActivo(queryClient)

    onlineManager.setOnline(false)
    void encolarSerie(queryClient, serie(8))
    await settle()

    expect(seriesDe(queryClient)[0]?.nombre_ejercicio).toBe("Press banca")
  })

  it("sobrevive a recargar la app y reenvia en el orden original", async () => {
    const persister = createQueryPersister()
    const queryClient = crearClient()
    const unsubscribe = persistQueryClientSubscribe({
      queryClient,
      persister,
      buster: QUERY_CACHE_SCHEMA_VERSION,
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => query.meta?.persist === true,
        shouldDehydrateMutation: (mutation) =>
          mutation.options.scope?.id === ENTRENO_ACTIVO_SCOPE_ID,
      },
    })

    await sembrarEntrenoActivo(queryClient)
    onlineManager.setOnline(false)
    void encolarSerie(queryClient, serie(8))
    void encolarSerie(queryClient, serie(10))
    void encolarSerie(queryClient, serie(12))
    await esperarEscritura()
    unsubscribe()

    // Nueva pestana: se rehidrata todo desde IndexedDB.
    const recargado = crearClient()
    await persistQueryClientRestore({
      queryClient: recargado,
      persister,
      buster: QUERY_CACHE_SCHEMA_VERSION,
      maxAge: ONE_WEEK,
    })

    expect(seriesDe(recargado)).toHaveLength(3)
    expect(recargado.getMutationCache().getAll().filter((m) => m.state.isPaused)).toHaveLength(3)

    // Latencia decreciente: si el reenvio fuera en paralelo, la ultima ganaria la
    // carrera y el orden registrado saldria invertido.
    let latencia = 60
    const enviadas: number[] = []
    vi.mocked(EntrenamientosAPI.createSerieFuerza).mockImplementation(async (payload) => {
      await new Promise((resolve) => setTimeout(resolve, (latencia -= 20)))
      enviadas.push(payload.repeticiones)
      return {
        id_fuerza_detalle: payload.repeticiones,
        es_calentamiento: payload.es_calentamiento,
        cantidad_peso: payload.cantidad_peso,
        repeticiones: payload.repeticiones,
      }
    })

    onlineManager.setOnline(true)
    await recargado.resumePausedMutations()

    expect(enviadas).toEqual([8, 10, 12])
  })

  it("no persiste mutaciones de otros modulos", async () => {
    const queryClient = crearClient()
    queryClient.setMutationDefaults(["finanzas", "movimiento", "create"], {
      mutationFn: async () => ({ ok: true }),
    })

    onlineManager.setOnline(false)
    void encolarSerie(queryClient, serie(8))
    void queryClient
      .getMutationCache()
      .build(queryClient, { mutationKey: ["finanzas", "movimiento", "create"] })
      .execute(undefined)
    await settle()

    const persistidas = queryClient
      .getMutationCache()
      .getAll()
      .filter((mutation) => mutation.options.scope?.id === ENTRENO_ACTIVO_SCOPE_ID)

    expect(queryClient.getMutationCache().getAll()).toHaveLength(2)
    expect(persistidas).toHaveLength(1)
  })

  it("si el backend rechaza una serie, quita solo esa y conserva el resto", async () => {
    const queryClient = crearClient()
    await sembrarEntrenoActivo(queryClient)

    vi.mocked(EntrenamientosAPI.createSerieFuerza).mockImplementation(async (payload) => {
      if (payload.repeticiones === 10) {
        throw new Error("rechazada por el backend")
      }
      return {
        id_fuerza_detalle: payload.repeticiones,
        es_calentamiento: payload.es_calentamiento,
        cantidad_peso: payload.cantidad_peso,
        repeticiones: payload.repeticiones,
      }
    })

    onlineManager.setOnline(false)
    void encolarSerie(queryClient, serie(8))
    void encolarSerie(queryClient, serie(10))
    void encolarSerie(queryClient, serie(12))
    await settle()
    expect(seriesDe(queryClient)).toHaveLength(3)

    onlineManager.setOnline(true)
    await queryClient.resumePausedMutations()
    await settle()

    // Queda fuera la rechazada; las otras dos siguen porque el rollback es por id.
    const restantes = seriesDe(queryClient)
      .map((item) => item.repeticiones)
      .sort((a, b) => a - b)

    expect(restantes).toEqual([8, 12])
  })

  it("cerrar el entreno deja el activo vacio y se puede encolar sin conexion", async () => {
    const queryClient = crearClient()
    await sembrarEntrenoActivo(queryClient)

    onlineManager.setOnline(false)
    void queryClient
      .getMutationCache()
      .build(queryClient, { mutationKey: entrenamientosMutationKeys.entrenoClose })
      .execute(undefined)
    await settle()

    expect(queryClient.getQueryData(ACTIVO_KEY)).toBeNull()
    expect(EntrenamientosAPI.closeEntrenoFuerzaActivo).not.toHaveBeenCalled()
  })
})
