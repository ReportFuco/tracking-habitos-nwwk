"use client"

import { createContext, ReactNode, useCallback, useContext, useState } from "react"
import { AxiosError } from "axios"
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { runOnlineOnlyAction } from "@/lib/online-only"
import { queryKeys } from "@/lib/query-keys"
import { EntrenamientosAPI } from "@/modules/entrenamientos/api/entrenamientos.api"
import {
  entrenamientosMutationKeys,
  runEntrenoActivoAction,
} from "@/modules/entrenamientos/offline/entrenamientos-offline"
import {
  EntrenoFuerzaCierre,
  EntrenoFuerzaCreate,
  EntrenoFuerzaResponse,
  EntrenoFuerzaSerieResponse,
  EjerciciosParams,
  GimnasioCreate,
  GimnasioEdit,
  SerieFuerzaCreate,
  SerieFuerzaPatch,
  SerieFuerzaResponse,
} from "@/modules/entrenamientos/types/entrenamientos"

const ONE_MINUTE = 1000 * 60
const THIRTY_SECONDS = 1000 * 30
const SIX_HOURS = ONE_MINUTE * 60 * 6
const ONE_DAY = ONE_MINUTE * 60 * 24
const ONE_WEEK = ONE_DAY * 7
const persistMeta = { persist: true }

type EntrenamientosContextValue = ReturnType<typeof useEntrenamientosState>

const EntrenamientosContext = createContext<EntrenamientosContextValue | null>(null)

// Si una apertura offline quedo con sync_error (el backend ya tenia otro entreno activo,
// tipicamente desde otro dispositivo), un refetch automatico no debe pisarla: el usuario
// todavia no decidio que hacer con las series que pueda tener encoladas localmente.
const getEntrenoActivoOrNull = async ({ client }: { client: QueryClient }) => {
  const actual = client.getQueryData<EntrenoFuerzaSerieResponse | null>(
    queryKeys.entrenamientos.fuerzaActivo,
  )

  if (actual?.sync_error) {
    return actual
  }

  try {
    return await EntrenamientosAPI.getEntrenoFuerzaActivo()
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 404) {
      return null
    }
    throw err
  }
}

