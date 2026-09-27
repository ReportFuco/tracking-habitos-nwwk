import { PageHeader } from "@/components/shell/page-header"
import { FinanzasResumen } from "@/modules/finanzas/components/finanzas-resumen"
import { FinanzasMenuLinks } from "@/modules/finanzas/components/menu-links"

export default function FinanzasHomePage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader eyebrow="Modulo" title="Finanzas" className="pb-0" />
      <FinanzasMenuLinks />
      <FinanzasResumen />
    </div>
  )
}
