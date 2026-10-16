import { CuentasManager } from "@/modules/finanzas/components/cuentas-manager"
import { FinanzasHeader } from "@/modules/finanzas/components/finanzas-header"

export default function CuentasPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <FinanzasHeader title="Cuentas" action={{ href: "/app/finanzas/registrar-cuenta", label: "Nueva cuenta" }} />
      <CuentasManager />
    </div>
  )
}
