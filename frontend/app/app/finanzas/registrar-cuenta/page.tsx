import { CuentaFormCard } from "@/modules/finanzas/components/cuenta-form"
import { FinanzasMenuLinks } from "@/modules/finanzas/components/menu-links"
import { PageHeader } from "@/components/shell/page-header"

export default function RegistrarCuentaPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader
        eyebrow="Finanzas"
        title="Nueva cuenta"
        className="pb-0"
      />
      <FinanzasMenuLinks />

      <CuentaFormCard />
    </div>
  )
}
