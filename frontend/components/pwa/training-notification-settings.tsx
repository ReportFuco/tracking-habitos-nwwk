"use client"

import { useEffect, useState } from "react"
import { Bell, BellOff, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  base64UrlToUint8Array,
  NotificationsAPI,
  serializePushSubscription,
  type PushConfig,
} from "@/modules/notifications/api/notifications.api"

type NavigatorWithStandalone = Navigator & { standalone?: boolean }

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  Boolean((navigator as NavigatorWithStandalone).standalone)

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)

export function TrainingNotificationSettings() {
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
      setRequiresInstall(isIOS() && !isStandalone())
      if (!hasSupport) {
        return
      }
      setPermission(Notification.permission)
      try {
        const nextConfig = await NotificationsAPI.getConfig()
        setConfig(nextConfig)
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration) {
          setSubscribed(Boolean(await registration.pushManager.getSubscription()))
        }
      } catch {
        // La tarjeta conserva un estado neutro si estamos offline.
      }
    }

    void inspect()
  }, [])

  if (!supported) {
    return (
      <NotificationCard
        icon={<BellOff className="size-4" />}
        title="Recordatorios no disponibles"
        description="Este navegador no ofrece Web Push para esta app."
      />
    )
  }

  if (requiresInstall) {
    return (
      <NotificationCard
        icon={<Smartphone className="size-4" />}
        title="Instala la app para recibir avisos"
        description="En Safari toca Compartir → Agregar a inicio y abre la app desde ese icono."
      />
    )
  }

  if (config && !config.configured) {
    return null
  }

  const activate = async () => {
    if (!config?.vapid_public_key) {
      toast.error("Los recordatorios aun no estan configurados")
      return
    }
    setBusy(true)
    try {
      const nextPermission = await Notification.requestPermission()
      setPermission(nextPermission)
      if (nextPermission !== "granted") {
        toast.error("Safari no tiene permiso para mostrar avisos")
        return
      }

      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(config.vapid_public_key),
        }))
      await NotificationsAPI.subscribe(serializePushSubscription(subscription))
      setSubscribed(true)
      toast.success("Recordatorios activados", {
        description: "Te avisaremos a la hora y a las dos horas si el entreno sigue abierto.",
      })
    } catch {
      toast.error("No pudimos activar los recordatorios")
    } finally {
      setBusy(false)
    }
  }

  const deactivate = async () => {
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        try {
          await NotificationsAPI.unsubscribe(subscription.endpoint)
        } finally {
          await subscription.unsubscribe()
        }
      }
      setSubscribed(false)
      toast.success("Recordatorios desactivados en este dispositivo")
    } catch {
      setSubscribed(false)
      toast.error("No pudimos desactivar los recordatorios")
    } finally {
      setBusy(false)
    }
  }

  if (permission === "denied") {
    return (
      <NotificationCard
        icon={<BellOff className="size-4" />}
        title="Avisos bloqueados"
        description="Puedes habilitarlos desde la configuracion de notificaciones del sistema."
      />
    )
  }

  return (
    <NotificationCard
      icon={<Bell className="size-4" />}
      title={subscribed ? "Recordatorios activos" : "¿Te avisamos si olvidas cerrar?"}
      description={
        subscribed
          ? "Este dispositivo recibira avisos a la hora y a las dos horas."
          : "Activa avisos a la hora y a las dos horas de iniciar un entreno."
      }
      action={
        <Button
          type="button"
          variant={subscribed ? "ghost" : "default"}
          size="sm"
          disabled={busy || !config}
          onClick={subscribed ? deactivate : activate}
          className={
            subscribed
              ? ""
              : "bg-[color:var(--module-entrenamientos)] text-[color:var(--tertiary-foreground)] hover:bg-[color:var(--module-entrenamientos)]/90"
          }
        >
          {busy ? "Guardando..." : subscribed ? "Desactivar" : "Activar avisos"}
        </Button>
      }
    />
  )
}

function NotificationCard({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <article className="rounded-[1.25rem] bg-[color:var(--surface-low)] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-lowest)] text-[color:var(--module-entrenamientos)]">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </article>
  )
}
