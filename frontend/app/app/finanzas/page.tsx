import { PageHeader } from "@/components/shell/page-header"
import { MenuGroup } from "@/components/shell/menu-group"
import { FinanzasHomeMenu } from "@/modules/finanzas/components/finanzas-home-menu"
import { FinanzasResumen } from "@/modules/finanzas/components/finanzas-resumen"
import { SaldoCuentas } from "@/modules/finanzas/components/saldo-cuentas"

export default function FinanzasHomePage() {
  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader title="Finanzas" className="pb-0" />
      <FinanzasHomeMenu />
      <MenuGroup title="Saldo">
        <SaldoCuentas />
      </MenuGroup>
      <MenuGroup title="Resumen del mes">
        <FinanzasResumen />
      </MenuGroup>
    </div>
  )
}
