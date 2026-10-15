"use client"

import { isAxiosError } from "axios"
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { getFriendlyErrorMessage } from "@/lib/error-messages"

/**
 * Reintentos y bandeja de lo que no se pudo sincronizar desde la cola offline.
 *
 * La cola reenvia al recuperar la senal, pero en el gimnasio "hay senal" muchas veces
 * significa una conexion que se cae a mitad de camino. Sin reintentos el primer envio que
 * fallaba descartaba la serie o el gasto sin avisar. Ahora:
 *
 * 1. Un error de red o del servidor se reintenta con espera creciente. Es seguro: cada
 *    alta lleva su `client_request_id` y el backend devuelve la misma fila si ya la tenia.
 * 2. Si aun asi falla (o el backend la rechaza), el alta queda en esta bandeja, que se
 *    persiste con el resto del cache, para que el usuario la reintente o la descarte.
 */

const MAX_REINTENTOS = 4
const ESPERA_MAXIMA_MS = 15_000

/** Sin respuesta (red, timeout) o error del servidor: vale la pena volver a intentarlo. */
export const esErrorTransitorio = (error: unknown) => {
  if (!isAxiosError(error)) {
    return false
  }

  const status = error.response?.status

  return status === undefined || status === 408 || status === 429 || status >= 500
}

export const reintentoCola = {
  retry: (fallos: number, error: unknown) =>
    fallos < MAX_REINTENTOS && esErrorTransitorio(error),
  // 1 s, 2 s, 4 s, 8 s: cubre un corte breve sin dejar el formulario esperando un minuto.
  retryDelay: (intento: number) => Math.min(1000 * 2 ** intento, ESPERA_MAXIMA_MS),
}

export type TipoFallido = "serie" | "movimiento"

export interface Fallido<TPayload = unknown> {
  /** El client_request_id del alta: reintentarla con el mismo no puede duplicarla. */
  id: string
  tipo: TipoFallido
  payload: TPayload
  /** Lo que se muestra al usuario para reconocer el registro ("Press de banca · 80 kg"). */
  descripcion: string
  error: string
  fecha: string
}

export const FALLIDOS_KEY = ["sync", "fallidos"] as const

/**
 * Se persiste como cualquier query marcada con `meta.persist`, y no se recolecta nunca:
 * la bandeja no tiene observadores mientras el usuario esta en otra pantalla.
 */
export const registerFallidosDefaults = (queryClient: QueryClient) => {
  queryClient.setQueryDefaults(FALLIDOS_KEY, {
    meta: { persist: true },
    gcTime: Infinity,
    staleTime: Infinity,
  })
}

const leer = (queryClient: QueryClient) => queryClient.getQueryData<Fallido[]>(FALLIDOS_KEY) ?? []

export const guardarFallido = <TPayload>(
  queryClient: QueryClient,
  fallido: Omit<Fallido<TPayload>, "error" | "fecha"> & { error: unknown },
) => {
  const registro: Fallido<TPayload> = {
    ...fallido,
    error: getFriendlyErrorMessage(fallido.error),
    fecha: new Date().toISOString(),
  }

  queryClient.setQueryData<Fallido[]>(FALLIDOS_KEY, (actual = []) => [
    ...actual.filter((item) => item.id !== registro.id),
    registro,
  ])
}

export const quitarFallido = (queryClient: QueryClient, id: string | null | undefined) => {
  if (!id || !leer(queryClient).some((item) => item.id === id)) {
    return
  }

  queryClient.setQueryData<Fallido[]>(FALLIDOS_KEY, (actual = []) =>
    actual.filter((item) => item.id !== id),
  )
}

export const useFallidos = <TPayload>(tipo: TipoFallido) => {
  const queryClient = useQueryClient()
  const query = useQuery<Fallido[]>({
    queryKey: FALLIDOS_KEY,
    // Nunca se pide a la red: la bandeja solo se escribe con setQueryData. Si algo la
    // invalida, "refrescarla" es devolver lo que ya tiene, no vaciarla.
    queryFn: () => leer(queryClient),
    initialData: [],
    staleTime: Infinity,
  })

  return query.data.filter((item): item is Fallido<TPayload> => item.tipo === tipo)
}
