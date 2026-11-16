"use client"

import { FormEvent, useMemo, useState } from "react"
import { Plus, Sparkles, Trash2, UtensilsCrossed, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChipSelect } from "@/components/forms/chip-select"
import { cn } from "@/lib/utils"
import { AlimentoPicker, type AlimentoElegido } from "@/modules/nutricion/components/alimento-picker"
import { ResumenDiario } from "@/modules/nutricion/components/resumen-diario"
import { useNutricion } from "@/modules/nutricion/hooks/useNutricion"
import { fechaLocal, formatearKcal } from "@/modules/nutricion/lib/calorias"
import { consumoCreateSchema, TIPOS_COMIDA } from "@/modules/nutricion/schemas/nutricion.schema"
import type { ConsumoDetalleResponse, ConsumoResponse, TipoComida } from "@/modules/nutricion/types/nutricion"

const MODULE_COLOR = "var(--module-nutricion)"

const inputClass =
  "h-12 rounded-lg border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"

function nowLocalISO() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

/** Sugerencia de tipo de comida segun la hora, para ahorrar un toque. */
function tipoSegunHora(date = new Date()): TipoComida {
  const h = date.getHours()
  if (h < 5) return "snack"
  if (h < 11) return "desayuno"
  if (h < 12) return "colacion"
  if (h < 16) return "almuerzo"
  if (h < 20) return "once"
  return "cena"
}

function formatHora(value: string) {
  return value.slice(11, 16)
}

function dayKey(value: string) {
  return value.slice(0, 10)
}

function formatCantidad(detalle: Pick<ConsumoDetalleResponse, "cantidad_consumida" | "unidad_consumida">) {
  const cantidad = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(detalle.cantidad_consumida)
  return `${cantidad} ${detalle.unidad_consumida}`
}

function nuevoFormulario() {
  return { fecha_consumo: nowLocalISO(), tipo_comida: tipoSegunHora(), observacion: "" }
}

