"use client"

import Link from "next/link"
import { ArrowUpRight, Dumbbell, History, MapPin } from "lucide-react"
import { useEntrenamientos } from "@/modules/entrenamientos/hooks/useEntrenamientos"

export function EntrenamientosHomeOverview() {
  const { entrenamientoActivo } = useEntrenamientos()

  const primaryHref = entrenamientoActivo
    ? "/app/entrenamientos/activo"
    : "/app/entrenamientos/registrar"
  const primaryLabel = entrenamientoActivo
    ? "Continuar entrenamiento activo"
    : "Registrar entrenamiento"
  const primaryEyebrow = entrenamientoActivo ? "Sesion en curso" : "Siguiente paso"
  const primaryDescription = entrenamientoActivo
    ? `Tu sesion actual esta abierta${
        entrenamientoActivo.nombre_gimnasio ? ` en ${entrenamientoActivo.nombre_gimnasio}` : ""
      }. Retomamos desde donde lo dejaste para seguir cargando series.`
    : "Abre una nueva sesion de gym y deja el espacio listo para ir registrando cada serie."

  const secondaryCards = [
    {
      eyebrow: "Contexto",
      title: "Ver gimnasios",
      description: "Revisa el directorio y elige el lugar que mejor acompana tu rutina.",
      href: "/app/entrenamientos/gimnasios",
      icon: MapPin,
    },
    {
      eyebrow: "Diario",
      title: "Entrenamientos anteriores",
      description: "Consulta sesiones cerradas y retoma el hilo de tus ultimos registros.",
      href: "/app/entrenamientos/historico",
      icon: History,
    },
  ]

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <Link
        href={primaryHref}
        className="group relative overflow-hidden rounded-[1.5rem] bg-[color:var(--module-entrenamientos)] p-5 text-[color:var(--tertiary-foreground)] shadow-[var(--shadow-airy-lg)] transition hover:shadow-[var(--shadow-airy-lg)] sm:rounded-[1.75rem] sm:p-7"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl transition-opacity group-hover:opacity-80 sm:size-52"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <div className="max-w-lg space-y-3">
            <p className="font-label text-[0.65rem] uppercase tracking-[0.22em] text-white/70 sm:text-[0.72rem] sm:tracking-[0.24em]">
              {primaryEyebrow}
            </p>
            <h2 className="text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-[2.25rem] sm:leading-[1.05] sm:tracking-[-0.03em]">
              {primaryLabel}
            </h2>
            <p className="text-sm leading-6 text-white/80">{primaryDescription}</p>
          </div>
          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-4">
            <span className="flex size-11 items-center justify-center rounded-[1rem] bg-white/15 backdrop-blur-sm sm:size-14">
              <Dumbbell className="size-5 sm:size-6" />
            </span>
            <span className="inline-flex items-center gap-2 text-sm font-medium transition group-hover:translate-x-0.5">
              Ir ahora
              <ArrowUpRight className="size-4" />
            </span>
          </div>
        </div>
      </Link>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {secondaryCards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group flex flex-col gap-3 rounded-[1.25rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-airy-lg)] sm:gap-4 sm:rounded-[1.5rem] sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className="flex size-10 items-center justify-center rounded-[0.9rem] sm:size-11"
                  style={{
                    background: "color-mix(in oklch, var(--module-entrenamientos) 12%, transparent)",
                    color: "var(--module-entrenamientos)",
                  }}
                >
                  <Icon className="size-4 sm:size-5" />
                </span>
                <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-[color:var(--module-entrenamientos)]" />
              </div>
              <div className="space-y-1.5">
                <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                  {card.eyebrow}
                </p>
                <h3 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  {card.title}
                </h3>
                <p className="text-sm leading-6 text-muted-foreground">{card.description}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
