"use client"

import Link from "next/link"
import { ArrowRight, Apple, Scale, Target, ClipboardList } from "lucide-react"
import { cn } from "@/lib/utils"
import { useNutricion } from "@/modules/nutricion/hooks/useNutricion"

const MODULE_COLOR = "var(--module-nutricion)"

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function NutricionHomeOverview() {
  const { consumos, metas, pesos, loading } = useNutricion()

  const today = todayISO()
  const consumosHoy = consumos.filter((c) => c.fecha_consumo.slice(0, 10) === today).length
  const ultimoPeso = pesos[0]?.peso_kg ?? null
  const metaActiva =
    metas.find((m) => m.fecha_inicio <= today && (m.fecha_fin === null || today <= m.fecha_fin)) ??
    metas[0]

  const tiles = [
    {
      href: "/app/nutricion/consumos",
      icon: Apple,
      eyebrow: "Frente 01",
      title: "Consumos del dia",
      description: "Registra lo que comes por comida y producto para armar tu historial real.",
      cta: "Ir a consumos",
      secondary: null,
    },
    {
      href: "/app/nutricion/peso",
      icon: Scale,
      eyebrow: "Frente 02",
      title: "Peso corporal",
      description: "Anota tu peso cada cierto tiempo para ver la tendencia a lo largo del mes.",
      cta: "Ir a peso",
      secondary: null,
    },
    {
      href: "/app/nutricion/metas",
      icon: Target,
      eyebrow: "Frente 03",
      title: "Metas nutricionales",
      description: "Define objetivos de kcal, proteina, grasas y carbos para el periodo que elijas.",
      cta: "Ir a metas",
      secondary: null,
    },
    {
      href: "/app/nutricion/tabla",
      icon: ClipboardList,
      eyebrow: "Apoyo",
      title: "Tabla nutricional",
      description: "Consulta la tabla de productos con macros y porciones para tus registros.",
      cta: "Ver tabla",
      secondary: null,
    },
  ] as const

  return (
    <section className="flex flex-col gap-5">
      <section className="grid gap-3 sm:grid-cols-3">
        <article
          className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5"
          style={{ boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${MODULE_COLOR} 8%, transparent)` }}
        >
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Apple className="size-3.5" style={{ color: MODULE_COLOR }} />
            Consumos hoy
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {loading ? "-" : consumosHoy}
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Registros del dia</p>
        </article>

        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Scale className="size-3.5" style={{ color: MODULE_COLOR }} />
            Ultimo peso
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {loading ? "-" : ultimoPeso ? `${ultimoPeso} kg` : "-"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {pesos.length > 0 ? "Ultimo registro" : "Sin registros aun"}
          </p>
        </article>

        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Target className="size-3.5" style={{ color: MODULE_COLOR }} />
            Meta kcal
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {loading ? "-" : metaActiva ? metaActiva.calorias_objetivo ?? "-" : "-"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {metaActiva ? "Meta activa" : "Sin meta activa"}
          </p>
        </article>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <Link
              key={tile.href}
              href={tile.href}
              className={cn(
                "group flex flex-col gap-3 rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] transition active:scale-[0.99] sm:p-5"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className="flex size-10 items-center justify-center rounded-full"
                  style={{
                    background: `color-mix(in oklch, ${MODULE_COLOR} 14%, transparent)`,
                    color: MODULE_COLOR,
                  }}
                >
                  <Icon className="size-4" />
                </span>
                <span className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                  {tile.eyebrow}
                </span>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  {tile.title}
                </h3>
                <p className="text-sm leading-5 text-muted-foreground">{tile.description}</p>
              </div>
              <div
                className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium transition group-hover:translate-x-0.5"
                style={{ color: MODULE_COLOR }}
              >
                {tile.cta}
                <ArrowRight className="size-4" />
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
