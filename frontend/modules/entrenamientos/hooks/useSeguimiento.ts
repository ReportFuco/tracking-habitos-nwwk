"use client"

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { SeguimientoAPI, type ModoCarga } from "@/modules/entrenamientos/api/seguimiento.api"

const ONE_MINUTE = 1000 * 60

/**
 * Carga por zona muscular. Se persiste para verla sin senal en el gimnasio; el staleTime
 * corto la pone al dia apenas se vuelve a la pantalla tras registrar series.
 */
export const useCargaMuscular = (modo: ModoCarga, fecha?: string) => {
  const query = useQuery({
    queryKey: queryKeys.entrenamientos.cargaMuscular(modo, modo === "semana" ? fecha : undefined),
    queryFn: () => SeguimientoAPI.getCargaMuscular(modo, fecha),
    staleTime: ONE_MINUTE,
    // Al cambiar de semana el mapa no parpadea en blanco: queda la anterior hasta que llega.
    placeholderData: keepPreviousData,
    meta: { persist: true },
  })

  return {
    carga: query.data ?? null,
    cargando: query.isLoading,
    refrescando: query.isFetching && !query.isLoading,
    error: query.error,
  }
}

export const useSeguimientos = () => {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.entrenamientos.seguimientos,
    queryFn: SeguimientoAPI.getSeguimientos,
    staleTime: ONE_MINUTE,
    meta: { persist: true },
  })

  const eliminar = useMutation({
    mutationFn: SeguimientoAPI.eliminarSeguimiento,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.entrenamientos.seguimientos }),
  })

  return {
    seguimientos: query.data ?? [],
    cargando: query.isLoading,
    error: query.error,
    eliminar: eliminar.mutateAsync,
    eliminando: eliminar.isPending ? eliminar.variables : null,
  }
}
