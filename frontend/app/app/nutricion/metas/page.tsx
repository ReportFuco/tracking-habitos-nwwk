import { PageHeader } from "@/components/shell/page-header"
import { NutricionMenuLinks } from "@/modules/nutricion/components/menu-links"
import { MetasManager } from "@/modules/nutricion/components/metas-manager"

export default function MetasPage() {
  return (
    <div className="flex flex-col gap-5">
      <NutricionMenuLinks />
      <PageHeader
        eyebrow="Nutricion"
        title="Metas nutricionales"
        description="Define metas por periodo con kcal y distribucion de macros."
      />
      <MetasManager />
    </div>
  )
}
