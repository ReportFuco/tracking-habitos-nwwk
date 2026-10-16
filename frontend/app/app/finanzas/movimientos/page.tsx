import { FinanzasHeader } from "@/modules/finanzas/components/finanzas-header"
import { MovimientosManager } from "@/modules/finanzas/components/movimientos-manager"

export default function MovimientosPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <FinanzasHeader title="Movimientos" />
      <MovimientosManager />
    </div>
  )
}