export function ConsumosManager({ abrirFormulario = false }: { abrirFormulario?: boolean }) {
  const { consumos, submitting, loading, crearConsumo, eliminarConsumo } = useNutricion()
  const [form, setForm] = useState(nuevoFormulario)
  const [alimentos, setAlimentos] = useState<AlimentoElegido[]>([])
  const [showForm, setShowForm] = useState(abrirFormulario)

  const grouped = useMemo(() => {
    const sorted = [...consumos].sort((a, b) => (a.fecha_consumo < b.fecha_consumo ? 1 : -1))
    const map = new Map<string, ConsumoResponse[]>()
    for (const consumo of sorted) {
      const key = dayKey(consumo.fecha_consumo)
      map.set(key, [...(map.get(key) ?? []), consumo])
    }
    return Array.from(map.entries())
  }, [consumos])

  const totalNuevo = alimentos.reduce((suma, a) => suma + (a.calorias ?? 0), 0)

  const cerrarFormulario = () => {
    setShowForm(false)
    setAlimentos([])
    setForm(nuevoFormulario())
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = consumoCreateSchema.safeParse(form)
    if (!parsed.success) {
      toast.error("Revisa los datos", {
        description: parsed.error.issues[0]?.message ?? "Completa el formulario",
      })
      return
    }
    const fecha = form.fecha_consumo.length === 16 ? `${form.fecha_consumo}:00` : form.fecha_consumo
    const result = await crearConsumo({
      fecha_consumo: fecha,
      tipo_comida: parsed.data.tipo_comida,
      observacion: parsed.data.observacion || null,
      detalles: alimentos.map((a) => a.item),
    })
    if (result.ok) {
      toast.success("Comida registrada")
      cerrarFormulario()
    } else {
      toast.error("No pudimos registrar", { description: result.message })
    }
  }

  const handleDelete = async (idConsumo: number) => {
    const result = await eliminarConsumo(idConsumo)
    if (result.ok) toast.success("Comida eliminada")
    else toast.error("No pudimos eliminar", { description: result.message })
  }

  return (
    <section className="flex flex-col gap-4">
      <ResumenDiario />

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Nueva comida</p>
            <button type="button" onClick={cerrarFormulario} className="text-xs text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
          </div>

          <LabeledField label="Tipo de comida" className="mt-3">
            <ChipSelect
              label="Tipo de comida"
              options={TIPOS_COMIDA.map((tipo) => ({ value: tipo, label: tipo }))}
              value={form.tipo_comida}
              onChange={(tipo) => setForm((prev) => ({ ...prev, tipo_comida: tipo as TipoComida }))}
            />
          </LabeledField>

          <LabeledField label="Fecha y hora" className="mt-3">
            <Input
              type="datetime-local"
              value={form.fecha_consumo}
              onChange={(event) => setForm((prev) => ({ ...prev, fecha_consumo: event.target.value }))}
              // Safari en iPhone le da al datetime-local un ancho propio que ignora w-full y lo
              // saca de la tarjeta; sin la apariencia nativa respeta el ancho del contenedor.
              className={cn(
                inputClass,
                "block min-w-0 max-w-full appearance-none [&::-webkit-date-and-time-value]:text-left",
              )}
            />
          </LabeledField>

          <LabeledField label="Que comiste" className="mt-4">
            {alimentos.length > 0 ? (
              <ul className="mb-2 flex flex-col gap-1.5">
                {alimentos.map((alimento, index) => (
                  <li
                    key={`${alimento.nombre}-${index}`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-[color:var(--surface-variant)] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{alimento.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCantidad(alimento.item)} ·{" "}
                        {alimento.calorias !== null ? `${formatearKcal(alimento.calorias)} kcal` : "sin calorias"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAlimentos((prev) => prev.filter((_, i) => i !== index))}
                      className="rounded-full p-1.5 text-muted-foreground hover:text-destructive"
                      aria-label={`Quitar ${alimento.nombre}`}
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <AlimentoPicker onAgregar={(alimento) => setAlimentos((prev) => [...prev, alimento])} />
          </LabeledField>

          <LabeledField label="Observacion" className="mt-3">
            <Input
              placeholder="Opcional"
              value={form.observacion}
              onChange={(event) => setForm((prev) => ({ ...prev, observacion: event.target.value }))}
              className={inputClass}
            />
          </LabeledField>

          <Button type="submit" disabled={submitting} className="mt-4 h-12 w-full rounded-lg">
            {submitting
              ? "Guardando..."
              : alimentos.length > 0
                ? `Registrar comida · ${formatearKcal(totalNuevo)} kcal`
                : "Registrar comida"}
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[color:var(--border)] bg-transparent py-3 text-sm font-medium text-muted-foreground transition hover:border-[color:var(--module-nutricion)] hover:text-foreground"
        >
          <Plus className="size-4" />
          Nueva comida
        </button>
      )}

      <section className="flex flex-col gap-3">
        {loading ? (
          <div className="rounded-2xl bg-[color:var(--surface-lowest)] p-5 text-sm text-muted-foreground shadow-[var(--shadow-airy)]">
            Cargando comidas...
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-2xl bg-[color:var(--surface-lowest)] p-5 text-sm text-muted-foreground shadow-[var(--shadow-airy)]">
            Aun no tienes comidas registradas.
          </div>
        ) : (
          grouped.map(([day, items]) => {
            const totalDia = items.reduce((suma, c) => suma + (c.total_calorias ?? 0), 0)
            return (
              <div key={day} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between px-1">
                  <p className="font-label text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
                    {day === fechaLocal() ? "Hoy" : formatDay(day)}
                  </p>
                  {totalDia > 0 ? (
                    <p className="text-xs font-medium text-muted-foreground">{formatearKcal(totalDia)} kcal</p>
                  ) : null}
                </div>
                <ul className="flex flex-col gap-2">
                  {items.map((consumo) => (
                    <ComidaCard key={consumo.id_consumo} consumo={consumo} onDelete={() => handleDelete(consumo.id_consumo)} />
                  ))}
                </ul>
              </div>
            )
          })
        )}
      </section>
    </section>
  )
}

function ComidaCard({ consumo, onDelete }: { consumo: ConsumoResponse; onDelete: () => void }) {
  const { crearConsumoDetalle, eliminarConsumoDetalle, submitting } = useNutricion()
  const [agregando, setAgregando] = useState(false)

  const agregar = async ({ item }: AlimentoElegido) => {
    const result = await crearConsumoDetalle({ ...item, id_consumo: consumo.id_consumo })
    if (result.ok) {
      toast.success("Alimento agregado")
      setAgregando(false)
    } else {
      toast.error("No pudimos agregar", { description: result.message })
    }
  }

  const quitar = async (detalle: ConsumoDetalleResponse) => {
    const result = await eliminarConsumoDetalle(detalle.id_consumo_detalle)
    if (!result.ok) toast.error("No pudimos quitar", { description: result.message })
  }

  return (
    <li className="rounded-xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-md"
            style={{ background: `color-mix(in oklch, ${MODULE_COLOR} 14%, transparent)`, color: MODULE_COLOR }}
          >
            <UtensilsCrossed className="size-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex rounded-sm px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.18em]"
                style={{ background: `color-mix(in oklch, ${MODULE_COLOR} 14%, transparent)`, color: MODULE_COLOR }}
              >
                {consumo.tipo_comida}
              </span>
              <span className="text-xs text-muted-foreground">{formatHora(consumo.fecha_consumo)}</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {consumo.total_calorias !== null ? `${formatearKcal(consumo.total_calorias)} kcal` : "Sin calorias"}
            </p>
            {consumo.observacion ? <p className="mt-1 text-xs text-muted-foreground">{consumo.observacion}</p> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-full p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
          aria-label="Eliminar comida"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {consumo.detalles.length > 0 ? (
        <ul className="mt-3 flex flex-col divide-y divide-[color:var(--border)] border-t border-[color:var(--border)]">
          {consumo.detalles.map((detalle) => (
            <li key={detalle.id_consumo_detalle} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm text-foreground">
                  {detalle.nombre}
                  {detalle.estimado ? (
                    <Sparkles className="size-3.5 shrink-0 text-muted-foreground" aria-label="Estimado" />
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">{formatCantidad(detalle)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className={cn("text-xs", detalle.calorias === null ? "text-muted-foreground" : "font-medium text-foreground")}>
                  {detalle.calorias !== null ? `${detalle.estimado ? "≈ " : ""}${formatearKcal(detalle.calorias)} kcal` : "sin tabla"}
                </span>
                <button
                  type="button"
                  onClick={() => quitar(detalle)}
                  disabled={submitting}
                  className="rounded-full p-1.5 text-muted-foreground hover:text-destructive"
                  aria-label={`Quitar ${detalle.nombre}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {agregando ? (
        <div className="mt-3">
          <AlimentoPicker onAgregar={agregar} disabled={submitting} />
          <button
            type="button"
            onClick={() => setAgregando(false)}
            className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAgregando(true)}
          className="mt-2 flex items-center gap-1.5 text-xs font-medium"
          style={{ color: MODULE_COLOR }}
        >
          <Plus className="size-3.5" />
          Agregar alimento
        </button>
      )}
    </li>
  )
}

function formatDay(dayIso: string) {
  try {
    // Mediodia local: new Date("2026-11-16") es medianoche UTC y en Chile mostraria el dia anterior.
    return new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" }).format(
      new Date(`${dayIso}T12:00:00`),
    )
  } catch {
    return dayIso
  }
}

function LabeledField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="font-label text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
