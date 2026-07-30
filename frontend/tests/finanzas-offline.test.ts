import { QueryClient, onlineManager, type InfiniteData } from "@tanstack/react-query"
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from "@tanstack/query-persist-client-core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/modules/finanzas/api/finanzas.api", () => ({
  FinanzasAPI: {
    createMovimiento: vi.fn(),
  },
}))

import { queryKeys } from "@/lib/query-keys"
import {
  QUERY_CACHE_SCHEMA_VERSION,
  clearPersistedQueryCache,
  createQueryPersister,
} from "@/lib/query-persistence"
import { FinanzasAPI } from "@/modules/finanzas/api/finanzas.api"
import {
  MOVIMIENTOS_OFFLINE_SCOPE_ID,
  finanzasMutationKeys,
  isMovimientoPendiente,
  registerFinanzasMutationDefaults,
} from "@/modules/finanzas/offline/movimientos-offline"
import type {
  MovimientoCreate,
  MovimientosPageResponse,
} from "@/modules/finanzas/types/finanzas"

const ONE_WEEK = 1000 * 60 * 60 * 24 * 7
const esperarEscritura = () => new Promise((resolve) => setTimeout(resolve, 1200))
const settle = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms))

const crearClient = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: ONE_WEEK, retry: 0 },
      mutations: { retry: 0 },
    },
  })
  registerFinanzasMutationDefaults(client)
  return client
}

const payload = (requestId: string, monto = 12500): MovimientoCreate => ({
  client_request_id: requestId,
  id_categoria: 3,
  id_cuenta: 7,
  tipo_movimiento: "gasto",
  tipo_gasto: "variable",
  monto,
  descripcion: "Compra presencial",
  en_lugar_compra: true,
  latitud: -33.456,
  longitud: -70.648,
  precision_ubicacion: 8.5,
  created_at: "2026-07-30T17:00:00",
})

const seedCache = async (client: QueryClient) => {
  client.setQueryData(queryKeys.finanzas.categorias, [
    { id_categoria: 3, nombre: "Comida", created_at: "2026-01-01T00:00:00" },
  ])
  client.setQueryData(queryKeys.finanzas.cuentas, [
    { id_cuenta: 7, nombre_cuenta: "Débito", created_at: "2026-01-01T00:00:00" },
  ])
  await client.fetchInfiniteQuery({
    queryKey: queryKeys.finanzas.movimientos,
    queryFn: async (): Promise<MovimientosPageResponse> => ({
      items: [],
      offset: 0,
      limit: 20,
      total_gasto_mensual: 0,
    }),
    initialPageParam: 0,
    getNextPageParam: () => undefined,
    meta: { persist: true },
  })
}

const encolar = (client: QueryClient, variables: MovimientoCreate) =>
  client
    .getMutationCache()
    .build(client, { mutationKey: finanzasMutationKeys.movimientoCreate })
    .execute(variables)
    .catch(() => undefined)

const movimientosDe = (client: QueryClient) =>
  client.getQueryData<InfiniteData<MovimientosPageResponse, number>>(
    queryKeys.finanzas.movimientos,
  )?.pages.flatMap((page) => page.items) ?? []

beforeEach(() => {
  vi.mocked(FinanzasAPI.createMovimiento).mockReset()
  onlineManager.setOnline(true)
})

afterEach(async () => {
  onlineManager.setOnline(true)
  await clearPersistedQueryCache()
})

describe("cola offline de movimientos financieros", () => {
  it("muestra el gasto con su ubicacion y lo deja pendiente sin conexion", async () => {
    const client = crearClient()
    await seedCache(client)

    onlineManager.setOnline(false)
    void encolar(client, payload("11111111-1111-4111-8111-111111111111"))
    await settle()

    const [optimistic] = movimientosDe(client)
    expect(optimistic.categoria).toBe("Comida")
    expect(optimistic.nombre_cuenta).toBe("Débito")
    expect(optimistic.en_lugar_compra).toBe(true)
    expect(optimistic.latitud).toBe(-33.456)
    expect(isMovimientoPendiente(optimistic)).toBe(true)
    expect(FinanzasAPI.createMovimiento).not.toHaveBeenCalled()
  })

  it("sobrevive a una recarga y sincroniza una sola vez con el mismo UUID", async () => {
    const persister = createQueryPersister()
    const client = crearClient()
    const unsubscribe = persistQueryClientSubscribe({
      queryClient: client,
      persister,
      buster: QUERY_CACHE_SCHEMA_VERSION,
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => query.meta?.persist === true,
        shouldDehydrateMutation: (mutation) =>
          mutation.options.scope?.id === MOVIMIENTOS_OFFLINE_SCOPE_ID,
      },
    })
    await seedCache(client)

    const variables = payload("22222222-2222-4222-8222-222222222222")
    onlineManager.setOnline(false)
    void encolar(client, variables)
    await esperarEscritura()
    unsubscribe()

    const recargado = crearClient()
    await persistQueryClientRestore({
      queryClient: recargado,
      persister,
      buster: QUERY_CACHE_SCHEMA_VERSION,
      maxAge: ONE_WEEK,
    })

    expect(movimientosDe(recargado)).toHaveLength(1)
    expect(
      recargado.getMutationCache().getAll().filter((mutation) => mutation.state.isPaused),
    ).toHaveLength(1)

    vi.mocked(FinanzasAPI.createMovimiento).mockResolvedValue({
      id_transaccion: 99,
      client_request_id: variables.client_request_id,
      tipo_movimiento: variables.tipo_movimiento,
      tipo_gasto: variables.tipo_gasto,
      categoria: "Comida",
      nombre_cuenta: "Débito",
      monto: variables.monto,
      descripcion: variables.descripcion ?? null,
      en_lugar_compra: true,
      latitud: variables.latitud,
      longitud: variables.longitud,
      precision_ubicacion: variables.precision_ubicacion,
      created_at: variables.created_at!,
    })

    onlineManager.setOnline(true)
    await recargado.resumePausedMutations()

    expect(FinanzasAPI.createMovimiento).toHaveBeenCalledTimes(1)
    expect(FinanzasAPI.createMovimiento).toHaveBeenCalledWith(variables)
    expect(movimientosDe(recargado)[0]?.id_transaccion).toBe(99)
  })
})
