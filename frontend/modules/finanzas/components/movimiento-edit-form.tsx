"use client"

import { FormEvent, useMemo, useState } from "react"
import { ArrowDownLeft, ArrowUpRight, Repeat } from "lucide-react"
import { ChipSelect } from "@/components/forms/chip-select"
import { Button } from "@/components/ui/button"
import { formatCLP } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useDeudas, useFinanzas } from "@/modules/finanzas/hooks/useFinanzas"
import type { MovimientoPatch, MovimientoResponse, TipoMovimiento } from "@/modules/finanzas/types/finanzas"

const milesFormatter = new Intl.NumberFormat("es-CL")

const porNombre = (lista: { id: number; nombre: string }[], nombre?: string | null) =>
  lista.find((item) => item.nombre.toLocaleLowerCase("es") === nombre?.toLocaleLowerCase("es"))?.id

interface Props {
  movimiento: MovimientoResponse
  onDone: (actualizado: boolean) => void
}

/** Edicion en linea de un movimiento. Solo envia los campos que cambiaron. */
export function MovimientoEditForm({ movimiento, onDone }: Props) {
  const { categorias, cuentas, editarMovimiento, submittingMovimiento } = useFinanzas()
  const deudasQuery = useDeudas()

  const original = useMemo(
    () => ({
      tipo_movimiento: movimiento.tipo_movimiento,
      tipo_gasto: movimiento.tipo_gasto,
      monto: String(movimiento.monto),
      id_categoria: String(movimiento.id_categoria),
      id_cuenta: String(porNombre(cuentas.map((c) => ({ id: c.id_cuenta, nombre: c.nombre_cuenta })), movimiento.nombre_cuenta) ?? ""),
      descripcion: movimiento.descripcion ?? "",
      created_at: movimiento.created_at.slice(0, 16),
      /** "" = sin deuda. */
      id_deuda: movimiento.id_deuda ? String(movimiento.id_deuda) : "",
    }),
    [movimiento, cuentas],
  )
  const [form, setForm] = useState(original)

  // Una categoria archivada ya no se ofrece, pero el movimiento que la usa debe poder
  // conservarla al editar otros campos.
  const categoriaOptions = useMemo(() => {
    const opciones = categorias.map((c) => ({ value: String(c.id_categoria), label: c.nombre }))
    if (!categorias.some((c) => c.id_categoria === movimiento.id_categoria)) {
      opciones.unshift({ value: String(movimiento.id_categoria), label: movimiento.categoria ?? "Categoria archivada" })
    }
    return opciones
  }, [categorias, movimiento.id_categoria, movimiento.categoria])
  const [error, setError] = useState<string | null>(null)

  // Deudas activas del tipo que corresponde, mas la actual aunque ya este pagada: el abono
  // que la salda debe poder editarse sin perder el vinculo.
  const deudaOptions = useMemo(() => {
    const tipoDeuda = form.tipo_movimiento === "ingreso" ? "me_deben" : "debo"
    const opciones = (deudasQuery.data?.items ?? [])
      .filter(
        (deuda) =>
          deuda.tipo === tipoDeuda && (deuda.estado === "activa" || String(deuda.id_deuda) === original.id_deuda),
      )
      .map((deuda) => ({
        value: String(deuda.id_deuda),
        label: deuda.nombre,
        hint: deuda.estado === "activa" ? `Saldo ${formatCLP(deuda.saldo)}` : "Pagada",
      }))
    return [{ value: "", label: "Ninguna" }, ...opciones]
  }, [deudasQuery.data, form.tipo_movimiento, original.id_deuda])

  const cambios = useMemo(() => {
    const payload: MovimientoPatch = {}
    if (form.tipo_movimiento !== original.tipo_movimiento) payload.tipo_movimiento = form.tipo_movimiento
    if (form.tipo_gasto !== original.tipo_gasto) payload.tipo_gasto = form.tipo_gasto
    if (form.monto !== original.monto) payload.monto = Number(form.monto)
    if (form.id_categoria && form.id_categoria !== original.id_categoria) payload.id_categoria = Number(form.id_categoria)
    if (form.id_cuenta && form.id_cuenta !== original.id_cuenta) payload.id_cuenta = Number(form.id_cuenta)
    if (form.descripcion.trim() !== original.descripcion) payload.descripcion = form.descripcion.trim() || null
    if (form.created_at && form.created_at !== original.created_at) payload.created_at = `${form.created_at}:00`
    if (form.id_deuda !== original.id_deuda) payload.id_deuda = form.id_deuda ? Number(form.id_deuda) : null
    return payload
  }, [form, original])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!Number(form.monto)) {
      setError("El monto debe ser mayor a 0")
      return
    }
    if (Object.keys(cambios).length === 0) {
      onDone(false)
      return
    }
    const result = await editarMovimiento(movimiento.id_transaccion, cambios)
    if (!result.ok) {
      setError(result.message)
      return
    }
    onDone(true)
  }

  const esIngreso = form.tipo_movimiento === "ingreso"

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-6">
      <div role="radiogroup" aria-label="Tipo de movimiento" className="grid grid-cols-2 gap-1 rounded-lg bg-[color:var(--surface-low)] p-1">
        {(["gasto", "ingreso"] as TipoMovimiento[]).map((tipo) => {
          const active = form.tipo_movimiento === tipo
          const Icon = tipo === "ingreso" ? ArrowDownLeft : ArrowUpRight
          return (
            <button
              key={tipo}
              type="button"
              role="radio"
              aria-checked={active}
              // Una deuda de lo que debo no sirve para un ingreso ni al reves.
              onClick={() => setForm((prev) => ({ ...prev, tipo_movimiento: tipo, id_deuda: tipo === prev.tipo_movimiento ? prev.id_deuda : "" }))}
              className={cn("flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold capitalize", !active && "text-muted-foreground")}
              style={active ? { background: `var(--${tipo})`, color: `var(--${tipo}-on)` } : undefined}
            >
              <Icon className="size-4" aria-hidden />
              {tipo}
            </button>
          )
        })}
      </div>

      <div className="flex items-baseline gap-2 border-b-2 border-border pb-2 focus-within:border-foreground">
        <label htmlFor="editar-monto" className="sr-only">
          Monto
        </label>
        <span aria-hidden className="font-display text-3xl text-muted-foreground">
          $
        </span>
        <input
          id="editar-monto"
          inputMode="numeric"
          autoComplete="off"
          value={form.monto ? milesFormatter.format(Number(form.monto)) : ""}
          onChange={(event) => {
            setError(null)
            setForm((prev) => ({ ...prev, monto: event.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 11) }))
          }}
          className="w-full min-w-0 bg-transparent font-display text-4xl leading-none tabular-nums outline-none"
          style={{ color: `var(--${form.tipo_movimiento})` }}
        />
      </div>

      <Campo titulo="Categoria">
        <ChipSelect
          label="Categoria"
          value={form.id_categoria}
          onChange={(value) => setForm((prev) => ({ ...prev, id_categoria: value }))}
          options={categoriaOptions}
        />
      </Campo>

      <Campo titulo="Cuenta">
        <ChipSelect
          label="Cuenta"
          value={form.id_cuenta}
          onChange={(value) => setForm((prev) => ({ ...prev, id_cuenta: value }))}
          options={cuentas.map((c) => ({ value: String(c.id_cuenta), label: c.nombre_cuenta, hint: c.nombre_banco ?? undefined }))}
        />
      </Campo>

      {deudaOptions.length > 1 ? (
        <Campo titulo={form.tipo_movimiento === "ingreso" ? "Cobro de deuda" : "Pago de deuda"}>
          <ChipSelect
            label="Deuda"
            value={form.id_deuda}
            onChange={(value) => {
              setError(null)
              setForm((prev) => ({ ...prev, id_deuda: value }))
            }}
            options={deudaOptions}
          />
        </Campo>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="editar-fecha" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Fecha
          </label>
          <input
            id="editar-fecha"
            type="datetime-local"
            value={form.created_at}
            onChange={(event) => setForm((prev) => ({ ...prev, created_at: event.target.value }))}
            className="h-11 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:border-foreground"
          />
        </div>
        {esIngreso ? null : (
          <div className="flex items-end">
            <button
              type="button"
              aria-pressed={form.tipo_gasto === "fijo"}
              onClick={() => setForm((prev) => ({ ...prev, tipo_gasto: prev.tipo_gasto === "fijo" ? "variable" : "fijo" }))}
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-medium",
                form.tipo_gasto === "fijo" ? "border-highlight bg-highlight text-highlight-foreground" : "border-border text-muted-foreground",
              )}
            >
              <Repeat className="size-4" aria-hidden />
              Gasto fijo
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="editar-nota" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Nota
        </label>
        <input
          id="editar-nota"
          maxLength={250}
          value={form.descripcion}
          onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))}
          className="h-11 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:border-foreground"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="lg" className="h-11 flex-1" disabled={submittingMovimiento}>
          {submittingMovimiento ? "Guardando..." : "Guardar cambios"}
        </Button>
        <Button type="button" size="lg" variant="outline" className="h-11" onClick={() => onDone(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{titulo}</span>
      {children}
    </div>
  )
}
