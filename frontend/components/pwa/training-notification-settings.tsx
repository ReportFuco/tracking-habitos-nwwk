"use client"

import { Bell, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { NotificationsAPI } from "@/modules/notifications/api/notifications.api"
import { usePushDevice } from "@/modules/notifications/hooks/usePushDevice"

export function TrainingNotificationSettings() {
  const { config, supported, requiresInstall, subscribed, permission, busy, activate } =
    usePushDevice()

  // Solo se invita a activar: estar activos, bloqueados o sin soporte se ve y se cambia en
  // Perfil > Notificaciones, sin sumar una tarjeta mas a esta pantalla.
  if (!supported || subscribed || permission === "denied") {
    return null
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

  return (
    <NotificationCard
      icon={<Bell className="size-4" />}
      title="¿Te avisamos si olvidas cerrar?"
      description="A la hora y a las dos horas de iniciar."
      action={
        <Button
          type="button"
          size="sm"
          disabled={busy || !config}
          onClick={onActivate}
          className="bg-[color:var(--module-entrenamientos)] text-[color:var(--module-entrenamientos-foreground)] hover:bg-[color:var(--module-entrenamientos)]/90"
        >
          {busy ? "Guardando..." : "Activar"}
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
    <article className="flex items-center gap-3 rounded-xl bg-[color:var(--surface-low)] p-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[color:var(--surface-lowest)] text-[color:var(--module-entrenamientos)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </article>
  )
}
