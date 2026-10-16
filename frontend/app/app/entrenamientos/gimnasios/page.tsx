import { EntrenamientosHeader } from "@/modules/entrenamientos/components/entrenamientos-header"
import { GimnasiosDirectory } from "@/modules/entrenamientos/components/gimnasios-directory"

export default function GimnasiosEntrenamientosUserPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <EntrenamientosHeader title="Gimnasios" description="Consulta los gimnasios disponibles para elegir mejor el contexto de tu proxima sesion." />
      <GimnasiosDirectory />
    </div>
  )
}
