import { NutricionHeader } from "@/modules/nutricion/components/nutricion-header"
import { TablaManager } from "@/modules/nutricion/components/tabla-manager"

export default function TablaPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <NutricionHeader title="Tabla nutricional" description="Consulta macros y porciones de referencia por producto." />
      <TablaManager />
    </div>
  )
}
