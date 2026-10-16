import { EjerciciosCatalogo } from "@/modules/entrenamientos/components/ejercicios-catalogo"
import { EntrenamientosHeader } from "@/modules/entrenamientos/components/entrenamientos-header"

export default function EjerciciosEntrenamientosPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <EntrenamientosHeader title="Ejercicios" description="Busca por musculo o equipo y revisa la ejecucion antes de registrar tus series." />
      <EjerciciosCatalogo />
    </div>
  )
}
