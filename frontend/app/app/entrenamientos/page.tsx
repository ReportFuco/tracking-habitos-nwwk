import { PageHeader } from "@/components/shell/page-header"
import { EntrenamientosHomeOverview } from "@/modules/entrenamientos/components/entrenamientos-home-overview"

export default function EntrenamientosHomePage() {
  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader title="Entrenamientos" className="pb-0" />
      <EntrenamientosHomeOverview />
    </div>
  )
}
