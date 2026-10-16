import { FinanzasHeader } from "@/modules/finanzas/components/finanzas-header"
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
      <FinanzasHeader title={`Movimiento #${id}`} back={{ href: "/app/finanzas/movimientos", label: "Movimientos" }} />
      <MovimientoDetailView idMovimiento={idMovimiento} />
    </div>
  )
}
