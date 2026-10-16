import { EntrenamientosHeader } from "@/modules/entrenamientos/components/entrenamientos-header"
import { EntrenoFuerzaFormCard } from "@/modules/entrenamientos/components/entreno-fuerza-form"

export default function RegistrarEntrenamientoPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <EntrenamientosHeader title="Registrar entrenamiento" description="Abre una sesion en gym y dejala marcada como activa para cargar ahi mismo las series." sinAccion />
      <EntrenoFuerzaFormCard />
    </div>
  )
}
