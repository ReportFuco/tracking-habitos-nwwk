"use client"

import { FormEvent, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { formatCLP } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useMetasGasto } from "@/modules/finanzas/hooks/useFinanzas"
import type { MetasGastoResponse, MetasGastoUpdate } from "@/modules/finanzas/types/finanzas"

const milesFormatter = new Intl.NumberFormat("es-CL")
const etiquetaClass = "text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"

type CategoriaForm = { excluida: boolean; presupuesto: string }

function soloDigitos(valor: string) {
  return valor.replace(/\D/g, "").replace(/^0+/, "").slice(0, 10)
}

/** Meta semanal, que categorias cuentan en la semana y presupuesto semanal de cada una. */
export function MetasGastoForm() {
  const query = useMetasGasto()

  if (query.isError) {
    return (
      <p className="rounded-2xl bg-[color:var(--surface-lowest)] p-4 text-sm shadow-[var(--shadow-airy)]">
        No pudimos cargar tus metas.{" "}
        <button type="button" onClick={() => void query.refetch()} className="font-semibold underline underline-offset-4">
          Reintentar
        </button>
      </p>
    )
  }
  if (!query.data) {
    return <div aria-hidden className="h-96 animate-pulse rounded-2xl bg-[color:var(--surface-low)]" />
  }
  // Se monta con los datos ya cargados: el estado del formulario parte de ellos.
  return <Formulario metas={query.data} guardar={query.guardar} />
}

