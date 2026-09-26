import { queryOptions } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { EntrenamientosAPI } from "@/modules/entrenamientos/api/entrenamientos.api"

const ONE_MINUTE = 1000 * 60

/**
 * Historico de entrenos de fuerza. `useEntrenamientos` lo monta deshabilitado y lo pide a
 * demanda; el dashboard lo consulta directo. Comparten key y politica de cache.
 */
export const entrenosFuerzaQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.entrenamientos.fuerzaLista,
    queryFn: EntrenamientosAPI.getEntrenosFuerza,
    staleTime: ONE_MINUTE,
    meta: { persist: true },
  })
