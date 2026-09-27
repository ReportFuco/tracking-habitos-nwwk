"use client"

import Link from "next/link"
import { RefreshCw } from "lucide-react"
import { BarList } from "@/components/charts/bar-list"
import { ColumnChart } from "@/components/charts/column-chart"
import { formatMonth, formatShortDate } from "@/lib/dates"
import { formatCLP, formatCLPCompact } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  useAnaliticaDiaria,
  useAnaliticaDistribucionCategorias,
  useAnaliticaResumen,
  useAnaliticaTendencia,
} from "@/modules/finanzas/hooks/useFinanzas"
import { mesAnterior, PeriodoSelector, usePeriodoMensual } from "./periodo-selector"

const pctFormatter = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 })

/** Portada de finanzas: el mes en numeros y graficos, navegable mes a mes. */
export function FinanzasResumen() {
  const { periodo, esMesActual, mover } = usePeriodoMensual()
  const resumenQuery = useAnaliticaResumen(periodo)
  const diariaQuery = useAnaliticaDiaria(periodo.year, periodo.month)
  const categoriasQuery = useAnaliticaDistribucionCategorias({ ...periodo, tipo_movimiento: "gasto" })
  const tendenciaQuery = useAnaliticaTendencia(6)

  const resumen = resumenQuery.data
  const diaria = diariaQuery.data
  const nombreMes = formatMonth(periodo.year, periodo.month)
  const anterior = mesAnterior(periodo)
  const variacion = resumen?.variacion_gasto_vs_mes_anterior_pct ?? null

  return (
    <section className="flex flex-col gap-4">
      <PeriodoSelector periodo={periodo} esMesActual={esMesActual} onMove={mover} className="self-center sm:self-start" />

      {resumenQuery.isError ? (
        <ErrorCard onRetry={() => void resumenQuery.refetch()} />
      ) : (
        <div className="grid gap-px overflow-hidden rounded-2xl bg-border shadow-[var(--shadow-airy)] sm:grid-cols-[1.4fr_1fr_1fr]">
          <div className="flex flex-col gap-2 bg-[color:var(--hero)] p-5 text-[color:var(--hero-foreground)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--hero-muted)]">Gastado en {nombreMes}</p>
            {resumen ? (
              <p className="font-display text-[2.4rem] leading-none text-[color:var(--hero-accent)] sm:text-5xl">{formatCLP(resumen.gasto_total)}</p>
            ) : (
              <span className="block h-11 w-48 animate-pulse rounded-md bg-[color:var(--hero-line)]" />
            )}
            {variacion !== null ? (
              <p className="flex items-center gap-2 text-sm text-[color:var(--hero-muted)]">
                <span className="rounded-sm bg-[color:var(--hero-accent)] px-1.5 py-0.5 text-xs font-bold tabular-nums text-[color:var(--hero-accent-foreground)]">
                  {variacion > 0 ? "+" : variacion < 0 ? "−" : ""}
                  {pctFormatter.format(Math.abs(variacion))}%
                </span>
                vs. {formatMonth(anterior.year, anterior.month)}
              </p>
            ) : null}
          </div>
          <Cifra etiqueta="Ingresos" valor={resumen ? formatCLP(resumen.ingreso_total) : null} marca="var(--ingreso)" />
          <Cifra
            etiqueta={esMesActual ? "Proyeccion fin de mes" : "Balance"}
            valor={resumen ? formatCLP(esMesActual ? (resumen.proyeccion_gasto_fin_mes ?? resumen.gasto_total) : resumen.balance_total) : null}
            nota={esMesActual && resumen ? `Balance ${formatCLP(resumen.balance_total)}` : undefined}
          />
        </div>
      )}

      {/* Gasto dia a dia contra el promedio del mes. */}
      <Card titulo="Gasto por dia" accion={<Link href="/app/finanzas/movimientos" className="text-sm font-semibold underline-offset-4 hover:underline">Ver movimientos</Link>}>
        {diaria ? (
          diaria.gasto_total > 0 ? (
            <>
              <ColumnChart
                label={`Gasto por dia en ${nombreMes}`}
                height={170}
                series={[{ key: "gasto", label: "Gasto", color: "var(--gasto)" }]}
                currentColor="var(--foreground)"
                formatValue={formatCLP}
                formatTick={formatCLPCompact}
                xLabelEvery={5}
                reference={diaria.promedio_gasto_diario ? { value: diaria.promedio_gasto_diario } : undefined}
                data={diaria.items.map((item) => ({
                  id: item.fecha,
                  label: String(item.dia),
                  fullLabel: formatShortDate(item.fecha),
                  values: { gasto: item.gasto_total },
                  current: esMesActual && item.dia === diaria.dias_transcurridos,
                }))}
              />
              <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm sm:grid-cols-3">
                <Dato
                  etiqueta="Promedio diario"
                  marca={<span aria-hidden className="inline-block h-0.5 w-3 bg-foreground/70 align-middle" />}
                  valor={diaria.promedio_gasto_diario ? formatCLP(diaria.promedio_gasto_diario) : "—"}
                />
                <Dato
                  etiqueta="Dia mas caro"
                  valor={diaria.dia_mayor_gasto ? `${formatShortDate(diaria.dia_mayor_gasto.fecha)} · ${formatCLP(diaria.dia_mayor_gasto.gasto_total)}` : "—"}
                />
                <Dato
                  etiqueta="Dias sin gastos"
                  valor={`${diaria.items.filter((item) => !item.es_futuro && item.dia <= diaria.dias_transcurridos && item.gasto_total === 0).length} de ${diaria.dias_transcurridos}`}
                />
              </dl>
            </>
          ) : (
            <Vacio texto={`Sin gastos en ${nombreMes}.`} />
          )
        ) : diariaQuery.isError ? (
          <ErrorCard onRetry={() => void diariaQuery.refetch()} inline />
        ) : (
          <Cargando alto={210} />
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card titulo="En que se va">
          {categoriasQuery.data ? (
            categoriasQuery.data.items.length > 0 ? (
              <BarList
                label={`Gasto por categoria en ${nombreMes}`}
                color="var(--gasto)"
                formatValue={formatCLP}
                items={categoriasQuery.data.items.map((item) => ({
                  id: item.id_categoria,
                  label: item.categoria,
                  value: item.total,
                  share: item.porcentaje_del_total,
                }))}
              />
            ) : (
              <Vacio texto="Sin gastos para repartir." />
            )
          ) : categoriasQuery.isError ? (
            <ErrorCard onRetry={() => void categoriasQuery.refetch()} inline />
          ) : (
            <Cargando alto={180} />
          )}

          {resumen && resumen.gasto_total > 0 ? <FijoVariable fijo={resumen.gasto_fijo_total} variable={resumen.gasto_variable_total} /> : null}
        </Card>

        <Card titulo="Ultimos 6 meses">
          {tendenciaQuery.data ? (
            <ColumnChart
              label="Ingresos y gastos de los ultimos seis meses"
              height={190}
              series={[
                { key: "ingreso", label: "Ingresos", color: "var(--serie-ingreso)" },
                { key: "gasto", label: "Gastos", color: "var(--serie-gasto)" },
              ]}
              formatValue={formatCLP}
              formatTick={formatCLPCompact}
              data={tendenciaQuery.data.items.map((item, index, items) => ({
                id: item.label,
                label: formatMonth(item.year, item.month, "short"),
                fullLabel: `${formatMonth(item.year, item.month)} ${item.year}`,
                values: { ingreso: item.ingreso_total, gasto: item.gasto_total },
                current: index === items.length - 1,
              }))}
            />
          ) : tendenciaQuery.isError ? (
            <ErrorCard onRetry={() => void tendenciaQuery.refetch()} inline />
          ) : (
            <Cargando alto={230} />
          )}
        </Card>
      </div>
    </section>
  )
}

function Card({ titulo, accion, children }: { titulo: string; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{titulo}</h2>
        {accion}
      </header>
      {children}
    </section>
  )
}

function Cifra({ etiqueta, valor, marca, nota }: { etiqueta: string; valor: string | null; marca?: string; nota?: string }) {
  return (
    <div className="flex flex-col justify-end gap-1.5 bg-[color:var(--surface-lowest)] p-4 sm:p-5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {marca ? <span aria-hidden className="size-2 rounded-[2px]" style={{ background: marca }} /> : null}
        {etiqueta}
      </p>
      {valor ? <p className="font-display text-2xl leading-none">{valor}</p> : <span className="block h-7 w-28 animate-pulse rounded-sm bg-[color:var(--surface-low)]" />}
      {nota ? <p className="text-xs text-muted-foreground">{nota}</p> : null}
    </div>
  )
}

function Dato({ etiqueta, valor, marca }: { etiqueta: string; valor: string; marca?: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {marca}
        {etiqueta}
      </dt>
      <dd className="font-semibold tabular-nums">{valor}</dd>
    </div>
  )
}

/** Barra partida fijo/variable con 2px de separacion entre segmentos. */
function FijoVariable({ fijo, variable }: { fijo: number; variable: number }) {
  const total = fijo + variable || 1
  const fijoPct = (fijo / total) * 100
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4">
      <div className="flex h-3 gap-[2px]" role="img" aria-label={`Gasto fijo ${pctFormatter.format(fijoPct)}%, variable ${pctFormatter.format(100 - fijoPct)}%`}>
        {fijo > 0 ? <span className="h-full rounded-l-[3px] bg-foreground" style={{ width: `${fijoPct}%` }} /> : null}
        {variable > 0 ? <span className={cn("h-full rounded-r-[3px] bg-[color:var(--gasto)]", fijo === 0 && "rounded-l-[3px]")} style={{ width: `${100 - fijoPct}%` }} /> : null}
      </div>
      <div className="flex justify-between text-sm">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-[2px] bg-foreground" />
          Fijo <strong className="tabular-nums">{formatCLP(fijo)}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-[2px] bg-[color:var(--gasto)]" />
          Variable <strong className="tabular-nums">{formatCLP(variable)}</strong>
        </span>
      </div>
    </div>
  )
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col items-start gap-3 py-4">
      <p className="text-sm text-muted-foreground">{texto}</p>
      <Link href="/app/finanzas/registrar-movimiento" className="text-sm font-semibold underline underline-offset-4">
        Anotar un gasto
      </Link>
    </div>
  )
}

function Cargando({ alto }: { alto: number }) {
  return <div aria-hidden className="animate-pulse rounded-md bg-[color:var(--surface-low)]" style={{ height: alto }} />
}

function ErrorCard({ onRetry, inline = false }: { onRetry: () => void; inline?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 text-sm", !inline && "rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)]")}>
      <p>No pudimos cargar estos datos.</p>
      <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4">
        <RefreshCw className="size-4" aria-hidden />
        Reintentar
      </button>
    </div>
  )
}
