import { PageHeader } from "@/components/shell/page-header"
import { NutricionMenuLinks } from "@/modules/nutricion/components/menu-links"
import { ConsumosManager } from "@/modules/nutricion/components/consumos-manager"

export default function ConsumosPage() {
  return (
    <div className="flex flex-col gap-5">
      <NutricionMenuLinks />
      <PageHeader
        eyebrow="Nutricion"
        title="Consumos"
        description="Registra comidas por fecha y horario, agrupadas por dia."
      />
      <ConsumosManager />
    </div>
  )
}
