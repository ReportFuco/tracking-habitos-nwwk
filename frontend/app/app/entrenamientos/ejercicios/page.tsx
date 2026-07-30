import { EjerciciosCatalogo } from "@/modules/entrenamientos/components/ejercicios-catalogo"
import { EntrenamientosMenuLinks } from "@/modules/entrenamientos/components/menu-links"
import { PageHeader } from "@/components/shell/page-header"

export default function EjerciciosEntrenamientosPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Entrenamientos"
        title="Ejercicios"
        description="Busca por musculo o equipo y revisa la ejecucion antes de registrar tus series."
      />
      <EntrenamientosMenuLinks />

      <EjerciciosCatalogo />
    </div>
  )
}
