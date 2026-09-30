import { PageHeader } from "@/components/shell/page-header"
import { DeudasManager } from "@/modules/finanzas/components/deudas-manager"
import { FinanzasMenuLinks } from "@/modules/finanzas/components/menu-links"

export default function DeudasPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader eyebrow="Finanzas" title="Deudas" className="pb-0" />
      <FinanzasMenuLinks />
      <DeudasManager />
    </div>
  )
}
