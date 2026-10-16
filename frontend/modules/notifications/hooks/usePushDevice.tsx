"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  base64UrlToUint8Array,
  NotificationsAPI,
  serializePushSubscription,
  type PushConfig,
  type PushStatus,
} from "@/modules/notifications/api/notifications.api"

type NavigatorWithStandalone = Navigator & { standalone?: boolean }

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  Boolean((navigator as NavigatorWithStandalone).standalone)

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)

/** `status` es el estado de la cuenta segun el servidor, si alcanzo a responder. */
export type PushResult = { ok: boolean; status: PushStatus | null }

const FAILED: PushResult = { ok: false, status: null }

/**
 * Estado Web Push de este dispositivo: soporte, permiso y suscripcion. La suscripcion es
 * por navegador; lo que se avisa (entrenos, gastos) son preferencias de la cuenta.
 */
export function usePushDevice() {
  const [config, setConfig] = useState<PushConfig | null>(null)
  const [supported, setSupported] = useState(true)
  const [requiresInstall, setRequiresInstall] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>("default")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const inspect = async () => {
      const hasSupport =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
      setSupported(hasSupport)
      // En iPhone, Web Push solo existe con la app agregada a la pantalla de inicio.
      setRequiresInstall(isIOS() && !isStandalone())
      if (!hasSupport) {
        return
      }
      setPermission(Notification.permission)
      try {
        setConfig(await NotificationsAPI.getConfig())
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration) {
          setSubscribed(Boolean(await registration.pushManager.getSubscription()))
        }
      } catch {
        // Se conserva un estado neutro si estamos offline.
      }
    }

    void inspect()
  }, [])

  /** Pide permiso y suscribe este dispositivo. Los errores ya se avisan con un toast. */
  const activate = useCallback(async (): Promise<PushResult> => {
    if (!config?.vapid_public_key) {
      toast.error("Las notificaciones aun no estan configuradas")
      return FAILED
    }
    setBusy(true)
    try {
      const nextPermission = await Notification.requestPermission()
      setPermission(nextPermission)
      if (nextPermission !== "granted") {
        toast.error("El navegador no tiene permiso para mostrar avisos")
        return FAILED
      }

      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(config.vapid_public_key),
        }))
      const status = await NotificationsAPI.subscribe(serializePushSubscription(subscription))
      setSubscribed(true)
      return { ok: true, status }
    } catch {
      toast.error("No pudimos activar las notificaciones")
      return FAILED
    } finally {
      setBusy(false)
    }
  }, [config])

  /** Desuscribe este dispositivo. Los errores ya se avisan con un toast. */
  const deactivate = useCallback(async (): Promise<PushResult> => {
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      let status: PushStatus | null = null
      if (subscription) {
        try {
          status = await NotificationsAPI.unsubscribe(subscription.endpoint)
        } finally {
          await subscription.unsubscribe()
        }
      }
      setSubscribed(false)
      return { ok: true, status }
    } catch {
      setSubscribed(false)
      toast.error("No pudimos desactivar las notificaciones")
      return FAILED
    } finally {
      setBusy(false)
    }
  }, [])

  return {
    config,
    supported,
    requiresInstall,
    subscribed,
    permission,
    busy,
    activate,
    deactivate,
  }
}
