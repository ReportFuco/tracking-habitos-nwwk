"use client"

import type { QueryClient, UseMutationResult } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { isAppOffline, runOnlineOnlyAction } from "@/lib/online-only"
import { EntrenamientosAPI } from "@/modules/entrenamientos/api/entrenamientos.api"
import type {
  EjercicioResponse,
  EntrenoFuerzaSerieResponse,
  SerieFuerzaCreate,
  SerieFuerzaResponse,
} from "@/modules/entrenamientos/types/entrenamientos"

/**
 * Cola offline del entreno activo.
 *
 * Solo se encolan las acciones que se hacen en el gimnasio, que es donde falta senal:
 * registrar una serie y cerrar el entreno. Editar o borrar una serie NO se encola a
 * proposito, porque necesitan el id que asigna el backend y una serie creada sin
 * conexion todavia no lo tiene.
 *
 * Las mutaciones comparten scope para que TanStack las reenvie de a una y en orden
 * (MutationCache.canRun solo deja correr la primera pendiente del scope). Una rutina es
 * una secuencia: si las series se mandaran en paralelo llegarian desordenadas.
 */
export const ENTRENO_ACTIVO_SCOPE_ID = "entrenamientos-entreno-activo"

export const entrenamientosMutationKeys = {
  serieCreate: ["entrenamientos", "serie", "create"] as const,
  entrenoClose: ["entrenamientos", "entreno", "close"] as const,
}

type ActivoCache = EntrenoFuerzaSerieResponse | null | undefined
type SerieContext = { optimisticId: number }
type CierreContext = { previous: ActivoCache }

// Id temporal para la serie que todavia no viajo al backend. Negativo para no chocar
// nunca con un id real y monotono decreciente, asi no se repite entre recargas.
let optimisticSeq = 0
const nextOptimisticId = () => -(Date.now() + optimisticSeq++)

/** Una serie con id negativo esta encolada, todavia no confirmada por el backend. */
export const isSeriePendiente = (serie: Pick<SerieFuerzaResponse, "id_fuerza_detalle">) =>
  serie.id_fuerza_detalle < 0

// El nombre del ejercicio se busca en el cache de catalogos, que tambien se persiste, de
// modo que la serie encolada se ve completa sin conexion en vez de aparecer en blanco.
const findEjercicio = (queryClient: QueryClient, idEjercicio: number) => {
  const entries = queryClient.getQueriesData<EjercicioResponse[]>({
    queryKey: queryKeys.entrenamientos.ejerciciosRoot,
  })

  for (const [, ejercicios] of entries) {
    const match = ejercicios?.find((item) => item.id_ejercicio === idEjercicio)

    if (match) {
      return match
    }
  }

  return null
}

const buildSerieOptimista = (
  queryClient: QueryClient,
  variables: SerieFuerzaCreate,
): SerieFuerzaResponse => {
  const ejercicio = findEjercicio(queryClient, variables.id_ejercicio)

  return {
    id_fuerza_detalle: nextOptimisticId(),
    es_calentamiento: variables.es_calentamiento,
    cantidad_peso: variables.cantidad_peso,
    repeticiones: variables.repeticiones,
    id_ejercicio: variables.id_ejercicio,
    nombre_ejercicio: ejercicio?.nombre ?? null,
    tipo_ejercicio: ejercicio?.musculo_nombre ?? null,
    subcategoria_ejercicio: ejercicio?.subcategoria_nombre ?? null,
    url_video: ejercicio?.url_video ?? null,
    url_imagen: ejercicio?.url_imagen ?? null,
    url_animacion: ejercicio?.url_animacion ?? null,
  }
}

export const registerEntrenamientosMutationDefaults = (queryClient: QueryClient) => {
  const activoKey = queryKeys.entrenamientos.fuerzaActivo

  const invalidateEntreno = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: activoKey }),
      queryClient.invalidateQueries({ queryKey: queryKeys.entrenamientos.fuerzaLista }),
    ])
  }

  queryClient.setMutationDefaults(entrenamientosMutationKeys.serieCreate, {
    mutationFn: (variables: SerieFuerzaCreate) => EntrenamientosAPI.createSerieFuerza(variables),
    scope: { id: ENTRENO_ACTIVO_SCOPE_ID },
    onMutate: async (variables: SerieFuerzaCreate) => {
      // Se cancela cualquier refetch en curso para que no pise el update optimista.
      await queryClient.cancelQueries({ queryKey: activoKey })

      const serie = buildSerieOptimista(queryClient, variables)

      // Actualizacion funcional, no sobre un snapshot: al encolar varias series seguidas
      // los onMutate corren en paralelo, y leyendo una copia previa cada uno pisaria al
      // anterior y solo sobreviviria la ultima serie.
      queryClient.setQueryData<ActivoCache>(activoKey, (current) =>
        current ? { ...current, series: [...(current.series ?? []), serie] } : current,
      )

      return { optimisticId: serie.id_fuerza_detalle }
    },
    // Se quita solo la serie que fallo, en vez de restaurar un snapshot completo: las
    // otras series de la cola siguen pendientes y no hay que descartarlas.
    onError: (_error, _variables, context) => {
      const optimisticId = (context as SerieContext | undefined)?.optimisticId

      if (optimisticId === undefined) {
        return
      }

      queryClient.setQueryData<ActivoCache>(activoKey, (current) =>
        current
          ? {
              ...current,
              series: (current.series ?? []).filter(
                (item) => item.id_fuerza_detalle !== optimisticId,
              ),
            }
          : current,
      )
    },
    onSettled: invalidateEntreno,
  })

  queryClient.setMutationDefaults(entrenamientosMutationKeys.entrenoClose, {
    mutationFn: () => EntrenamientosAPI.closeEntrenoFuerzaActivo(),
    scope: { id: ENTRENO_ACTIVO_SCOPE_ID },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: activoKey })
      const previous = queryClient.getQueryData<ActivoCache>(activoKey)
      // Cerrar equivale a quedarse sin entreno activo: es lo que devuelve el backend
      // (404 -> null) una vez que la peticion sale.
      queryClient.setQueryData<ActivoCache>(activoKey, null)
      return { previous }
    },
    onError: (_error, _variables, context) => {
      const previous = (context as CierreContext | undefined)?.previous

      // Tras recargar la pagina la mutacion se rehidrata sin el contexto de onMutate; en
      // ese caso no hay nada que restaurar y el onSettled resincroniza con el backend.
      if (previous !== undefined) {
        queryClient.setQueryData<ActivoCache>(activoKey, previous)
      }
    },
    onSettled: invalidateEntreno,
  })
}

export type QueueableActionResult = Promise<
  { ok: true; queued?: boolean } | { ok: false; message: string }
>

/**
 * Ejecuta serieCreate/entrenoClose sin bloquear la UI offline.
 *
 * Ambas mutations comparten scope (ENTRENO_ACTIVO_SCOPE_ID), asi que TanStack ya las
 * reenvia de a una y en el orden en que se encolaron; lo unico que faltaba era no
 * esperar mutateAsync cuando no hay red, porque con networkMode "online" esa promesa
 * no resuelve hasta reconectar y deja el formulario en isPending para siempre.
 */
export const runEntrenoActivoAction = async <TData, TVariables>(
  mutation: Pick<UseMutationResult<TData, Error, TVariables>, "mutate" | "mutateAsync">,
  variables: TVariables,
): QueueableActionResult => {
  if (isAppOffline()) {
    mutation.mutate(variables)
    return { ok: true, queued: true }
  }

  return runOnlineOnlyAction(() => mutation.mutateAsync(variables))
}
