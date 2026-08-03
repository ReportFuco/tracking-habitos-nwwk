"use client"

import { FormEvent, useMemo, useState } from "react"
import { Target, Trash2, Plus, Flame, Beef, Wheat, Droplet } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useNutricion } from "@/modules/nutricion/hooks/useNutricion"
import { metaCreateSchema } from "@/modules/nutricion/schemas/nutricion.schema"

const MODULE_COLOR = "var(--module-nutricion)"

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(base: string, days: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha"
  const [year, month, day] = value.split("T")[0].split("-")
  if (!year || !month || !day) return value
  return `${day}-${month}-${year}`
}

const initialForm = {
  fecha_inicio: todayISO(),
  fecha_fin: addDays(todayISO(), 30),
  calorias_objetivo: "",
  proteinas_objetivo: "",
  carbohidratos_objetivo: "",
  grasas_objetivo: "",
}

export function MetasManager() {
  const { metas, submitting, loading, crearMeta, eliminarMeta } = useNutricion()
  const [form, setForm] = useState(initialForm)
  const [showForm, setShowForm] = useState(false)

  const today = todayISO()

  const sortedMetas = useMemo(
    () => [...metas].sort((a, b) => (a.fecha_inicio < b.fecha_inicio ? 1 : -1)),
    [metas]
  )

  const metaActiva = sortedMetas.find(
    (m) => m.fecha_inicio <= today && (m.fecha_fin === null || today <= m.fecha_fin)
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = metaCreateSchema.safeParse({
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin,
      calorias_objetivo: Number(form.calorias_objetivo),
      proteinas_objetivo: Number(form.proteinas_objetivo),
      carbohidratos_objetivo: Number(form.carbohidratos_objetivo),
      grasas_objetivo: Number(form.grasas_objetivo),
    })

    if (!parsed.success) {
      toast.error("Revisa los datos", {
        description: parsed.error.issues[0]?.message ?? "Completa el formulario",
      })
      return
    }

    if (parsed.data.fecha_fin <= parsed.data.fecha_inicio) {
      toast.error("La fecha fin debe ser posterior a la fecha inicio")
      return
    }

    const result = await crearMeta(parsed.data)
    if (result.ok) {
      toast.success("Meta creada")
      setForm(initialForm)
      setShowForm(false)
    } else {
      toast.error("No pudimos crear la meta", { description: result.message })
    }
  }

  const handleDelete = async (idMeta: number) => {
    const result = await eliminarMeta(idMeta)
    if (result.ok) toast.success("Meta eliminada")
    else toast.error("No pudimos eliminar", { description: result.message })
  }

  return (
    <section className="flex flex-col gap-4">
      {metaActiva ? (
        <article
          className="rounded-[1.5rem] p-4 shadow-[var(--shadow-airy)] sm:p-5"
          style={{
            background: `color-mix(in oklch, ${MODULE_COLOR} 10%, var(--surface-lowest))`,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <Target className="size-3.5" style={{ color: MODULE_COLOR }} />
                Meta activa
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDate(metaActiva.fecha_inicio)} - {formatDate(metaActiva.fecha_fin)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MacroTile icon={Flame} label="kcal" value={metaActiva.calorias_objetivo} />
            <MacroTile icon={Beef} label="proteina g" value={metaActiva.proteinas_objetivo} />
            <MacroTile icon={Wheat} label="carbos g" value={metaActiva.carbohidratos_objetivo} />
            <MacroTile icon={Droplet} label="grasas g" value={metaActiva.grasas_objetivo} />
          </div>
        </article>
      ) : (
        <div className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 text-sm text-muted-foreground shadow-[var(--shadow-airy)]">
          No tienes una meta activa para hoy. Crea una para empezar a trackear objetivos.
        </div>
      )}

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Nueva meta</p>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <LabeledInput
              label="Fecha inicio"
              type="date"
              value={form.fecha_inicio}
              onChange={(value) => setForm((prev) => ({ ...prev, fecha_inicio: value }))}
            />
            <LabeledInput
              label="Fecha fin"
              type="date"
              value={form.fecha_fin}
              onChange={(value) => setForm((prev) => ({ ...prev, fecha_fin: value }))}
            />
            <LabeledInput
              label="Calorias (kcal)"
              type="number"
              inputMode="numeric"
              placeholder="2200"
              value={form.calorias_objetivo}
              onChange={(value) => setForm((prev) => ({ ...prev, calorias_objetivo: value }))}
            />
            <LabeledInput
              label="Proteinas (g)"
              type="number"
              inputMode="numeric"
              placeholder="160"
              value={form.proteinas_objetivo}
              onChange={(value) => setForm((prev) => ({ ...prev, proteinas_objetivo: value }))}
            />
            <LabeledInput
              label="Carbohidratos (g)"
              type="number"
              inputMode="numeric"
              placeholder="220"
              value={form.carbohidratos_objetivo}
              onChange={(value) => setForm((prev) => ({ ...prev, carbohidratos_objetivo: value }))}
            />
            <LabeledInput
              label="Grasas (g)"
              type="number"
              inputMode="numeric"
              placeholder="70"
              value={form.grasas_objetivo}
              onChange={(value) => setForm((prev) => ({ ...prev, grasas_objetivo: value }))}
            />
          </div>

          <Button type="submit" disabled={submitting} className="mt-4 h-12 w-full rounded-[1rem]">
            {submitting ? "Guardando..." : "Crear meta"}
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 rounded-[1.5rem] border-2 border-dashed border-[color:var(--border)] bg-transparent py-3 text-sm font-medium text-muted-foreground transition hover:border-[color:var(--module-nutricion)] hover:text-foreground"
        >
          <Plus className="size-4" />
          Nueva meta nutricional
        </button>
      )}

      <section className="flex flex-col gap-2">
        <p className="font-label px-1 text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
          Historial de metas
        </p>

        {loading ? (
          <div className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-5 text-sm text-muted-foreground shadow-[var(--shadow-airy)]">
            Cargando metas...
          </div>
        ) : sortedMetas.length === 0 ? (
          <div className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-5 text-sm text-muted-foreground shadow-[var(--shadow-airy)]">
            Aun no tienes metas registradas.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {sortedMetas.map((meta) => {
              const activa =
                meta.fecha_inicio <= today && (meta.fecha_fin === null || today <= meta.fecha_fin)
              return (
                <li
                  key={meta.id_meta}
                  className="rounded-[1.25rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {meta.calorias_objetivo ?? "—"} kcal / dia
                        </p>
                        {activa ? (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em]"
                            style={{
                              background: `color-mix(in oklch, ${MODULE_COLOR} 14%, transparent)`,
                              color: MODULE_COLOR,
                            }}
                          >
                            Activa
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(meta.fecha_inicio)} - {formatDate(meta.fecha_fin)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(meta.id_meta)}
                      className="rounded-full p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <span>P {meta.proteinas_objetivo ?? "—"}g</span>
                    <span>C {meta.carbohidratos_objetivo ?? "—"}g</span>
                    <span>G {meta.grasas_objetivo ?? "—"}g</span>
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

function MacroTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target
  label: string
  value: number | null
}) {
  return (
    <div className={cn("rounded-[1rem] bg-[color:var(--surface-lowest)] p-3")}>
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="size-3" style={{ color: MODULE_COLOR }} />
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">{value ?? "—"}</p>
    </div>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  ...props
}: {
  label: string
  value: string
  onChange: (value: string) => void
} & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  return (
    <div className="space-y-1.5">
      <label className="font-label text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </label>
      <Input
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
      />
    </div>
  )
}