function Formulario({ metas, guardar }: { metas: MetasGastoResponse; guardar: ReturnType<typeof useMetasGasto>["guardar"] }) {
  const [meta, setMeta] = useState(metas.meta_semanal ? String(metas.meta_semanal) : "")
  const [categorias, setCategorias] = useState<Record<number, CategoriaForm>>(() =>
    Object.fromEntries(
      metas.categorias.map((c) => [c.id_categoria, { excluida: c.excluida, presupuesto: c.presupuesto_semanal ? String(c.presupuesto_semanal) : "" }]),
    ),
  )

  const metaNumero = Number(meta || 0)
  const cambiar = (id: number, cambio: Partial<CategoriaForm>) =>
    setCategorias((actual) => ({ ...actual, [id]: { ...actual[id], ...cambio } }))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const payload: MetasGastoUpdate = { categorias: [] }
    if ((metas.meta_semanal ?? 0) !== metaNumero) payload.meta_semanal = metaNumero || null
    for (const original of metas.categorias) {
      const form = categorias[original.id_categoria]
      const presupuesto = form.excluida ? null : Number(form.presupuesto || 0) || null
      const cambio: NonNullable<MetasGastoUpdate["categorias"]>[number] = { id_categoria: original.id_categoria }
      if (form.excluida !== original.excluida) cambio.excluida = form.excluida
      if (presupuesto !== original.presupuesto_semanal) cambio.presupuesto_semanal = presupuesto
      if (Object.keys(cambio).length > 1) payload.categorias!.push(cambio)
    }
    if (payload.meta_semanal === undefined && payload.categorias!.length === 0) {
      toast.info("No hay cambios que guardar")
      return
    }
    try {
      await guardar.mutateAsync(payload)
      toast.success("Metas guardadas")
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error))
    }
  }

  const cuentan = metas.categorias.filter((c) => !categorias[c.id_categoria].excluida)
  const fuera = metas.categorias.filter((c) => categorias[c.id_categoria].excluida)

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
        <label htmlFor="meta-semanal" className={etiquetaClass}>
          Meta de gasto semanal
        </label>
        <div className="flex items-baseline gap-1 border-b border-border pb-2 focus-within:border-foreground">
          <span className="font-display text-3xl leading-none text-muted-foreground">$</span>
          <input
            id="meta-semanal"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Sin meta"
            value={meta ? milesFormatter.format(metaNumero) : ""}
            onChange={(event) => setMeta(soloDigitos(event.target.value))}
            className="w-full min-w-0 bg-transparent font-display text-4xl leading-none tabular-nums outline-none placeholder:text-muted-foreground/40"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {metaNumero
            ? `Unos ${formatCLP(Math.round(metaNumero / 7))} al dia. El tope de cada dia se ajusta segun lo que llevas gastado en la semana.`
            : "De lunes a domingo, sin contar las categorias que dejes fuera ni los abonos a deudas."}
        </p>
        {metas.sugerencia_semanal ? (
          <p className="text-sm">
            Tu promedio de las ultimas semanas es <strong className="tabular-nums">{formatCLP(metas.sugerencia_semanal)}</strong>.{" "}
            <button
              type="button"
              onClick={() => setMeta(String(Math.round((metas.sugerencia_semanal! * 0.9) / 1000) * 1000))}
              className="font-semibold underline underline-offset-4"
            >
              Proponerme un 10% menos
            </button>
          </p>
        ) : null}
        {metaNumero ? (
          <button type="button" onClick={() => setMeta("")} className="self-start text-sm text-muted-foreground underline underline-offset-4">
            Quitar la meta
          </button>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={etiquetaClass}>Cuentan en la semana</h2>
        <p className="text-sm text-muted-foreground">
          Ponle un presupuesto semanal a las que quieras vigilar. El promedio es de las ultimas 4 semanas.
        </p>
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-[color:var(--surface-lowest)] shadow-[var(--shadow-airy)]">
          {cuentan.map((categoria) => (
            <FilaCategoria
              key={categoria.id_categoria}
              nombre={categoria.nombre}
              promedio={categoria.promedio_semanal}
              form={categorias[categoria.id_categoria]}
              onChange={(cambio) => cambiar(categoria.id_categoria, cambio)}
            />
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={etiquetaClass}>Fuera de la semana</h2>
        <p className="text-sm text-muted-foreground">
          Gastos fijos o compromisos (universidad, arriendo, pago de la tarjeta) que no dicen nada de como va tu semana.
        </p>
        {fuera.length > 0 ? (
          <ul className="divide-y divide-border overflow-hidden rounded-xl bg-[color:var(--surface-lowest)] shadow-[var(--shadow-airy)]">
            {fuera.map((categoria) => (
              <FilaCategoria
                key={categoria.id_categoria}
                nombre={categoria.nombre}
                promedio={categoria.promedio_semanal}
                form={categorias[categoria.id_categoria]}
                onChange={(cambio) => cambiar(categoria.id_categoria, cambio)}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-[color:var(--surface-lowest)] p-3 text-sm text-muted-foreground shadow-[var(--shadow-airy)]">
            Todas las categorias cuentan.
          </p>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Te avisamos al llegar al 80% y al pasarte, y el domingo en la noche te mandamos el resumen de la semana. Lo
        activas en{" "}
        <Link href="/app/perfil/notificaciones" className="font-semibold underline underline-offset-4">
          Perfil › Notificaciones
        </Link>
        .
      </p>

      <Button type="submit" size="lg" disabled={guardar.isPending} className="sm:self-start">
        {guardar.isPending ? "Guardando..." : "Guardar metas"}
      </Button>
    </form>
  )
}

function FilaCategoria({
  nombre,
  promedio,
  form,
  onChange,
}: {
  nombre: string
  promedio: number
  form: CategoriaForm
  onChange: (cambio: Partial<CategoriaForm>) => void
}) {
  return (
    <li className="flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{nombre}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {promedio > 0 ? `${formatCLP(promedio)} por semana` : "Sin gastos recientes"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!form.excluida}
          aria-label={`${nombre} cuenta en la semana`}
          onClick={() => onChange({ excluida: !form.excluida })}
          className={cn(
            "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            !form.excluida ? "bg-primary" : "bg-[color:var(--surface-variant)]",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "inline-block size-5 rounded-full bg-[color:var(--surface-lowest)] transition-transform",
              !form.excluida ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>
      </div>
      {!form.excluida ? (
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Presupuesto semanal</span>
          <span className="flex w-36 items-center gap-1 rounded-md border border-border px-2 focus-within:border-foreground">
            <span className="text-muted-foreground">$</span>
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="Sin tope"
              value={form.presupuesto ? milesFormatter.format(Number(form.presupuesto)) : ""}
              onChange={(event) => onChange({ presupuesto: soloDigitos(event.target.value) })}
              className="h-9 w-full min-w-0 bg-transparent text-right tabular-nums outline-none placeholder:text-muted-foreground"
            />
          </span>
        </label>
      ) : null}
    </li>
  )
}
