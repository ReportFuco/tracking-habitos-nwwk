"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Bell, BellOff, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  NotificationsAPI,
  type PushPreferencesPatch,
  type PushStatus,
} from "@/modules/notifications/api/notifications.api"
import { usePushDevice } from "@/modules/notifications/hooks/usePushDevice"

// Espera antes de guardar la hora: el selector nativo dispara un cambio por cada ajuste.
const GUARDAR_HORA_MS = 700

/**
 * Notificaciones en Perfil. El dispositivo se suscribe aca (permiso del navegador) y las
 * preferencias son de la cuenta: llegan a todos los dispositivos suscritos.
 */
export function NotificacionesSettings() {
  const device = usePushDevice()
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [hora, setHora] = useState("21:00")
  const [guardando, setGuardando] = useState(false)
  const timerHora = useRef<number | null>(null)

  useEffect(() => {
    NotificationsAPI.getStatus()
      .then((next) => {
        setStatus(next)
        setHora(next.expense_reminder_time)
      })
      .catch(() => undefined)
    return () => {
      if (timerHora.current) window.clearTimeout(timerHora.current)
    }
  }, [])

  const guardar = async (patch: PushPreferencesPatch) => {
    setGuardando(true)
    try {
      const next = await NotificationsAPI.updatePreferences(patch)
      setStatus(next)
      return next
    } catch {
      toast.error("No pudimos guardar la preferencia")
      return null
    } finally {
      setGuardando(false)
    }
  }

  const activarDispositivo = async () => {
    const { ok, status: next } = await device.activate()
    if (next) setStatus(next)
    if (ok) toast.success("Notificaciones activadas en este dispositivo")
    return ok
  }

  const desactivarDispositivo = async () => {
    const { ok, status: next } = await device.deactivate()
    if (next) setStatus(next)
    if (ok) toast.success("Este dispositivo ya no recibira avisos")
  }

  const cambiarGastos = async (activo: boolean) => {
    // Sin un dispositivo suscrito el aviso no tendria a donde llegar.
    if (activo && !device.subscribed && !(await activarDispositivo())) return
    const next = await guardar({ expense_reminders_enabled: activo, expense_reminder_time: hora })
    if (next && activo) {
      toast.success(`Te recordaremos tus gastos a las ${next.expense_reminder_time}`, {
        description: "Solo si ese dia todavia no anotas ninguno.",
      })
    }
  }

  const cambiarEntrenos = async (activo: boolean) => {
    if (activo && !device.subscribed && !(await activarDispositivo())) return
    await guardar({ training_reminders_enabled: activo })
  }

  const cambiarHora = (value: string) => {
    setHora(value)
    if (timerHora.current) window.clearTimeout(timerHora.current)
    if (!/^\d{2}:\d{2}$/.test(value)) return
    timerHora.current = window.setTimeout(() => {
      void guardar({ expense_reminder_time: value })
    }, GUARDAR_HORA_MS)
  }

  const bloqueado = !device.supported || device.requiresInstall || device.permission === "denied"
  const sinServidor = device.config !== null && !device.config.configured
  const otrosDispositivos = (status?.active_subscriptions ?? 0) - (device.subscribed ? 1 : 0)

  return (
    <section
      aria-labelledby="notificaciones-titulo"
      className="rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5"
    >
      <h2 id="notificaciones-titulo" className="text-base font-semibold">
        Notificaciones
      </h2>
      <p className="text-sm text-muted-foreground">
        Recordatorios en tu telefono, aunque la app este cerrada.
      </p>

      <div className="mt-4">
        {!device.supported ? (
          <Aviso icon={<BellOff className="size-4" />}>
            Este navegador no ofrece notificaciones para esta app.
          </Aviso>
        ) : device.requiresInstall ? (
          <Aviso icon={<Smartphone className="size-4" />}>
            En iPhone primero instala la app: en Safari toca Compartir → Agregar a inicio y
            abrela desde ese icono.
          </Aviso>
        ) : device.permission === "denied" ? (
          <Aviso icon={<BellOff className="size-4" />}>
            Bloqueaste los avisos. Puedes habilitarlos en la configuracion de notificaciones
            del sistema.
          </Aviso>
        ) : sinServidor ? (
          <Aviso icon={<BellOff className="size-4" />}>
            Las notificaciones aun no estan habilitadas en el servidor.
          </Aviso>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[color:var(--surface-low)] p-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[color:var(--surface-lowest)]">
                {device.subscribed ? <Bell className="size-4" /> : <BellOff className="size-4" />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">Este dispositivo</p>
                <p className="text-xs text-muted-foreground">
                  {device.subscribed ? "Recibe tus avisos" : "No recibe avisos"}
                  {otrosDispositivos > 0
                    ? ` · ${otrosDispositivos} ${otrosDispositivos === 1 ? "otro activo" : "otros activos"}`
                    : ""}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant={device.subscribed ? "ghost" : "default"}
              disabled={device.busy || !device.config}
              onClick={device.subscribed ? desactivarDispositivo : activarDispositivo}
            >
              {device.busy ? "Guardando..." : device.subscribed ? "Desactivar" : "Activar"}
            </Button>
          </div>
        )}
      </div>

      {status && !sinServidor ? (
        <ul className="mt-2 divide-y divide-border">
          <li className="py-3">
            <Preferencia
              id="pref-gastos"
              titulo="Recordatorio de gastos"
              descripcion="Si a esta hora no has anotado ningun gasto del dia, te avisamos."
              activo={status.expense_reminders_enabled}
              disabled={bloqueado || guardando || device.busy}
              onChange={cambiarGastos}
            />
            {status.expense_reminders_enabled ? (
              <label className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Hora del aviso</span>
                <Input
                  type="time"
                  value={hora}
                  onChange={(event) => cambiarHora(event.target.value)}
                  className="w-32"
                />
              </label>
            ) : null}
          </li>
          <li className="py-3">
            <Preferencia
              id="pref-entrenos"
              titulo="Entreno abierto"
              descripcion="A la hora y a las dos horas de iniciar un entreno, por si olvidaste cerrarlo."
              activo={status.training_reminders_enabled}
              disabled={bloqueado || guardando || device.busy}
              onChange={cambiarEntrenos}
            />
          </li>
        </ul>
      ) : null}
    </section>
  )
}

function Aviso({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-[color:var(--surface-low)] p-3 text-sm text-muted-foreground">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
  )
}

function Preferencia({
  id,
  titulo,
  descripcion,
  activo,
  disabled,
  onChange,
}: {
  id: string
  titulo: string
  descripcion: string
  activo: boolean
  disabled: boolean
  onChange: (activo: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p id={`${id}-titulo`} className="text-sm font-medium">
          {titulo}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{descripcion}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-labelledby={`${id}-titulo`}
        disabled={disabled}
        onClick={() => onChange(!activo)}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50",
          activo ? "bg-primary" : "bg-[color:var(--surface-variant)]",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "inline-block size-5 rounded-full bg-[color:var(--surface-lowest)] transition-transform",
            activo ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </div>
  )
}
