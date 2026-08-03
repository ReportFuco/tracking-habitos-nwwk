import { queryOptions } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { ComprasAPI } from "@/modules/compras/api/compras.api"

const ONE_DAY = 1000 * 60 * 60 * 24
const ONE_WEEK = ONE_DAY * 7

/**
 * Fuente unica de las opciones de `compras.cadenas`.
 *
 * `useCompras` y `CadenasManager` consultan la misma key; sin esta factory cada uno la
 * definia con su propio `staleTime`/`gcTime`/`meta`, y la ultima pantalla en montar le
 * pisaba la politica de cache (y de persistencia) a la otra.
 */
export const cadenasQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.compras.cadenas,
    queryFn: ComprasAPI.getCadenas,
    staleTime: ONE_DAY,
    gcTime: ONE_WEEK,
    meta: { persist: true },
  })
