"use client"

import type { InfiniteData, QueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { FinanzasAPI } from "@/modules/finanzas/api/finanzas.api"
import type {
  CategoriaResponse,
  CuentaResponse,
  MovimientoCreate,
  MovimientoResponse,
  MovimientosPageResponse,
} from "@/modules/finanzas/types/finanzas"

/**
 * Solo las altas de movimientos se conservan en la cola offline. Editar un movimiento
 * sigue requiriendo conexión porque depende de un id real del backend.
 */
export const MOVIMIENTOS_OFFLINE_SCOPE_ID = "finanzas-movimientos-create"

export const finanzasMutationKeys = {
  movimientoCreate: ["finanzas", "movimiento", "create"] as const,
}

type MovimientosCache = InfiniteData<MovimientosPageResponse, number>

let optimisticSeq = 0
const nextOptimisticId = () => -(Date.now() + optimisticSeq++)

const getLocalDateTime = () => {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 19)
}

const isCurrentLocalMonth = (value: string) => {
  const datePart = value.slice(0, 7)
  const now = new Date()
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  return datePart === current
}

const findCatalogLabel = <T,>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  predicate: (item: T) => boolean,
  selectLabel: (item: T) => string,
) => {
  const items = queryClient.getQueryData<T[]>(queryKey)
  const match = items?.find(predicate)
  return match ? selectLabel(match) : null
}

const buildOptimisticMovimiento = (
  queryClient: QueryClient,
  payload: MovimientoCreate,
): MovimientoResponse => {
  const categoria = findCatalogLabel<CategoriaResponse>(
    queryClient,
    queryKeys.finanzas.categorias,
    (item) => item.id_categoria === payload.id_categoria,
    (item) => item.nombre,
  )
  const cuenta = findCatalogLabel<CuentaResponse>(
    queryClient,
    queryKeys.finanzas.cuentas,
    (item) => item.id_cuenta === payload.id_cuenta,
    (item) => item.nombre_cuenta,
  )

  return {
    id_transaccion: nextOptimisticId(),
    client_request_id: payload.client_request_id ?? null,
    tipo_movimiento: payload.tipo_movimiento,
    tipo_gasto: payload.tipo_gasto,
    categoria,
    nombre_cuenta: cuenta,
    compras_vinculadas: [],
    monto: payload.monto,
    descripcion: payload.descripcion ?? null,
    en_lugar_compra: payload.en_lugar_compra ?? false,
    latitud: payload.latitud ?? null,
    longitud: payload.longitud ?? null,
    precision_ubicacion: payload.precision_ubicacion ?? null,
    created_at: payload.created_at ?? getLocalDateTime(),
    pendiente_sincronizacion: true,
  }
}

const updateMonthlyTotal = (
  page: MovimientosPageResponse,
  movimiento: MovimientoResponse,
  direction: 1 | -1,
) => {
  if (
    movimiento.tipo_movimiento !== "gasto" ||
    !isCurrentLocalMonth(movimiento.created_at)
  ) {
    return page.total_gasto_mensual
  }

  return Math.max(0, page.total_gasto_mensual + movimiento.monto * direction)
}

export const isMovimientoPendiente = (
  movimiento: Pick<MovimientoResponse, "pendiente_sincronizacion" | "id_transaccion">,
) => movimiento.pendiente_sincronizacion === true || movimiento.id_transaccion < 0

export const registerFinanzasMutationDefaults = (queryClient: QueryClient) => {
  const movimientosKey = queryKeys.finanzas.movimientos

  queryClient.setMutationDefaults(finanzasMutationKeys.movimientoCreate, {
    mutationFn: (payload: MovimientoCreate) => FinanzasAPI.createMovimiento(payload),
    scope: { id: MOVIMIENTOS_OFFLINE_SCOPE_ID },
    retry: 3,
    onMutate: async (payload: MovimientoCreate) => {
      await queryClient.cancelQueries({ queryKey: movimientosKey })
      const optimistic = buildOptimisticMovimiento(queryClient, payload)

      queryClient.setQueryData<MovimientosCache>(movimientosKey, (current) => {
        if (!current?.pages.length) {
          return current
        }

        return {
          ...current,
          pages: current.pages.map((page, index) => ({
            ...page,
            items: index === 0 ? [optimistic, ...page.items] : page.items,
            total_gasto_mensual: updateMonthlyTotal(page, optimistic, 1),
          })),
        }
      })
    },
    onSuccess: (created, payload) => {
      queryClient.setQueryData<MovimientosCache>(movimientosKey, (current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.client_request_id === payload.client_request_id ? created : item,
            ),
          })),
        }
      })
    },
    onError: (_error, payload) => {
      queryClient.setQueryData<MovimientosCache>(movimientosKey, (current) => {
        if (!current) {
          return current
        }

        const optimistic = current.pages
          .flatMap((page) => page.items)
          .find((item) => item.client_request_id === payload.client_request_id)

        if (!optimistic) {
          return current
        }

        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            items: page.items.filter(
              (item) => item.client_request_id !== payload.client_request_id,
            ),
            total_gasto_mensual: updateMonthlyTotal(page, optimistic, -1),
          })),
        }
      })
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: movimientosKey }),
        queryClient.invalidateQueries({ queryKey: queryKeys.finanzas.analitica }),
      ])
    },
  })
}
