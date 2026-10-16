import { PageHeader } from "@/components/shell/page-header"
import { EntrenamientosMenuLinks } from "@/modules/entrenamientos/components/menu-links"
import { SeguimientoView } from "@/modules/entrenamientos/components/seguimiento/seguimiento-view"

export default function SeguimientoEntrenamientosPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Entrenamientos"
        title="Seguimiento"
        description="La carga de cada musculo en tu cuerpo y lo que te sugiere tu asistente."
      />
      <EntrenamientosMenuLinks />

      <SeguimientoView />
    </div>
  )
}
