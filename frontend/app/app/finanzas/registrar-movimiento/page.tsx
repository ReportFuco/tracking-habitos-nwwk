import { PageHeader } from "@/components/shell/page-header"
import { FinanzasMenuLinks } from "@/modules/finanzas/components/menu-links"
import { MovimientoFormCard } from "@/modules/finanzas/components/movimiento-form"
import { MovimientosRecientes } from "@/modules/finanzas/components/movimientos-recientes"

export default async function RegistrarMovimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>
}) {
  const { tipo } = await searchParams
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader eyebrow="Finanzas" title="Nuevo movimiento" className="pb-0" />
      <FinanzasMenuLinks />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <MovimientoFormCard tipoInicial={tipo === "ingreso" ? "ingreso" : "gasto"} />
        <MovimientosRecientes />
      </div>
    </div>
  )
}
