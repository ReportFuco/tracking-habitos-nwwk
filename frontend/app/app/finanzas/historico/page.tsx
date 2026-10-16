import { HistoricoCards } from "@/modules/finanzas/components/historico-cards"
import { FinanzasHeader } from "@/modules/finanzas/components/finanzas-header"

export default function HistoricoFinanzasPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <FinanzasHeader title="Historico" back={{ href: "/app/finanzas/movimientos", label: "Movimientos" }} />
      <HistoricoCards />
    </div>
  )
}
