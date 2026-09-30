"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Apple, ArrowDownLeft, ArrowUpRight, Dumbbell, Wallet } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { datePart, formatMonth, formatShortDate, startOfWeek, toLocalIsoDate } from "@/lib/dates"
import { formatCLP } from "@/lib/format"
import { entrenosFuerzaQueryOptions } from "@/modules/entrenamientos/queries"
import { useAnaliticaResumen } from "@/modules/finanzas/hooks/useFinanzas"
import { pesosQueryOptions } from "@/modules/nutricion/queries"

type ModuleKey = "finanzas" | "entrenamientos" | "nutricion" | "compras"

interface BlockProps {
  module: ModuleKey
  href: string
  icon: LucideIcon
  title: string
  value: string | null
  detail: string
}

const kgFormatter = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 })

function ModuleBlock({ module, href, icon: Icon, title, value, detail }: BlockProps) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-36 flex-col justify-between gap-4 rounded-2xl p-4 transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none sm:min-h-40 sm:p-5"
      style={{ background: `var(--module-${module}-fill)`, color: `var(--module-${module}-on)` }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex size-9 items-center justify-center rounded-md bg-black/15">
          <Icon className="size-[1.1rem]" aria-hidden />
        </span>
        <ArrowUpRight
          className="size-5 opacity-60 transition group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
          aria-hidden
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] opacity-85">{title}</span>
        {value === null ? (
          <span className="block h-7 w-24 animate-pulse rounded-sm bg-black/15" />
        ) : (
          <span className="font-display text-[1.3rem] leading-none whitespace-nowrap sm:text-[1.7rem]">{value}</span>
        )}
        <span className="text-xs opacity-85">{detail}</span>
      </div>
    </Link>
  )
}

/**
 * Los cuatro modulos como bloques de color con su dato del momento. Cada bloque consulta
 * la misma query que su modulo, asi que al entrar ya esta en cache.
 */
export function ModuleBlocks() {
  const today = toLocalIsoDate()
  const weekStart = startOfWeek(today)

  const resumenQuery = useAnaliticaResumen()
  const entrenosQuery = useQuery(entrenosFuerzaQueryOptions())
  const pesosQuery = useQuery(pesosQueryOptions())

  const resumen = resumenQuery.data
  const finanzas = resumenQuery.isError
    ? { value: "—", detail: "Sin datos por ahora" }
    : {
        value: resumen ? formatCLP(resumen.gasto_total) : null,
        detail: resumen
          ? `${resumen.cantidad_movimientos} movimientos en ${formatMonth(resumen.year, resumen.month)}`
          : "Cargando...",
      }

  const entrenos = entrenosQuery.data ?? []
  const enCurso = entrenos.find((entreno) => entreno.fin_at === null)
  const semana = entrenos.filter((entreno) => datePart(entreno.inicio_at) >= weekStart)
  const ultimo = [...entrenos].sort((a, b) => b.inicio_at.localeCompare(a.inicio_at))[0]
  const fuerza = entrenosQuery.isError
    ? { value: "—", detail: "Sin datos por ahora" }
    : {
        value: entrenosQuery.data ? `${semana.length} ${semana.length === 1 ? "sesion" : "sesiones"}` : null,
        detail: enCurso
          ? "Entreno en curso"
          : ultimo
            ? `Ultimo: ${formatShortDate(ultimo.inicio_at)}`
            : "Aun sin entrenos",
      }

  const pesos = [...(pesosQuery.data ?? [])].sort((a, b) => b.fecha_registro.localeCompare(a.fecha_registro))
  const [pesoActual, pesoAnterior] = pesos
  const deltaPeso = pesoActual && pesoAnterior ? pesoActual.peso_kg - pesoAnterior.peso_kg : null
  const nutricion = pesosQuery.isError
    ? { value: "—", detail: "Sin datos por ahora" }
    : {
        value: pesosQuery.data ? (pesoActual ? `${kgFormatter.format(pesoActual.peso_kg)} kg` : "—") : null,
        detail: pesoActual
          ? deltaPeso !== null && deltaPeso !== 0
            ? `${deltaPeso > 0 ? "+" : "−"}${kgFormatter.format(Math.abs(deltaPeso))} kg vs. ${formatShortDate(pesoAnterior.fecha_registro)}`
            : `Registrado el ${formatShortDate(pesoActual.fecha_registro)}`
          : "Registra tu primer peso",
      }

  const ingresos = resumenQuery.isError
    ? { value: "—", detail: "Sin datos por ahora" }
    : {
        value: resumen ? formatCLP(resumen.ingreso_total) : null,
        detail: resumen ? `Balance ${formatCLP(resumen.balance_total)}` : "Cargando...",
      }

  return (
    <section aria-label="Modulos" className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      <ModuleBlock module="finanzas" href="/app/finanzas" icon={Wallet} title="Gastado" {...finanzas} />
      <ModuleBlock
        module="entrenamientos"
        href={enCurso ? "/app/entrenamientos/activo" : "/app/entrenamientos"}
        icon={Dumbbell}
        title="Esta semana"
        {...fuerza}
      />
      <ModuleBlock module="nutricion" href="/app/nutricion/peso" icon={Apple} title="Peso" {...nutricion} />
      {/* El cuarto bloque usa el cuarto color de la marca (antes era el del modulo Compras). */}
      <ModuleBlock module="compras" href="/app/finanzas/movimientos" icon={ArrowDownLeft} title="Ingresos" {...ingresos} />
    </section>
  )
}
