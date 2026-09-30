"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, MapPin, Pencil, Trash2 } from "lucide-react"
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
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { formatCLP } from "@/lib/format"
import { useFinanzas, useMovimiento } from "@/modules/finanzas/hooks/useFinanzas"
import { MovimientoDetailSkeleton } from "@/modules/finanzas/components/skeletons/movimiento-detail-skeleton"
import { MovimientoEditForm } from "./movimiento-edit-form"
import { MovimientoProductos } from "./movimiento-productos"

const fechaFormatter = new Intl.DateTimeFormat("es-CL", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

/** "sábado 26 de septiembre de 2026, 13:40" desde el valor naive del backend (hora de Chile). */
function formatFecha(value: string) {
  const [fecha, hora = ""] = value.split("T")
  const [y, m, d] = fecha.split("-").map(Number)
  const texto = fechaFormatter.format(new Date(Date.UTC(y, m - 1, d)))
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}${hora ? `, ${hora.slice(0, 5)}` : ""}`
}

export function MovimientoDetailView({ idMovimiento }: { idMovimiento: number }) {
  const router = useRouter()
  const { eliminarMovimiento, eliminandoMovimiento } = useFinanzas()
  const query = useMovimiento(idMovimiento)
  const [editando, setEditando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  if (query.isLoading) return <MovimientoDetailSkeleton includeChrome={false} />

  const movimiento = query.data
  if (query.isError || !movimiento) {
    return (
      <section className="flex flex-col items-start gap-3 rounded-2xl bg-[color:var(--surface-lowest)] p-5 shadow-[var(--shadow-airy)]">
        <p className="font-semibold">{query.error ? getFriendlyErrorMessage(query.error) : "No encontramos este movimiento."}</p>
        <Link href="/app/finanzas/movimientos" className="inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4">
          <ArrowLeft className="size-4" />
          Volver a movimientos
        </Link>
      </section>
    )
  }

  const esIngreso = movimiento.tipo_movimiento === "ingreso"
  const tipo = esIngreso ? "ingreso" : "gasto"

  const handleEliminar = async () => {
    const result = await eliminarMovimiento(movimiento.id_transaccion)
    if (!result.ok) {
      toast.error("No pudimos eliminar el movimiento", { description: result.message })
      return
    }
    setConfirmando(false)
    toast.success(esIngreso ? "Ingreso eliminado" : "Gasto eliminado")
    router.push("/app/finanzas/movimientos")
  }

  if (editando) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <MovimientoEditForm
          movimiento={movimiento}
          onDone={(actualizado) => {
            setEditando(false)
            if (actualizado) toast.success("Movimiento actualizado")
          }}
        />
      </div>
    )
  }

  const datos: { etiqueta: string; valor: React.ReactNode }[] = [
    { etiqueta: "Fecha", valor: formatFecha(movimiento.created_at) },
    { etiqueta: "Categoria", valor: <span className="capitalize">{movimiento.categoria ?? "Sin categoria"}</span> },
    { etiqueta: "Cuenta", valor: movimiento.nombre_cuenta ?? "—" },
    ...(movimiento.id_deuda
      ? [
          {
            etiqueta: esIngreso ? "Cobro de" : "Pago de",
            valor: (
              <Link href={`/app/finanzas/deudas/${movimiento.id_deuda}`} className="font-semibold underline underline-offset-4">
                {movimiento.deuda ?? "Deuda"}
              </Link>
            ),
          },
        ]
      : []),
    ...(!esIngreso ? [{ etiqueta: "Tipo de gasto", valor: movimiento.tipo_gasto === "fijo" ? "Fijo (se repite)" : "Variable" }] : []),
    ...(movimiento.en_lugar_compra && movimiento.latitud != null && movimiento.longitud != null
      ? [
          {
            etiqueta: "Lugar",
            valor: (
              <a
                href={`https://www.google.com/maps?q=${movimiento.latitud},${movimiento.longitud}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4"
              >
                <MapPin className="size-4" aria-hidden />
                Ver en el mapa · ±{Math.round(movimiento.precision_ubicacion ?? 0)} m
              </a>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <section className="rounded-2xl p-5 sm:p-6" style={{ background: `var(--${tipo})`, color: `var(--${tipo}-on)` }}>
        <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-85">{esIngreso ? "Ingreso" : "Gasto"}</p>
        <p className="mt-2 font-display text-[2.6rem] leading-none sm:text-5xl">
          {esIngreso ? "+" : "−"}
          {formatCLP(movimiento.monto)}
        </p>
        <p className="mt-3 text-base font-semibold first-letter:uppercase">
          {movimiento.descripcion || movimiento.categoria || "Sin nota"}
        </p>
      </section>

      <dl className="divide-y divide-border rounded-2xl bg-[color:var(--surface-lowest)] shadow-[var(--shadow-airy)]">
        {datos.map(({ etiqueta, valor }) => (
          <div key={etiqueta} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{etiqueta}</dt>
            <dd className="text-sm sm:text-right">{valor}</dd>
          </div>
        ))}
      </dl>

      {esIngreso ? null : <MovimientoProductos movimiento={movimiento} />}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="lg" className="h-11" onClick={() => setEditando(true)}>
          <Pencil className="size-4" />
          Editar
        </Button>
        <Button type="button" size="lg" variant="outline" className="h-11 text-destructive hover:text-destructive" onClick={() => setConfirmando(true)}>
          <Trash2 className="size-4" />
          Eliminar
        </Button>
      </div>

      <Link href="/app/finanzas/movimientos" className="inline-flex items-center gap-2 self-start text-sm font-semibold underline-offset-4 hover:underline">
        <ArrowLeft className="size-4" />
        Volver a movimientos
      </Link>

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              ¿Eliminar este {tipo} de {formatCLP(movimiento.monto)}?
            </DialogTitle>
            <DialogDescription>No se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={eliminandoMovimiento} onClick={() => void handleEliminar()}>
              {eliminandoMovimiento ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
