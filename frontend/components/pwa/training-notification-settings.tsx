"use client"

import { Bell, BellOff, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { NotificationsAPI } from "@/modules/notifications/api/notifications.api"
import { usePushDevice } from "@/modules/notifications/hooks/usePushDevice"

export function TrainingNotificationSettings() {
  const { config, supported, requiresInstall, subscribed, permission, busy, activate, deactivate } =
    usePushDevice()

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

  const onActivate = async () => {
    const { ok } = await activate()
    if (ok) {
      // Activar desde aqui es pedir explicitamente los avisos de entreno.
      await NotificationsAPI.updatePreferences({ training_reminders_enabled: true }).catch(
        () => undefined,
      )
      toast.success("Recordatorios activados", {
        description: "Te avisaremos a la hora y a las dos horas si el entreno sigue abierto.",
      })
    }
  }

  const onDeactivate = async () => {
    const { ok } = await deactivate()
    if (ok) toast.success("Recordatorios desactivados en este dispositivo")
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
          onClick={subscribed ? onDeactivate : onActivate}
          className={
            subscribed
              ? ""
              : "bg-[color:var(--module-entrenamientos)] text-[color:var(--module-entrenamientos-foreground)] hover:bg-[color:var(--module-entrenamientos)]/90"
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
    <article className="rounded-xl bg-[color:var(--surface-low)] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-[color:var(--surface-lowest)] text-[color:var(--module-entrenamientos)]">
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
