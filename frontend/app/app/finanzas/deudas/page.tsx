import { DeudasManager } from "@/modules/finanzas/components/deudas-manager"
import { FinanzasHeader } from "@/modules/finanzas/components/finanzas-header"

export default function DeudasPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <FinanzasHeader title="Deudas" />
      <DeudasManager />
    </div>
  )
}
