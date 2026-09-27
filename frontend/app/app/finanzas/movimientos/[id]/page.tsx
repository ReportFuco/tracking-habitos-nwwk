import { PageHeader } from "@/components/shell/page-header"
import { FinanzasMenuLinks } from "@/modules/finanzas/components/menu-links"
import { MovimientoDetailView } from "@/modules/finanzas/components/movimiento-detail-view"

export default async function MovimientoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const idMovimiento = Number(id)

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader eyebrow="Finanzas" title={`Movimiento #${id}`} className="pb-0" />
      <FinanzasMenuLinks />

      <MovimientoDetailView idMovimiento={idMovimiento} />
    </div>
  )
}
