import { EntrenamientosMenuLinks } from "@/modules/entrenamientos/components/menu-links"
import { HistoricoFuerza } from "@/modules/entrenamientos/components/historico-fuerza"
import { PageHeader } from "@/components/shell/page-header"

export default function HistoricoEntrenamientosPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Entrenamientos"
        title="Entrenamientos anteriores"
        description="Revisa sesiones cerradas y consulta el detalle de sus series sin mezclar esta vista con el registro activo."
      />
      <EntrenamientosMenuLinks />

      <HistoricoFuerza />
    </div>
  )
}
