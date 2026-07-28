import { PageHeader } from "@/components/shell/page-header"
import { NutricionMenuLinks } from "@/modules/nutricion/components/menu-links"
import { PesoManager } from "@/modules/nutricion/components/peso-manager"

export default function PesoPage() {
  return (
    <div className="flex flex-col gap-5">
      <NutricionMenuLinks />
      <PageHeader
        eyebrow="Nutricion"
        title="Peso corporal"
        description="Registra tu peso con fecha y revisa la tendencia a lo largo del tiempo."
      />
      <PesoManager />
    </div>
  )
}
