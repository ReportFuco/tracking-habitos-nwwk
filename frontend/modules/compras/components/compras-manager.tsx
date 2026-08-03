"use client"

import { FormEvent, useMemo, useState } from "react"
import { MapPin, Plus, Receipt, ShoppingBag, Store, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EditorialSelect } from "@/components/forms/editorial-form"
import { cn } from "@/lib/utils"
import { useCompras } from "@/modules/compras/hooks/useCompras"
import { compraCreateSchema } from "@/modules/compras/schemas/compras.schema"

const MODULE_COLOR = "var(--module-compras)"

function nowLocalISO() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("es-CL", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))
  } catch {
    return value
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value)
}

const initialForm = {
  id_local: "",
  fecha_compra: nowLocalISO(),
}

export function ComprasManager() {
  const { compras, locales, submitting, loading, crearCompra, eliminarCompra } = useCompras()
  const [form, setForm] = useState(initialForm)
  const [showForm, setShowForm] = useState(false)

  const sortedCompras = useMemo(
    () => [...compras].sort((a, b) => (a.fecha_compra < b.fecha_compra ? 1 : -1)),
    [compras]
  )

  const totalGastado = sortedCompras.reduce((acc, compra) => acc + compra.total_compra, 0)
  const localesUnicos = new Set(sortedCompras.map((c) => c.nombre_local).filter(Boolean)).size

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const fecha =
      form.fecha_compra.length === 16 ? `${form.fecha_compra}:00` : form.fecha_compra
    const parsed = compraCreateSchema.safeParse({
      id_local: Number(form.id_local),
      fecha_compra: form.fecha_compra,
    })

    if (!parsed.success) {
      toast.error("Revisa los datos", {
        description: parsed.error.issues[0]?.message ?? "Completa el formulario",
      })
      return
    }

    const result = await crearCompra({
      id_local: parsed.data.id_local,
      fecha_compra: fecha,
    })

    if (result.ok) {
      toast.success("Compra registrada")
      setForm({ id_local: "", fecha_compra: nowLocalISO() })
      setShowForm(false)
    } else {
      toast.error("No pudimos registrar", { description: result.message })
    }
  }

  const handleDelete = async (idCompra: number) => {
    const result = await eliminarCompra(idCompra)
    if (result.ok) toast.success("Compra eliminada")
    else toast.error("No pudimos eliminar", { description: result.message })
  }

  return (
    <section className="flex flex-col gap-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <ShoppingBag className="size-3.5" style={{ color: MODULE_COLOR }} />
            Compras
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {sortedCompras.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Registros totales</p>
        </article>

        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Receipt className="size-3.5" style={{ color: MODULE_COLOR }} />
            Total
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight sm:text-3xl">
            {formatCurrency(totalGastado)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Acumulado conocido</p>
        </article>

        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Store className="size-3.5" style={{ color: MODULE_COLOR }} />
            Locales
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{localesUnicos}</p>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Distintos visitados</p>
        </article>
      </section>

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Nueva compra</p>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <LabeledField label="Local">
              <EditorialSelect
                value={form.id_local}
                onChange={(event) => setForm((prev) => ({ ...prev, id_local: event.target.value }))}
                className="h-12"
                required
              >
                <option value="">Selecciona un local</option>
                {locales.map((local) => (
                  <option key={local.id_local} value={local.id_local}>
                    {local.nombre_local}
                    {local.nombre_cadena ? ` - ${local.nombre_cadena}` : ""}
                  </option>
                ))}
              </EditorialSelect>
            </LabeledField>

            <LabeledField label="Fecha y hora">
              <Input
                type="datetime-local"
                value={form.fecha_compra}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, fecha_compra: event.target.value }))
                }
                className="h-12 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
              />
            </LabeledField>
          </div>

          <Button type="submit" disabled={submitting} className="mt-4 h-12 w-full rounded-[1rem]">
            {submitting ? "Guardando..." : "Registrar compra"}
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 rounded-[1.5rem] border-2 border-dashed border-[color:var(--border)] bg-transparent py-3 text-sm font-medium text-muted-foreground transition hover:border-[color:var(--module-compras)] hover:text-foreground"
        >
          <Plus className="size-4" />
          Nueva compra
        </button>
      )}

      <section className="flex flex-col gap-2">
        <p className="font-label px-1 text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
          Historial
        </p>

        {loading ? (
          <div className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-5 text-sm text-muted-foreground shadow-[var(--shadow-airy)]">
            Cargando compras...
          </div>
        ) : sortedCompras.length === 0 ? (
          <div className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-5 text-sm text-muted-foreground shadow-[var(--shadow-airy)]">
            Aun no tienes compras registradas. Agrega tu primera compra para empezar tu historial.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {sortedCompras.map((compra) => (
              <li
                key={compra.id_compra}
                className="rounded-[1.25rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: `color-mix(in oklch, ${MODULE_COLOR} 14%, transparent)`,
                        color: MODULE_COLOR,
                      }}
                    >
                      <ShoppingBag className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {compra.nombre_local ?? `Local #${compra.id_local}`}
                      </p>
                      {compra.nombre_cadena ? (
                        <p className="truncate text-xs text-muted-foreground">
                          <MapPin className="mr-1 inline-block size-3 align-[-2px]" />
                          {compra.nombre_cadena}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(compra.fecha_compra)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-semibold"
                      )}
                      style={{
                        background: `color-mix(in oklch, ${MODULE_COLOR} 14%, transparent)`,
                        color: MODULE_COLOR,
                      }}
                    >
                      {formatCurrency(compra.total_compra)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(compra.id_compra)}
                      className="rounded-full p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="font-label text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}
