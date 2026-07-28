import { MovimientoFormCard } from "@/modules/finanzas/components/movimiento-form"
import { FinanzasMenuLinks } from "@/modules/finanzas/components/menu-links"
import { PageHeader } from "@/components/shell/page-header"

export default function RegistrarMovimientoPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Finanzas"
        title="Registrar movimientos"
        description="Flujo dedicado para registrar gastos e ingresos sobre tus cuentas bancarias."
      />
      <FinanzasMenuLinks />

      <MovimientoFormCard />
    </div>
  )
}
