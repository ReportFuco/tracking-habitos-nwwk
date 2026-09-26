"use client"

import Link from "next/link"
import { ArrowRight, RefreshCw } from "lucide-react"
import { ColumnChart } from "@/components/charts/column-chart"
import { formatMonth } from "@/lib/dates"
import { formatCLP, formatCLPCompact } from "@/lib/format"
import { useAnaliticaResumen, useAnaliticaTendencia } from "@/modules/finanzas/hooks/useFinanzas"

const percentFormatter = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 })

/**
 * Bloque protagonista del dashboard: el balance del mes como cifra grande y el gasto de
 * los ultimos 6 meses. En claro es negro con la cifra en sol; en oscuro, sol con tinta.
 */
export function DashboardHero() {
  const resumenQuery = useAnaliticaResumen()
  const tendenciaQuery = useAnaliticaTendencia(6)
  const resumen = resumenQuery.data
  const tendencia = tendenciaQuery.data?.items ?? []

  if (resumenQuery.isError && !resumen) {
    return (
      <section className="flex flex-col items-start gap-3 rounded-2xl bg-[color:var(--hero)] p-5 text-[color:var(--hero-foreground)] sm:p-7">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--hero-muted)]">
          Balance del mes
        </p>
        <p className="text-lg font-semibold">No pudimos cargar tus finanzas.</p>
        <button
          type="button"
          onClick={() => void resumenQuery.refetch()}
          className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[color:var(--hero-accent)] px-4 text-sm font-semibold text-[color:var(--hero-accent-foreground)]"
        >
          <RefreshCw className="size-4" />
          Reintentar
        </button>
      </section>
    )
  }

  const monthName = resumen ? formatMonth(resumen.year, resumen.month) : ""
  const variacion = resumen?.variacion_gasto_vs_mes_anterior_pct ?? null
  const prevMonth = resumen
    ? formatMonth(resumen.month === 1 ? resumen.year - 1 : resumen.year, resumen.month === 1 ? 12 : resumen.month - 1)
    : ""

  return (
    <section className="grid gap-6 rounded-2xl bg-[color:var(--hero)] p-5 text-[color:var(--hero-foreground)] sm:p-7 lg:grid-cols-[1fr_1.1fr] lg:items-end lg:gap-10">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--hero-muted)]">
          Balance de {monthName || "este mes"}
        </p>
        {resumen ? (
          <p className="font-display text-[2.6rem] leading-none text-[color:var(--hero-accent)] sm:text-6xl">
            {formatCLP(resumen.balance_total)}
          </p>
        ) : (
          <span className="block h-12 w-56 animate-pulse rounded-md bg-[color:var(--hero-line)] sm:h-14" />
        )}
        {resumen ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[color:var(--hero-muted)]">
            {variacion !== null ? (
              <span className="rounded-sm bg-[color:var(--hero-accent)] px-1.5 py-0.5 text-xs font-bold tabular-nums text-[color:var(--hero-accent-foreground)]">
                {variacion > 0 ? "+" : variacion < 0 ? "−" : ""}
                {percentFormatter.format(Math.abs(variacion))}%
              </span>
            ) : null}
            <span>
              {variacion !== null ? `gasto vs. ${prevMonth} · ` : ""}
              Ingresos {formatCLP(resumen.ingreso_total)} · Gastos {formatCLP(resumen.gasto_total)}
            </span>
          </p>
        ) : null}
        <Link
          href="/app/finanzas"
          className="mt-3 inline-flex w-fit items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--hero-accent)]"
        >
          Ver finanzas
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="min-w-0">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--hero-muted)]">
          Gasto por mes
        </p>
        {tendencia.length > 0 ? (
          <ColumnChart
            tone="hero"
            label="Gasto de los ultimos seis meses"
            height={110}
            series={[{ key: "gasto", label: "Gasto", color: "var(--hero-bar)" }]}
            currentColor="var(--hero-accent)"
            formatValue={formatCLP}
            formatTick={formatCLPCompact}
            data={tendencia.map((item, index) => ({
              id: item.label,
              label: formatMonth(item.year, item.month, "short"),
              fullLabel: `${formatMonth(item.year, item.month)} ${item.year}`,
              values: { gasto: item.gasto_total },
              current: index === tendencia.length - 1,
            }))}
          />
        ) : (
          <div className="h-[140px] animate-pulse rounded-md bg-[color:var(--hero-line)]" />
        )}
      </div>
    </section>
  )
}
