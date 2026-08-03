import { onlineManager } from "@tanstack/react-query"
import { getFriendlyErrorMessage } from "@/lib/error-messages"

// TanStack usa networkMode "online" por defecto: sin este chequeo, una mutation sin
// cola offline queda pending+paused hasta reconectar y mutateAsync nunca resuelve.
export const OFFLINE_ACTION_MESSAGE =
  "Esta acción necesita conexión a internet. Probá de nuevo cuando tengas señal."

export const isAppOffline = () => !onlineManager.isOnline()

type OnlineOnlyResult = Promise<{ ok: true } | { ok: false; message: string }>

/**
 * Politica fail-fast para mutaciones sin cola offline: si no hay red, ni siquiera se
 * llama la mutation (falla al instante, sin dejarla pending/paused). Si hay red pero el
 * backend no responde (timeout, conexion rechazada), esto no intercepta nada: Axios
 * rechaza normal y el catch de abajo lo convierte en mensaje amigable.
 */
export const runOnlineOnlyAction = async (action: () => Promise<unknown>): OnlineOnlyResult => {
  if (isAppOffline()) {
    return { ok: false, message: OFFLINE_ACTION_MESSAGE }
  }

  try {
    await action()
    return { ok: true }
  } catch (err) {
    return { ok: false, message: getFriendlyErrorMessage(err) }
  }
}
