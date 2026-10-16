import { CuentaFormCard } from "@/modules/finanzas/components/cuenta-form"
import { FinanzasHeader } from "@/modules/finanzas/components/finanzas-header"

export default function RegistrarCuentaPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <FinanzasHeader title="Nueva cuenta" back={{ href: "/app/finanzas/cuentas", label: "Cuentas" }} action={null} />
      <CuentaFormCard />
    </div>
  )
}
