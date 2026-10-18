import { FinanzasHeader } from "@/modules/finanzas/components/finanzas-header"
import { MetasGastoForm } from "@/modules/finanzas/components/metas-gasto-form"

export default function MetasGastoPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <FinanzasHeader title="Metas de gasto" back={{ href: "/app/finanzas/semana", label: "Semana" }} action={null} />
      <MetasGastoForm />
    </div>
  )
}
