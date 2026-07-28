import { EntrenamientosMenuLinks } from "@/modules/entrenamientos/components/menu-links"
import { EntrenoFuerzaFormCard } from "@/modules/entrenamientos/components/entreno-fuerza-form"
import { PageHeader } from "@/components/shell/page-header"

export default function RegistrarEntrenamientoPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Entrenamientos"
        title="Registrar entrenamiento"
        description="Abre una sesion en gym y dejala marcada como activa para cargar ahi mismo las series."
      />
      <EntrenamientosMenuLinks />

      <EntrenoFuerzaFormCard />
    </div>
  )
}
