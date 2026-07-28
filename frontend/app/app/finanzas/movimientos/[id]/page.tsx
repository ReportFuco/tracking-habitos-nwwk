import { ContextNav } from "@/components/shell/context-nav"
import { PageHeader } from "@/components/shell/page-header"
import { MovimientoDetailView } from "@/modules/finanzas/components/movimiento-detail-view"

export default async function MovimientoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const idMovimiento = Number(id)

  return (
    <div className="flex flex-col gap-6">
      <ContextNav
        crumbs={[
          { label: "Inicio", href: "/app/dashboard" },
          { label: "Finanzas", href: "/app/finanzas" },
          { label: "Movimientos", href: "/app/finanzas/movimientos" },
          { label: `Detalle #${id}` },
        ]}
      />

      <PageHeader
        eyebrow="Finanzas"
        title="Detalle de movimiento"
        description="Vista individual para revisar el contexto completo de un movimiento."
      />

      <MovimientoDetailView idMovimiento={idMovimiento} />
    </div>
  )
}
