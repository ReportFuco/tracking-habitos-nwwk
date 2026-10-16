import { EntrenamientosHeader } from "@/modules/entrenamientos/components/entrenamientos-header"
import { HistoricoFuerza } from "@/modules/entrenamientos/components/historico-fuerza"

export default function HistoricoEntrenamientosPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <EntrenamientosHeader title="Historial" description="Revisa sesiones cerradas y consulta el detalle de sus series sin mezclar esta vista con el registro activo." />
      <HistoricoFuerza />
    </div>
  )
}
