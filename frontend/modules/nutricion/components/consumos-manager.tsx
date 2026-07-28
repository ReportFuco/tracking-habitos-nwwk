"use client"

import { FormEvent, useMemo, useState } from "react"
import { Apple, Plus, Trash2, UtensilsCrossed } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EditorialSelect } from "@/components/forms/editorial-form"
import { cn } from "@/lib/utils"
import { useNutricion } from "@/modules/nutricion/hooks/useNutricion"
import {
  consumoCreateSchema,
  TIPOS_COMIDA,
} from "@/modules/nutricion/schemas/nutricion.schema"
import { TipoComida } from "@/modules/nutricion/types/nutricion"

const MODULE_COLOR = "var(--module-nutricion)"

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

function dayKey(value: string) {
  return value.slice(0, 10)
}

const initialForm = {
  fecha_consumo: nowLocalISO(),
  tipo_comida: "almuerzo" as TipoComida,
  observacion: "",
}

export function ConsumosManager() {
  const { consumos, submitting, loading, crearConsumo, eliminarConsumo } = useNutricion()
  const [form, setForm] = useState(initialForm)
  const [showForm, setShowForm] = useState(false)

  const sortedConsumos = useMemo(
    () => [...consumos].sort((a, b) => (a.fecha_consumo < b.fecha_consumo ? 1 : -1)),
    [consumos]
  )

  const grouped = useMemo(() => {
    const map = new Map<string, typeof sortedConsumos>()
    for (const consumo of sortedConsumos) {
      const key = dayKey(consumo.fecha_consumo)
      const list = map.get(key) ?? []
      list.push(consumo)
      map.set(key, list)
    }
    return Array.from(map.entries())
  }, [sortedConsumos])

  const today = new Date().toISOString().slice(0, 10)
  const consumosHoy = sortedConsumos.filter((c) => dayKey(c.fecha_consumo) === today).length

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const fechaValue = form.fecha_consumo.length === 16 ? `${form.fecha_consumo}:00` : form.fecha_consumo

    const parsed = consumoCreateSchema.safeParse({
      fecha_consumo: form.fecha_consumo,
      tipo_comida: form.tipo_comida,
      observacion: form.observacion,
    })

    if (!parsed.success) {
      toast.error("Revisa los datos", {
        description: parsed.error.issues[0]?.message ?? "Completa el formulario",
      })
      return
    }

    const result = await crearConsumo({
      fecha_consumo: fechaValue,
      tipo_comida: parsed.data.tipo_comida,
      observacion: parsed.data.observacion || null,
    })

    if (result.ok) {
      toast.success("Consumo registrado")
      setForm({ ...initialForm, fecha_consumo: nowLocalISO() })
      setShowForm(false)
    } else {
      toast.error("No pudimos registrar", { description: result.message })
    }
  }

  const handleDelete = async (idConsumo: number) => {
    const result = await eliminarConsumo(idConsumo)
    if (result.ok) toast.success("Consumo eliminado")
    else toast.error("No pudimos eliminar", { description: result.message })
  }

  return (
    <section className="flex flex-col gap-4">
      <section className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Apple className="size-3.5" style={{ color: MODULE_COLOR }} />
            Consumos hoy
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{consumosHoy}</p>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Registros del dia actual</p>
        </article>

        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <UtensilsCrossed className="size-3.5" style={{ color: MODULE_COLOR }} />
            Total registros
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {sortedConsumos.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Historial completo</p>
        </article>
      </section>

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Nuevo consumo</p>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <LabeledField label="Fecha y hora">
              <Input
                type="datetime-local"
                value={form.fecha_consumo}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, fecha_consumo: event.target.value }))
                }
                className="h-12 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
              />
            </LabeledField>

            <LabeledField label="Tipo de comida">
              <EditorialSelect
                value={form.tipo_comida}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, tipo_comida: event.target.value as TipoComida }))
                }
                className="h-12"
              >
                {TIPOS_COMIDA.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </EditorialSelect>
            </LabeledField>
          </div>

          <LabeledField label="Observacion" className="mt-3">
            <Input
              placeholder="Opcional"
              value={form.observacion}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, observacion: event.target.value }))
              }
              className="h-12 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
            />
          </LabeledField>

          <Button type="submit" disabled={submitting} className="mt-4 h-12 w-full rounded-[1rem]">
            {submitting ? "Guardando..." : "Registrar consumo"}
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 rounded-[1.5rem] border-2 border-dashed border-[color:var(--border)] bg-transparent py-3 text-sm font-medium text-muted-foreground transition hover:border-[color:var(--module-nutricion)] hover:text-foreground"
        >
          <Plus className="size-4" />
          Nuevo consumo
        </button>
      )}

      <section className="flex flex-col gap-3">
        {loading ? (
          <div className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-5 text-sm text-muted-foreground shadow-[var(--shadow-airy)]">
            Cargando consumos...
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-5 text-sm text-muted-foreground shadow-[var(--shadow-airy)]">
            Aun no tienes consumos registrados.
          </div>
        ) : (
          grouped.map(([day, items]) => (
            <div key={day} className="flex flex-col gap-2">
              <p className="font-label px-1 text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
                {formatDay(day)}
              </p>
              <ul className="flex flex-col gap-2">
                {items.map((consumo) => (
                  <li
                    key={consumo.id_consumo}
                    className="rounded-[1.25rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span
                          className="flex size-10 shrink-0 items-center justify-center rounded-full"
                          style={{
                            background: `color-mix(in oklch, ${MODULE_COLOR} 14%, transparent)`,
                            color: MODULE_COLOR,
                          }}
                        >
                          <UtensilsCrossed className="size-4" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.18em]"
                              )}
                              style={{
                                background: `color-mix(in oklch, ${MODULE_COLOR} 14%, transparent)`,
                                color: MODULE_COLOR,
                              }}
                            >
                              {consumo.tipo_comida}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {formatDateTime(consumo.fecha_consumo)}
                          </p>
                          {consumo.observacion ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {consumo.observacion}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(consumo.id_consumo)}
                        className="rounded-full p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </section>
  )
}

function formatDay(dayIso: string) {
  try {
    return new Intl.DateTimeFormat("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(dayIso))
  } catch {
    return dayIso
  }
}

function LabeledField({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="font-label text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}
