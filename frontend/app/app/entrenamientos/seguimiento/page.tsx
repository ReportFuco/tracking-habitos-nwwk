import { EntrenamientosHeader } from "@/modules/entrenamientos/components/entrenamientos-header"
import { SeguimientoView } from "@/modules/entrenamientos/components/seguimiento/seguimiento-view"

export default function SeguimientoEntrenamientosPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <EntrenamientosHeader title="Seguimiento" description="La carga de cada musculo en tu cuerpo y lo que te sugiere tu asistente." />
      <SeguimientoView />
    </div>
  )
}
