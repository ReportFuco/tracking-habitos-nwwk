import { FinanzasHeader } from "@/modules/finanzas/components/finanzas-header"
import { SemanaDetalle } from "@/modules/finanzas/components/gasto-semanal"

export default function SemanaFinanzasPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <FinanzasHeader title="Semana" />
      <SemanaDetalle />
    </div>
  )
}
