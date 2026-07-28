import { PageHeader } from "@/components/shell/page-header"
import { NutricionMenuLinks } from "@/modules/nutricion/components/menu-links"
import { TablaManager } from "@/modules/nutricion/components/tabla-manager"

export default function TablaPage() {
  return (
    <div className="flex flex-col gap-5">
      <NutricionMenuLinks />
      <PageHeader
        eyebrow="Nutricion"
        title="Tabla nutricional"
        description="Consulta macros y porciones de referencia por producto."
      />
      <TablaManager />
    </div>
  )
}
