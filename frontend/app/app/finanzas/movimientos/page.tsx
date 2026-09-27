import { PageHeader } from "@/components/shell/page-header"
import { FinanzasMenuLinks } from "@/modules/finanzas/components/menu-links"
import { MovimientosManager } from "@/modules/finanzas/components/movimientos-manager"

export default function MovimientosPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader eyebrow="Finanzas" title="Movimientos" className="pb-0" />
      <FinanzasMenuLinks />
      <MovimientosManager />
    </div>
  )
}
