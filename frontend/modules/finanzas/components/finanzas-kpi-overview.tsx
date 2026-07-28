"use client"

import Link from "next/link"
import { CSSProperties, ComponentType, useMemo } from "react"
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CircleDollarSign,
  PiggyBank,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FinanzasKpiOverviewSkeleton } from "@/modules/finanzas/components/skeletons/kpi-overview-skeleton"
import { useAnaliticaResumen } from "@/modules/finanzas/hooks/useFinanzas"

const MODULE_COLOR = "var(--module-finanzas)"

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value)

const formatPercent = (value: number | null) => {
  if (value === null) return "Sin referencia"

  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 1,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value) + "%"
}

const formatMonthLabel = (year: number, month: number) =>
  new Intl.DateTimeFormat("es-CL", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1))

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string
  value: string
  note: string
  icon: ComponentType<{ className?: string; style?: CSSProperties }>
}) {
  return (
    <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
      <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">
        <Icon className="size-3.5" style={{ color: MODULE_COLOR }} />
        {label}
      </p>
      <p className="mt-3 text-lg font-semibold tracking-tight text-foreground sm:text-2xl">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">{note}</p>
    </article>
  )
}

export function FinanzasKpiOverview() {
  const resumenQuery = useAnaliticaResumen()
  const resumen = resumenQuery.data ?? null

  const split = useMemo(() => {
    if (!resumen || resumen.gasto_total <= 0) {
      return { fijoPct: 0, variablePct: 0 }
    }

    return {
      fijoPct: (resumen.gasto_fijo_total / resumen.gasto_total) * 100,
      variablePct: (resumen.gasto_variable_total / resumen.gasto_total) * 100,
    }
  }, [resumen])

  if (resumenQuery.isLoading) {
    return <FinanzasKpiOverviewSkeleton />
  }

  if (!resumen || resumenQuery.isError) {
    return (
      <section className="rounded-[1.75rem] bg-[color:var(--surface-low)] p-5 sm:p-6">
        <div className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-5 shadow-[var(--shadow-airy)] sm:p-6">
          <p className="font-label text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
            Finanzas
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            El resumen financiero no esta disponible.
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {resumenQuery.isError
              ? "No pudimos cargar el resumen financiero por ahora."
              : "No encontramos datos suficientes para construir tus KPI."}
          </p>
          <Button
            type="button"
            onClick={() => void resumenQuery.refetch()}
            className="mt-5 bg-[color:var(--module-finanzas)] text-[color:var(--primary-foreground)] hover:bg-[color:var(--module-finanzas)]/90"
          >
            <RefreshCw className="size-4" />
            Reintentar
          </Button>
        </div>
      </section>
    )
  }

  const monthLabel = formatMonthLabel(resumen.year, resumen.month)
  const isEmpty =
    resumen.cantidad_movimientos === 0 &&
    resumen.gasto_total === 0 &&
    resumen.ingreso_total === 0

  const variationTone =
    resumen.variacion_gasto_vs_mes_anterior === null
      ? "text-muted-foreground"
      : resumen.variacion_gasto_vs_mes_anterior <= 0
        ? "text-secondary"
        : "text-[color:var(--tertiary)]"

  return (
    <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <article className="rounded-[1.75rem] bg-[color:var(--surface-low)] p-4 sm:p-6">
        <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,color-mix(in_oklch,var(--module-finanzas)_12%,white),transparent_72%)] p-5 shadow-[var(--shadow-airy-lg)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-label text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
                Finanzas del mes
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
                {formatCurrency(resumen.balance_total)}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
                Balance disponible para {monthLabel}. Se calcula con ingresos menos gastos del periodo.
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] sm:text-xs"
              style={{
                background: "color-mix(in oklch, var(--module-finanzas) 12%, transparent)",
                color: MODULE_COLOR,
              }}
            >
              <BarChart3 className="size-3.5" />
              {monthLabel}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.25rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)]">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Gastos</p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-foreground sm:text-2xl">
                {formatCurrency(resumen.gasto_total)}
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)]">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Ingresos</p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-foreground sm:text-2xl">
                {formatCurrency(resumen.ingreso_total)}
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)]">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Movimientos</p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-foreground sm:text-2xl">
                {resumen.cantidad_movimientos}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-muted-foreground">
              {isEmpty
                ? "Todavia no registras movimientos este mes. En cuanto empieces a cargar gastos o ingresos, este bloque se alimenta solo."
                : "Este bloque ya esta listo para crecer con tendencia mensual y distribuciones cuando conectemos los siguientes endpoints."}
            </p>
            <Button
              asChild
              className="w-full bg-[color:var(--module-finanzas)] text-[color:var(--primary-foreground)] hover:bg-[color:var(--module-finanzas)]/90 sm:w-auto"
            >
              <Link href="/app/finanzas">
                Ver finanzas
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </article>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <article className="rounded-[1.75rem] bg-[color:var(--surface-lowest)] p-5 shadow-[var(--shadow-airy)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-label text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
                Composicion del gasto
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                Fijo vs variable
              </h3>
            </div>
            <Wallet className="size-4 shrink-0" style={{ color: MODULE_COLOR }} />
          </div>

          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-[color:var(--surface-variant)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${split.fijoPct}%`,
                background: "var(--module-finanzas)",
              }}
            />
            <div
              className="h-full"
              style={{
                width: `${split.variablePct}%`,
                background: "color-mix(in oklch, var(--module-finanzas) 40%, transparent)",
              }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[1.25rem] bg-[color:var(--surface-low)] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Fijo</p>
              <p className="mt-2 text-base font-semibold tracking-tight text-foreground sm:text-lg">
                {formatCurrency(resumen.gasto_fijo_total)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{formatPercent(split.fijoPct)}</p>
            </div>
            <div className="rounded-[1.25rem] bg-[color:var(--surface-low)] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Variable</p>
              <p className="mt-2 text-base font-semibold tracking-tight text-foreground sm:text-lg">
                {formatCurrency(resumen.gasto_variable_total)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{formatPercent(split.variablePct)}</p>
            </div>
          </div>
        </article>

        <article className="rounded-[1.75rem] bg-[color:var(--surface-lowest)] p-5 shadow-[var(--shadow-airy)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-label text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
                Lectura rapida
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                Senales del periodo
              </h3>
            </div>
            <PiggyBank className="size-4 shrink-0" style={{ color: MODULE_COLOR }} />
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-[1.25rem] bg-[color:var(--surface-low)] p-4">
              <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <ArrowUpRight className="size-3.5" style={{ color: MODULE_COLOR }} />
                Tasa de ahorro
              </p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                {formatPercent(resumen.tasa_ahorro_pct)}
              </p>
            </div>

            <div className="rounded-[1.25rem] bg-[color:var(--surface-low)] p-4">
              <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {resumen.variacion_gasto_vs_mes_anterior !== null &&
                resumen.variacion_gasto_vs_mes_anterior <= 0 ? (
                  <TrendingDown className="size-3.5 text-secondary" />
                ) : (
                  <TrendingUp className="size-3.5 text-[color:var(--tertiary)]" />
                )}
                Variacion de gasto
              </p>
              <p className={cn("mt-2 text-xl font-semibold tracking-tight", variationTone)}>
                {resumen.variacion_gasto_vs_mes_anterior === null
                  ? "Sin base"
                  : formatCurrency(resumen.variacion_gasto_vs_mes_anterior)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {resumen.variacion_gasto_vs_mes_anterior_pct === null
                  ? "No hay mes anterior comparable."
                  : `${formatPercent(resumen.variacion_gasto_vs_mes_anterior_pct)} vs mes anterior`}
              </p>
            </div>

            <div className="rounded-[1.25rem] bg-[color:var(--surface-low)] p-4">
              <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                <CircleDollarSign className="size-3.5" style={{ color: MODULE_COLOR }} />
                Proyeccion fin de mes
              </p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                {resumen.proyeccion_gasto_fin_mes === null
                  ? "No disponible"
                  : formatCurrency(resumen.proyeccion_gasto_fin_mes)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {resumen.proyeccion_gasto_fin_mes === null
                  ? "Solo se calcula para el mes actual."
                  : "Estimacion dinamica segun tu gasto actual."}
              </p>
            </div>
          </div>
        </article>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-4">
        <MetricCard
          label="Mayor gasto"
          value={formatCurrency(resumen.gasto_mayor)}
          note="Movimiento gasto mas alto del periodo."
          icon={TrendingUp}
        />
        <MetricCard
          label="Ticket promedio"
          value={formatCurrency(resumen.ticket_promedio_gasto)}
          note="Promedio por gasto registrado."
          icon={BarChart3}
        />
        <MetricCard
          label="Ingresos"
          value={formatCurrency(resumen.ingreso_total)}
          note="Total de ingresos del mes actual."
          icon={ArrowUpRight}
        />
        <MetricCard
          label="Balance"
          value={formatCurrency(resumen.balance_total)}
          note="Resultado neto del periodo."
          icon={PiggyBank}
        />
      </div>
    </section>
  )
}
