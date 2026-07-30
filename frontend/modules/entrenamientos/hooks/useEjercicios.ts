"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { EntrenamientosAPI } from "@/modules/entrenamientos/api/entrenamientos.api"
import type {
  EjercicioCreate,
  EjercicioEdit,
  EjerciciosParams,
} from "@/modules/entrenamientos/types/entrenamientos"

const ONE_MINUTE = 1000 * 60
const ONE_DAY = ONE_MINUTE * 60 * 24
const ONE_WEEK = ONE_DAY * 7

// El catalogo es de los datos mas utiles sin conexion: en el gimnasio se consulta para
// ver como se hace un ejercicio, y ahi es justo donde suele no haber senal.
const persistMeta = { persist: true }

/**
 * Catalogo de ejercicios.
 *
 * Los filtros viajan en la queryKey para que cada combinacion tenga su propia entrada de
 * cache y volver a un filtro ya visto sea instantaneo y funcione offline.
 */
export const useEjerciciosCatalogo = (params: EjerciciosParams) => {
  const query = useQuery({
    queryKey: queryKeys.entrenamientos.ejercicios(params),
    queryFn: () => EntrenamientosAPI.getEjercicios(params),
    staleTime: ONE_DAY,
    gcTime: ONE_WEEK,
    meta: persistMeta,
    // Mantiene en pantalla el resultado anterior mientras llega el nuevo, para que al
    // escribir en el buscador la lista no parpadee a vacio en cada tecla.
    placeholderData: (anterior) => anterior,
  })

  return {
    ejercicios: query.data ?? [],
    cargando: query.isLoading,
    refrescando: query.isFetching && !query.isLoading,
    error: query.error,
  }
}

export const useMusculosCatalogo = () => {
  const query = useQuery({
    queryKey: queryKeys.entrenamientos.musculos,
    queryFn: EntrenamientosAPI.getMusculos,
    staleTime: ONE_DAY,
    gcTime: ONE_WEEK,
    meta: persistMeta,
  })

  return query.data ?? []
}

export const useEquipamientos = () => {
  const query = useQuery({
    queryKey: queryKeys.entrenamientos.equipamientos,
    queryFn: EntrenamientosAPI.getEquipamientos,
    staleTime: ONE_DAY,
    gcTime: ONE_WEEK,
    meta: persistMeta,
  })

  return query.data ?? []
}

/**
 * Alta, edicion y borrado del catalogo.
 *
 * Se invalida el arbol completo de ejercicios y no una clave puntual: el mismo ejercicio
 * aparece en tantas entradas de cache como combinaciones de filtros se hayan visitado.
 */
export const useEjerciciosMutations = () => {
  const queryClient = useQueryClient()

  const invalidar = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.entrenamientos.ejerciciosRoot })

  const crear = useMutation({
    mutationFn: (payload: EjercicioCreate) => EntrenamientosAPI.createEjercicio(payload),
    onSuccess: invalidar,
  })

  const editar = useMutation({
    mutationFn: ({ idEjercicio, payload }: { idEjercicio: number; payload: EjercicioEdit }) =>
      EntrenamientosAPI.updateEjercicio(idEjercicio, payload),
    onSuccess: invalidar,
  })

  const eliminar = useMutation({
    mutationFn: (idEjercicio: number) => EntrenamientosAPI.deleteEjercicio(idEjercicio),
    onSuccess: invalidar,
  })

  return {
    crear,
    editar,
    eliminar,
    guardando: crear.isPending || editar.isPending || eliminar.isPending,
  }
}
