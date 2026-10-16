import { NotificacionesSettings } from "@/modules/notifications/components/notificaciones-settings"
import { PerfilHeader } from "@/modules/usuario/components/perfil-header"

export default function PerfilNotificacionesPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PerfilHeader title="Notificaciones" />
      <NotificacionesSettings />
    </div>
  )
}