const useEntrenamientosState = () => {
  const queryClient = useQueryClient()
  const [gimnasiosSearch, setGimnasiosSearch] = useState<string | undefined>()
  const [ejercicioParams, setEjercicioParams] = useState<EjerciciosParams | undefined>()

  const gimnasiosQuery = useQuery({
    queryKey: queryKeys.entrenamientos.gimnasios(gimnasiosSearch),
    queryFn: () => EntrenamientosAPI.getGimnasios(gimnasiosSearch),
    staleTime: SIX_HOURS,
    gcTime: ONE_WEEK,
    meta: persistMeta,
  })
  const entrenamientosQuery = useQuery({
    queryKey: queryKeys.entrenamientos.fuerzaLista,
    queryFn: EntrenamientosAPI.getEntrenosFuerza,
    staleTime: ONE_MINUTE,
    enabled: false,
    meta: persistMeta,
  })
  // El entreno activo es el caso critico offline: se registra en el gimnasio, que es
  // justo donde suele no haber senal.
  const entrenamientoActivoQuery = useQuery({
    queryKey: queryKeys.entrenamientos.fuerzaActivo,
    queryFn: getEntrenoActivoOrNull,
    staleTime: THIRTY_SECONDS,
    refetchOnWindowFocus: false,
    // Un entreno abierto offline se sincroniza via la mutation (onSuccess/onSettled
    // invalidan esta key a proposito); un refetch automatico al reconectar podria pisar
    // un sync_error todavia sin resolver antes de que el usuario lo vea.
    refetchOnReconnect: false,
    meta: persistMeta,
  })
  const ejerciciosQuery = useQuery({
    queryKey: queryKeys.entrenamientos.ejercicios(ejercicioParams),
    queryFn: () => EntrenamientosAPI.getEjercicios(ejercicioParams),
    staleTime: ONE_DAY,
    gcTime: ONE_WEEK,
    meta: persistMeta,
    enabled: false,
  })
  const musculosQuery = useQuery({
    queryKey: queryKeys.entrenamientos.musculos,
    queryFn: EntrenamientosAPI.getMusculos,
    staleTime: ONE_DAY,
    gcTime: ONE_WEEK,
    meta: persistMeta,
    enabled: false,
  })

  const invalidate = useCallback(async (...keys: readonly (readonly unknown[])[]) => {
    await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
  }, [queryClient])

  const gimnasioCreateMutation = useMutation({
    mutationFn: EntrenamientosAPI.createGimnasio,
    onSuccess: () => invalidate(queryKeys.entrenamientos.gimnasiosRoot),
  })
  const gimnasioUpdateMutation = useMutation({
    mutationFn: ({ idGimnasio, payload }: { idGimnasio: number; payload: GimnasioEdit }) =>
      EntrenamientosAPI.updateGimnasio(idGimnasio, payload),
    onSuccess: () => invalidate(queryKeys.entrenamientos.gimnasiosRoot),
  })
  const gimnasioDeleteMutation = useMutation({
    mutationFn: EntrenamientosAPI.deleteGimnasio,
    onSuccess: () => invalidate(queryKeys.entrenamientos.gimnasiosRoot),
  })
  // Estas tres van sin mutationFn a proposito: la toman de los defaults registrados en
  // app/providers.tsx, que es lo que permite reconstruirlas al rehidratar la cola
  // offline. Ahi tambien viven su update optimista y la invalidacion.
  // Sin mutationFn inline TanStack no puede inferir el tipo de las variables, asi que se
  // declara explicito para no perder chequeo en los llamadores.
  const entrenoCreateMutation = useMutation<EntrenoFuerzaResponse, Error, EntrenoFuerzaCreate>({
    mutationKey: entrenamientosMutationKeys.entrenoCreate,
  })
  const entrenoCloseMutation = useMutation<EntrenoFuerzaResponse, Error, EntrenoFuerzaCierre>({
    mutationKey: entrenamientosMutationKeys.entrenoClose,
  })
  const serieCreateMutation = useMutation<SerieFuerzaResponse, Error, SerieFuerzaCreate>({
    mutationKey: entrenamientosMutationKeys.serieCreate,
  })
  const serieUpdateMutation = useMutation({
    mutationFn: ({
      idFuerzaDetalle,
      payload,
    }: {
      idFuerzaDetalle: number
      payload: SerieFuerzaPatch
    }) => EntrenamientosAPI.updateSerieFuerza(idFuerzaDetalle, payload),
    onSuccess: () => invalidate(queryKeys.entrenamientos.fuerzaActivo),
  })
  const serieDeleteMutation = useMutation({
    mutationFn: EntrenamientosAPI.deleteSerieFuerza,
    onSuccess: () => invalidate(queryKeys.entrenamientos.fuerzaActivo),
  })

  const fetchResumen = useCallback(() =>
    invalidate(
      queryKeys.entrenamientos.gimnasiosRoot,
      queryKeys.entrenamientos.fuerzaLista,
      queryKeys.entrenamientos.fuerzaActivo
    ), [invalidate])

  const fetchGimnasios = useCallback(async (q?: string) => {
    setGimnasiosSearch(q)
    return queryClient.fetchQuery({
      queryKey: queryKeys.entrenamientos.gimnasios(q),
      queryFn: () => EntrenamientosAPI.getGimnasios(q),
      staleTime: SIX_HOURS,
      gcTime: ONE_WEEK,
    })
  }, [queryClient])

  const fetchEjercicios = useCallback(async (params?: EjerciciosParams) => {
    setEjercicioParams(params)
    return queryClient.fetchQuery({
      queryKey: queryKeys.entrenamientos.ejercicios(params),
      queryFn: () => EntrenamientosAPI.getEjercicios(params),
      staleTime: ONE_DAY,
      gcTime: ONE_WEEK,
      meta: persistMeta,
    })
  }, [queryClient])

  const fetchMusculos = useCallback(() =>
    queryClient.fetchQuery({
      queryKey: queryKeys.entrenamientos.musculos,
      queryFn: EntrenamientosAPI.getMusculos,
      staleTime: ONE_DAY,
      gcTime: ONE_WEEK,
      meta: persistMeta,
    }), [queryClient])

  const fetchEntrenosFuerza = useCallback(() =>
    queryClient.fetchQuery({
      queryKey: queryKeys.entrenamientos.fuerzaLista,
      queryFn: EntrenamientosAPI.getEntrenosFuerza,
      staleTime: ONE_MINUTE,
    }), [queryClient])

  const fetchEntrenamientoActivo = useCallback(() =>
    queryClient.fetchQuery({
      queryKey: queryKeys.entrenamientos.fuerzaActivo,
      queryFn: getEntrenoActivoOrNull,
      staleTime: THIRTY_SECONDS,
    }), [queryClient])

  const fetchDetalleEntrenoFuerza = useCallback((idEntrenamientoFuerza: number) =>
    queryClient.fetchQuery({
      queryKey: queryKeys.entrenamientos.fuerzaDetalle(idEntrenamientoFuerza),
      queryFn: () => EntrenamientosAPI.getEntrenoFuerzaDetalle(idEntrenamientoFuerza),
      staleTime: ONE_MINUTE,
    }), [queryClient])

  const error =
    gimnasiosQuery.error ??
    entrenamientosQuery.error ??
    entrenamientoActivoQuery.error ??
    ejerciciosQuery.error ??
    musculosQuery.error ??
    null

  return {
    ejercicios: ejerciciosQuery.data ?? [],
    musculos: musculosQuery.data ?? [],
    gimnasios: gimnasiosQuery.data ?? [],
    entrenamientosFuerza: entrenamientosQuery.data ?? [],
    entrenamientoActivo: entrenamientoActivoQuery.data ?? null,
    loading:
      gimnasiosQuery.isLoading ||
      entrenamientosQuery.isLoading ||
      entrenamientoActivoQuery.isLoading ||
      ejerciciosQuery.isLoading ||
      musculosQuery.isLoading,
    submitting:
      gimnasioCreateMutation.isPending ||
      gimnasioUpdateMutation.isPending ||
      gimnasioDeleteMutation.isPending ||
      // Pausada offline: no cuenta como "enviando" o el formulario queda bloqueado hasta
      // reconectar aunque la operacion ya haya quedado confirmada en cola.
      (entrenoCreateMutation.isPending && !entrenoCreateMutation.isPaused) ||
      (entrenoCloseMutation.isPending && !entrenoCloseMutation.isPaused) ||
      (serieCreateMutation.isPending && !serieCreateMutation.isPaused) ||
      serieUpdateMutation.isPending ||
      serieDeleteMutation.isPending,
    error: error ? getFriendlyErrorMessage(error) : null,
    fetchResumen,
    fetchEjercicios,
    fetchGimnasios,
    fetchMusculos,
    fetchEntrenosFuerza,
    fetchEntrenamientoActivo,
    fetchDetalleEntrenoFuerza,
    crearGimnasio: (payload: GimnasioCreate) =>
      runOnlineOnlyAction(() => gimnasioCreateMutation.mutateAsync(payload)),
    editarGimnasio: (idGimnasio: number, payload: GimnasioEdit) =>
      runOnlineOnlyAction(() => gimnasioUpdateMutation.mutateAsync({ idGimnasio, payload })),
    eliminarGimnasio: (idGimnasio: number) =>
      runOnlineOnlyAction(() => gimnasioDeleteMutation.mutateAsync(idGimnasio)),
    iniciarEntrenoFuerza: (payload: EntrenoFuerzaCreate) =>
      runEntrenoActivoAction(entrenoCreateMutation, payload),
    // La clave se genera acá porque este es el único llamador y no arma un payload propio:
    // así el componente que confirma el cierre no cambia.
    cerrarEntrenoFuerzaActivo: () =>
      runEntrenoActivoAction(entrenoCloseMutation, { client_request_id: crypto.randomUUID() }),
    agregarSerieFuerza: (payload: SerieFuerzaCreate) =>
      runEntrenoActivoAction(serieCreateMutation, payload),
    editarSerieFuerza: (idFuerzaDetalle: number, payload: SerieFuerzaPatch) =>
      runOnlineOnlyAction(() => serieUpdateMutation.mutateAsync({ idFuerzaDetalle, payload })),
    eliminarSerieFuerza: (idFuerzaDetalle: number) =>
      runOnlineOnlyAction(() => serieDeleteMutation.mutateAsync(idFuerzaDetalle)),
  }
}

export function EntrenamientosProvider({ children }: { children: ReactNode }) {
  const value = useEntrenamientosState()

  return <EntrenamientosContext.Provider value={value}>{children}</EntrenamientosContext.Provider>
}

export const useEntrenamientos = () => {
  const context = useContext(EntrenamientosContext)

  if (!context) {
    throw new Error("useEntrenamientos debe usarse dentro de un EntrenamientosProvider")
  }

  return context
}
