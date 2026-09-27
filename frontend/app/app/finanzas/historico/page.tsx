import { HistoricoCards } from "@/modules/finanzas/components/historico-cards"
import { FinanzasMenuLinks } from "@/modules/finanzas/components/menu-links"
import { PageHeader } from "@/components/shell/page-header"

export default function HistoricoFinanzasPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader
        eyebrow="Finanzas"
        title="Historico"
        className="pb-0"
      />
      <FinanzasMenuLinks />

      <HistoricoCards />
    </div>
  )
}
