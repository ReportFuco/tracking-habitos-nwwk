import { FinanzasHeader } from "@/modules/finanzas/components/finanzas-header"
import { MovimientoFormCard } from "@/modules/finanzas/components/movimiento-form"
import { MovimientosRecientes } from "@/modules/finanzas/components/movimientos-recientes"

export default async function RegistrarMovimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; deuda?: string }>
}) {
  const { tipo, deuda } = await searchParams
  const idDeuda = Number(deuda)
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <FinanzasHeader title="Nuevo movimiento" action={null} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <MovimientoFormCard
          tipoInicial={tipo === "ingreso" ? "ingreso" : "gasto"}
          deudaInicial={Number.isInteger(idDeuda) && idDeuda > 0 ? idDeuda : undefined}
        />
        <MovimientosRecientes />
      </div>
    </div>
  )
}
