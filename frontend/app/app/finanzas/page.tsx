import { PageHeader } from "@/components/shell/page-header"
import { FinanzasKpiOverview } from "@/modules/finanzas/components/finanzas-kpi-overview"
import { FinanzasMenuLinks } from "@/modules/finanzas/components/menu-links"

export default function FinanzasHomePage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader eyebrow="Modulo" title="Finanzas" className="pb-0" />
      <FinanzasMenuLinks />
      <FinanzasKpiOverview />
    </div>
  )
}
