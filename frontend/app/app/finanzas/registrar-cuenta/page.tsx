import { CuentaFormCard } from "@/modules/finanzas/components/cuenta-form"
import { FinanzasMenuLinks } from "@/modules/finanzas/components/menu-links"
import { PageHeader } from "@/components/shell/page-header"

export default function RegistrarCuentaPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Finanzas"
        title="Cuentas bancarias"
        description="Flujo dedicado para crear una cuenta bancaria nueva y dejar lista la base del modulo."
      />
      <FinanzasMenuLinks />

      <CuentaFormCard />
    </div>
  )
}
