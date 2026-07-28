"use client"

import { FormEvent, useMemo, useState } from "react"
import { Scale, Trash2, TrendingDown, TrendingUp, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useNutricion } from "@/modules/nutricion/hooks/useNutricion"
import { pesoCreateSchema } from "@/modules/nutricion/schemas/nutricion.schema"

const MODULE_COLOR = "var(--module-nutricion)"

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(value: string) {
  const [year, month, day] = value.split("T")[0].split("-")
  if (!year || !month || !day) return value
  return `${day}-${month}-${year}`
}

export function PesoManager() {
  const { pesos, submitting, loading, crearPeso, eliminarPeso } = useNutricion()
  const [form, setForm] = useState({ fecha_registro: todayISO(), peso_kg: "" })
  const [showForm, setShowForm] = useState(false)

  const sortedPesos = useMemo(
    () => [...pesos].sort((a, b) => (a.fecha_registro < b.fecha_registro ? 1 : -1)),
    [pesos]
  )

  const ultimoPeso = sortedPesos[0]
  const primerPeso = sortedPesos[sortedPesos.length - 1]
  const delta =
    ultimoPeso && primerPeso && ultimoPeso.id_peso !== primerPeso.id_peso
      ? ultimoPeso.peso_kg - primerPeso.peso_kg
      : 0

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = pesoCreateSchema.safeParse({
      fecha_registro: form.fecha_registro,
      peso_kg: Number(form.peso_kg),
    })

    if (!parsed.success) {
      toast.error("Revisa los datos", {
        description: parsed.error.issues[0]?.message ?? "Completa el formulario",
      })
      return
    }

    const result = await crearPeso(parsed.data)
    if (result.ok) {
      toast.success("Peso registrado")
      setForm({ fecha_registro: todayISO(), peso_kg: "" })
      setShowForm(false)
    } else {
      toast.error("No pudimos registrar", { description: result.message })
    }
  }

  const handleDelete = async (idPeso: number) => {
    const result = await eliminarPeso(idPeso)
    if (result.ok) toast.success("Registro eliminado")
    else toast.error("No pudimos eliminar", { description: result.message })
  }

  return (
    <section className="flex flex-col gap-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Scale className="size-3.5" style={{ color: MODULE_COLOR }} />
            Ultimo peso
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {ultimoPeso ? `${ultimoPeso.peso_kg} kg` : "-"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {ultimoPeso ? formatDate(ultimoPeso.fecha_registro) : "Sin registros"}
          </p>
        </article>

        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {delta >= 0 ? (
              <TrendingUp className="size-3.5" style={{ color: MODULE_COLOR }} />
            ) : (
              <TrendingDown className="size-3.5" style={{ color: MODULE_COLOR }} />
            )}
            Variacion
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {sortedPesos.length > 1 ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg` : "-"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Desde el primer registro</p>
        </article>

        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Total registros
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{pesos.length}</p>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Historial completo</p>
        </article>
      </section>

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Nuevo registro</p>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              type="date"
              value={form.fecha_registro}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, fecha_registro: event.target.value }))
              }
              className="h-12 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
            />
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="Peso en kg"
              value={form.peso_kg}
              onChange={(event) => setForm((prev) => ({ ...prev, peso_kg: event.target.value }))}
              className="h-12 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
            />
            <Button type="submit" disabled={submitting} className="h-12 rounded-[1rem] px-5">
              {submitting ? "..." : "Guardar"}
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 rounded-[1.5rem] border-2 border-dashed border-[color:var(--border)] bg-transparent py-3 text-sm font-medium text-muted-foreground transition hover:border-[color:var(--module-nutricion)] hover:text-foreground"
        >
          <Plus className="size-4" />
          Nuevo registro de peso
        </button>
      )}

      <section className="flex flex-col gap-2">
        <p className="font-label px-1 text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
          Historial
        </p>

        {loading ? (
          <div className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-5 text-sm text-muted-foreground shadow-[var(--shadow-airy)]">
            Cargando registros...
          </div>
        ) : sortedPesos.length === 0 ? (
          <div className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-5 text-sm text-muted-foreground shadow-[var(--shadow-airy)]">
            Aun no tienes registros. Agrega el primero usando el formulario.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {sortedPesos.map((peso, index) => {
              const prev = sortedPesos[index + 1]
              const diff = prev ? peso.peso_kg - prev.peso_kg : 0
              return (
                <li
                  key={peso.id_peso}
                  className="flex items-center justify-between gap-3 rounded-[1.25rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)]"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex size-10 items-center justify-center rounded-full"
                      style={{
                        background: `color-mix(in oklch, ${MODULE_COLOR} 14%, transparent)`,
                        color: MODULE_COLOR,
                      }}
                    >
                      <Scale className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{peso.peso_kg} kg</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(peso.fecha_registro)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {prev ? (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-medium",
                          diff > 0
                            ? "bg-tertiary/12 text-tertiary"
                            : diff < 0
                              ? "bg-secondary/12 text-secondary"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {diff > 0 ? "+" : ""}
                        {diff.toFixed(1)} kg
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleDelete(peso.id_peso)}
                      className="rounded-full p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </section>
  )
}
