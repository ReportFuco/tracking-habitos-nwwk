"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SkeletonCard } from "@/components/ui/skeleton"
import { formatShortDate } from "@/lib/dates"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { formatCLP } from "@/lib/format"
import { useDeuda, useDeudasMutations, useMovimientosFiltrados } from "@/modules/finanzas/hooks/useFinanzas"
import { DeudaFormDialog, TIPO_DEUDA_UI } from "./deuda-form-dialog"
import { hrefAbonar } from "./deudas-manager"

export function DeudaDetailView({ idDeuda }: { idDeuda: number }) {
  const router = useRouter()
  const query = useDeuda(idDeuda)
  const abonosQuery = useMovimientosFiltrados({ id_deuda: idDeuda }, Number.isFinite(idDeuda))
  const { eliminarDeuda, eliminandoDeuda } = useDeudasMutations()
  const [editando, setEditando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  if (query.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <SkeletonCard className="h-40" />
        <SkeletonCard className="h-48" />
      </div>
    )
  }

  const deuda = query.data
  if (query.isError || !deuda) {
    return (
      <section className="mx-auto flex w-full max-w-xl flex-col items-start gap-3 rounded-2xl bg-[color:var(--surface-lowest)] p-5 shadow-[var(--shadow-airy)]">
        <p className="font-semibold">{query.error ? getFriendlyErrorMessage(query.error) : "No encontramos esta deuda."}</p>
        <Link href="/app/finanzas/deudas" className="inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4">
          <ArrowLeft className="size-4" />
          Volver a deudas
        </Link>
      </section>
    )
  }

  const ui = TIPO_DEUDA_UI[deuda.tipo]
  const debo = deuda.tipo === "debo"
  const pagada = deuda.estado === "pagada"
  const abonos = abonosQuery.data?.pages.flatMap((page) => page.items) ?? []

  const handleEliminar = async () => {
    const result = await eliminarDeuda(deuda.id_deuda)
    if (!result.ok) {
      toast.error("No pudimos eliminar la deuda", { description: result.message })
      return
    }
    setConfirmando(false)
    toast.success("Deuda eliminada")
    router.push("/app/finanzas/deudas")
  }

  const datos: { etiqueta: string; valor: React.ReactNode }[] = [
    ...(deuda.contraparte ? [{ etiqueta: debo ? "Le debes a" : "Te debe", valor: deuda.contraparte }] : []),
    { etiqueta: "Monto total", valor: formatCLP(deuda.monto_total) },
    { etiqueta: debo ? "Pagado" : "Cobrado", valor: formatCLP(deuda.abonado) },
    { etiqueta: "Registrada", valor: formatShortDate(deuda.created_at) },
    ...(deuda.descripcion ? [{ etiqueta: "Nota", valor: deuda.descripcion }] : []),
  ]

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-2xl p-5 sm:p-6" style={{ background: ui.color, color: ui.on }}>
        <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-85">
          {ui.label}
          {pagada ? ` · ${debo ? "Pagada" : "Cobrada"}` : ""}
        </p>
        <p className="font-display text-[2.6rem] leading-none tabular-nums sm:text-5xl">{formatCLP(deuda.saldo)}</p>
        <p className="text-base font-semibold">
          {pagada ? deuda.nombre : `por ${debo ? "pagar" : "cobrar"} · ${deuda.nombre}`}
        </p>
        {/* La barra sobre el bloque de color usa el color de texto del bloque. */}
        <div className="h-2 w-full overflow-hidden rounded-sm" style={{ background: "color-mix(in srgb, currentColor 25%, transparent)" }}>
          <div
            className="h-full"
            style={{ width: `${Math.min(100, (deuda.abonado / deuda.monto_total) * 100)}%`, background: "currentColor" }}
          />
        </div>
      </section>

      {pagada ? null : (
        <Button asChild size="lg" className="h-12 text-base" style={{ background: ui.color, color: ui.on }}>
          <Link href={hrefAbonar(deuda)}>
            <Plus className="size-4" aria-hidden />
            {debo ? "Registrar un pago" : "Registrar un cobro"}
          </Link>
        </Button>
      )}

      <dl className="divide-y divide-border rounded-2xl bg-[color:var(--surface-lowest)] shadow-[var(--shadow-airy)]">
        {datos.map(({ etiqueta, valor }) => (
          <div key={etiqueta} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{etiqueta}</dt>
            <dd className="text-sm sm:text-right">{valor}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {debo ? "Pagos" : "Cobros"}
        </h2>
        {abonosQuery.isLoading ? (
          <SkeletonCard className="h-24" />
        ) : abonos.length === 0 ? (
          <p className="rounded-2xl bg-[color:var(--surface-lowest)] p-4 text-sm text-muted-foreground shadow-[var(--shadow-airy)]">
            {debo
              ? "Aún no hay pagos. Registra un gasto y elige esta deuda para descontarlo del saldo."
              : "Aún no hay cobros. Registra un ingreso y elige esta deuda para descontarlo del saldo."}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl bg-[color:var(--surface-lowest)] shadow-[var(--shadow-airy)]">
            {abonos.map((movimiento) => (
              <li key={movimiento.id_transaccion}>
                <Link
                  href={`/app/finanzas/movimientos/${movimiento.id_transaccion}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-[color:var(--surface-low)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold first-letter:uppercase">
                      {movimiento.descripcion || movimiento.categoria || "Sin nota"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[formatShortDate(movimiento.created_at), movimiento.nombre_cuenta].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCLP(movimiento.monto)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {abonosQuery.hasNextPage ? (
          <Button type="button" variant="outline" disabled={abonosQuery.isFetchingNextPage} onClick={() => void abonosQuery.fetchNextPage()}>
            {abonosQuery.isFetchingNextPage ? "Cargando..." : "Ver más"}
          </Button>
        ) : null}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="lg" variant="outline" className="h-11" onClick={() => setEditando(true)}>
          <Pencil className="size-4" />
          Editar
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-11 text-destructive hover:text-destructive"
          onClick={() => setConfirmando(true)}
        >
          <Trash2 className="size-4" />
          Eliminar
        </Button>
      </div>

      <Link href="/app/finanzas/deudas" className="inline-flex items-center gap-2 self-start text-sm font-semibold underline-offset-4 hover:underline">
        <ArrowLeft className="size-4" />
        Volver a deudas
      </Link>

      <DeudaFormDialog open={editando} onOpenChange={setEditando} deuda={deuda} />

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar «{deuda.nombre}»?</DialogTitle>
            <DialogDescription>
              {deuda.cantidad_abonos > 0
                ? `Sus ${deuda.cantidad_abonos} ${deuda.cantidad_abonos === 1 ? "movimiento" : "movimientos"} no se borran: quedan como ${debo ? "gastos" : "ingresos"} normales.`
                : "No se puede deshacer."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={eliminandoDeuda} onClick={() => void handleEliminar()}>
              {eliminandoDeuda ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

