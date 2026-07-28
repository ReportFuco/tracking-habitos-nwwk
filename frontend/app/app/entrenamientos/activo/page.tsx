import { EntrenamientosMenuLinks } from "@/modules/entrenamientos/components/menu-links"
import { EntrenamientoActivoCard } from "@/modules/entrenamientos/components/entrenamiento-activo-card"
import { PageHeader } from "@/components/shell/page-header"

export default function EntrenoActivoPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Entrenamientos"
        title="Entrenamiento activo"
        description="Registra series, ajusta cargas y cierra la sesion cuando termines."
      />
      <EntrenamientosMenuLinks />

      <EntrenamientoActivoCard />
    </div>
  )
}
