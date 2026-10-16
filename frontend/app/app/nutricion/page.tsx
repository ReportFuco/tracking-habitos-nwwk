import { PageHeader } from "@/components/shell/page-header"
import { NutricionHomeOverview } from "@/modules/nutricion/components/nutricion-home-overview"

export default function NutricionPage() {
  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader title="Nutricion" className="pb-0" />
      <NutricionHomeOverview />
    </div>
  )
}
