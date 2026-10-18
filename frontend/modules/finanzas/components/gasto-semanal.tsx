"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, ChevronLeft, ChevronRight, Info, RefreshCw, Target } from "lucide-react"
import { ColumnChart } from "@/components/charts/column-chart"
import { addDays, formatShortDate, startOfWeek, toLocalIsoDate } from "@/lib/dates"
import { formatCLP, formatCLPCompact } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useResumenSemanal, useTendenciaSemanal } from "@/modules/finanzas/hooks/useFinanzas"
import type { AlertaSemana, ResumenSemanalResponse } from "@/modules/finanzas/types/finanzas"

const DIAS = ["L", "M", "X", "J", "V", "S", "D"]
const pctFormatter = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 })

type Estado = "ok" | "aviso" | "excedido"

function estadoDe(porcentaje: number | null): Estado | null {
  if (porcentaje === null) return null
  if (porcentaje > 100) return "excedido"
  if (porcentaje >= 80) return "aviso"
  return "ok"
}

const COLOR_ESTADO: Record<Estado, string> = {
  ok: "var(--ingreso)",
  aviso: "var(--warning-text)",
  excedido: "var(--gasto)",
}

function rangoSemana(inicio: string, fin: string) {
  return `${formatShortDate(inicio)} – ${formatShortDate(fin)}`
}

function variacionTexto(pct: number | null) {
  if (pct === null) return "—"
  if (Math.abs(pct) < 0.5) return "igual"
  return `${pct > 0 ? "+" : "−"}${pctFormatter.format(Math.abs(pct))}%`
}

/** Bloque de la portada: la semana en curso contra la meta y las alertas mas graves. */
export function SemanaPortada() {
  const query = useResumenSemanal()
  const resumen = query.data

  if (query.isError) return <ErrorInline onRetry={() => void query.refetch()} />

  return (
    <div className="flex flex-col gap-2">
      <Link
        href="/app/finanzas/semana"
        aria-label="Ver el detalle de la semana"
        className="block rounded-2xl transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:opacity-90"
      >
        <SemanaHero resumen={resumen} accion="Ver detalle" />
      </Link>
      {resumen && resumen.meta_semanal === null ? (
        <Link
          href="/app/finanzas/metas"
          className="flex items-center gap-3 rounded-xl bg-[color:var(--surface-lowest)] p-3 text-sm shadow-[var(--shadow-airy)] hover:bg-[color:var(--surface-low)]"
        >
          <Target className="size-4 shrink-0 text-[color:var(--module-finanzas)]" aria-hidden />
          <span className="min-w-0 flex-1">Fija una meta semanal y te diremos cuanto puedes gastar cada dia.</span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      ) : null}
      {resumen?.alertas.slice(0, 2).map((alerta) => <AlertaFila key={alerta.clave} alerta={alerta} />)}
    </div>
  )
}

/** Cifra protagonista de la semana: gastado, meta, barra de avance y tres datos. */
function SemanaHero({ resumen, accion }: { resumen?: ResumenSemanalResponse; accion?: string }) {
  const estado = estadoDe(resumen?.porcentaje_meta ?? null)
  const diasRestantes = resumen ? 7 - resumen.dias_transcurridos : 0

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-[color:var(--hero)] p-5 text-[color:var(--hero-foreground)] shadow-[var(--shadow-airy)] sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--hero-muted)]">
          {resumen && !resumen.es_semana_actual ? "Gastado esa semana" : "Gastado esta semana"}
        </p>
        <p className="text-xs tabular-nums text-[color:var(--hero-muted)]">
          {resumen ? rangoSemana(resumen.semana_inicio, resumen.semana_fin) : null}
          {accion ? <span className="ml-2 font-semibold text-[color:var(--hero-foreground)]">{accion} ›</span> : null}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {resumen ? (
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-[2.4rem] leading-none text-[color:var(--hero-accent)] sm:text-5xl">
              {formatCLP(resumen.gasto_semana)}
            </span>
            {resumen.meta_semanal ? (
              <span className="text-sm text-[color:var(--hero-muted)]">de {formatCLP(resumen.meta_semanal)}</span>
            ) : null}
          </p>
        ) : (
          <span className="block h-11 w-48 animate-pulse rounded-md bg-[color:var(--hero-line)]" />
        )}
        {resumen?.meta_semanal && estado ? (
          <Avance porcentaje={resumen.porcentaje_meta ?? 0} color={estado === "ok" ? "var(--hero-accent)" : COLOR_ESTADO[estado]} />
        ) : null}
      </div>

      {resumen ? (
        <dl className="grid grid-cols-3 gap-3 border-t border-[color:var(--hero-line)] pt-3 text-sm">
          {resumen.meta_semanal && resumen.es_semana_actual ? (
            <DatoHero
              etiqueta="Hoy"
              valor={formatCLP(resumen.gasto_hoy ?? 0)}
              nota={`tope ${formatCLP(resumen.disponible_hoy ?? 0)}`}
              alerta={(resumen.gasto_hoy ?? 0) > (resumen.disponible_hoy ?? 0)}
            />
          ) : (
            <DatoHero
              etiqueta={resumen.es_semana_actual ? "Hoy" : "Por dia"}
              valor={formatCLP(resumen.es_semana_actual ? (resumen.gasto_hoy ?? 0) : (resumen.promedio_diario ?? 0))}
              nota={resumen.es_semana_actual ? `prom. ${formatCLP(resumen.promedio_diario ?? 0)}` : "promedio"}
            />
          )}
          {resumen.restante !== null ? (
            <DatoHero
              etiqueta={resumen.restante < 0 ? "Pasado" : resumen.es_semana_actual ? "Queda" : "Sobro"}
              valor={formatCLP(Math.abs(resumen.restante))}
              nota={resumen.es_semana_actual ? (diasRestantes ? `${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"} mas` : "ultimo dia") : "vs la meta"}
              alerta={resumen.restante < 0}
            />
          ) : (
            <DatoHero
              etiqueta={resumen.es_semana_actual ? "Proyeccion" : "Dias"}
              valor={resumen.es_semana_actual ? formatCLP(resumen.proyeccion_semana ?? 0) : "7"}
              nota={resumen.es_semana_actual ? "al domingo" : "completa"}
            />
          )}
          <DatoHero
            etiqueta="Vs. anterior"
            valor={variacionTexto(resumen.variacion_misma_altura_pct)}
            nota={resumen.es_semana_actual ? "a esta altura" : formatCLP(resumen.gasto_semana_anterior)}
            alerta={(resumen.variacion_misma_altura_pct ?? 0) >= 25}
          />
        </dl>
      ) : null}
    </div>
  )
}

function Avance({ porcentaje, color }: { porcentaje: number; color: string }) {
  return (
    <div
      className="h-2 overflow-hidden rounded-[3px] bg-[color:var(--hero-line)]"
      role="img"
      aria-label={`${pctFormatter.format(porcentaje)}% de la meta`}
    >
      <span className="block h-full rounded-[3px]" style={{ width: `${Math.min(100, porcentaje)}%`, background: color }} />
    </div>
  )
}

function DatoHero({ etiqueta, valor, nota, alerta = false }: { etiqueta: string; valor: string; nota?: string; alerta?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--hero-muted)]">{etiqueta}</dt>
      <dd className={cn("truncate font-semibold tabular-nums", alerta && "text-[color:var(--hero-accent)]")}>{valor}</dd>
      {nota ? <dd className="truncate text-xs text-[color:var(--hero-muted)]">{nota}</dd> : null}
    </div>
  )
}

const ESTILO_ALERTA: Record<AlertaSemana["nivel"], string> = {
  excedido: "border-[color:var(--error-border)] bg-[color:var(--error-bg)] text-[color:var(--error-text)]",
  aviso: "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-text)]",
  info: "border-[color:var(--info-border)] bg-[color:var(--info-bg)] text-[color:var(--info-text)]",
}

function AlertaFila({ alerta }: { alerta: AlertaSemana }) {
  const Icono = alerta.nivel === "info" ? Info : AlertTriangle
  return (
    <div role={alerta.nivel === "info" ? "status" : "alert"} className={cn("flex items-start gap-3 rounded-xl border p-3 text-sm", ESTILO_ALERTA[alerta.nivel])}>
      <Icono className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold">{alerta.titulo}</p>
        <p className="mt-0.5 opacity-90">{alerta.mensaje}</p>
      </div>
    </div>
  )
}

/** Pagina de la semana: navegable semana a semana, con dias, categorias e historial. */
export function SemanaDetalle() {
  const lunesActual = startOfWeek(toLocalIsoDate())
  const [lunes, setLunes] = useState(lunesActual)
  const esActual = lunes === lunesActual
  const query = useResumenSemanal(esActual ? undefined : lunes)
  const resumen = query.data

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 self-center sm:self-start">
        <button
          type="button"
          onClick={() => setLunes(addDays(lunes, -7))}
          aria-label="Semana anterior"
          className="inline-flex size-9 items-center justify-center rounded-md hover:bg-[color:var(--surface-low)]"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <p className="min-w-40 text-center text-sm font-semibold tabular-nums">
          {esActual ? "Esta semana" : rangoSemana(lunes, addDays(lunes, 6))}
        </p>
        <button
          type="button"
          onClick={() => setLunes(addDays(lunes, 7))}
          disabled={esActual}
          aria-label="Semana siguiente"
          className="inline-flex size-9 items-center justify-center rounded-md hover:bg-[color:var(--surface-low)] disabled:opacity-30"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>

      {query.isError ? (
        <ErrorInline onRetry={() => void query.refetch()} />
      ) : (
        <>
          <SemanaHero resumen={resumen} />
          {resumen?.alertas.map((alerta) => <AlertaFila key={alerta.clave} alerta={alerta} />)}
          {resumen ? <DiaADia resumen={resumen} /> : <Cargando alto={260} />}
          {resumen ? <PorCategoria resumen={resumen} /> : <Cargando alto={200} />}
        </>
      )}

      <UltimasSemanas />

      <Link
        href="/app/finanzas/metas"
        className="flex items-center gap-3 rounded-xl bg-[color:var(--surface-lowest)] p-3 text-sm font-semibold shadow-[var(--shadow-airy)] hover:bg-[color:var(--surface-low)]"
      >
        <Target className="size-4 shrink-0 text-[color:var(--module-finanzas)]" aria-hidden />
        <span className="flex-1">Ajustar meta y presupuestos</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </section>
  )
}

function DiaADia({ resumen }: { resumen: ResumenSemanalResponse }) {
  const hoy = toLocalIsoDate()
  const pasados = resumen.dias.filter((dia) => !dia.es_futuro)
  const masCaro = pasados.reduce<(typeof pasados)[number] | null>(
    (max, dia) => (dia.gasto_total > (max?.gasto_total ?? 0) ? dia : max),
    null,
  )
  const metaDiaria = resumen.meta_semanal ? resumen.meta_semanal / 7 : null

  return (
    <Card titulo="Dia a dia">
      <ColumnChart
        label="Gasto por dia de la semana"
        height={170}
        series={[{ key: "gasto", label: "Gasto", color: "var(--gasto)" }]}
        currentColor="var(--foreground)"
        formatValue={formatCLP}
        formatTick={formatCLPCompact}
        reference={metaDiaria ? { value: metaDiaria, label: "Meta" } : undefined}
        data={resumen.dias.map((dia, indice) => ({
          id: dia.fecha,
          label: DIAS[indice],
          fullLabel: formatShortDate(dia.fecha),
          values: { gasto: dia.gasto_total },
          current: dia.fecha === hoy,
        }))}
      />
      <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm sm:grid-cols-4">
        <Dato etiqueta="Promedio diario" valor={resumen.promedio_diario !== null ? formatCLP(resumen.promedio_diario) : "—"} />
        {metaDiaria ? <Dato etiqueta="Meta diaria" valor={formatCLP(metaDiaria)} /> : null}
        <Dato etiqueta="Dia mas caro" valor={masCaro ? `${formatShortDate(masCaro.fecha)} · ${formatCLP(masCaro.gasto_total)}` : "—"} />
        <Dato
          etiqueta="Dias sin gastos"
          valor={`${pasados.filter((dia) => dia.gasto_total === 0).length} de ${pasados.length}`}
        />
      </dl>
      {resumen.gasto_excluido > 0 ? (
        <p className="text-xs text-muted-foreground">
          No cuentan {formatCLP(resumen.gasto_excluido)} en abonos a deudas y categorias que dejaste fuera.{" "}
          <Link href="/app/finanzas/metas" className="font-semibold underline underline-offset-4">
            Cambiar
          </Link>
        </p>
      ) : null}
    </Card>
  )
}

function PorCategoria({ resumen }: { resumen: ResumenSemanalResponse }) {
  return (
    <Card titulo="Por categoria">
      {resumen.categorias.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin gastos esta semana.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {resumen.categorias.map((categoria) => {
            const estado = estadoDe(categoria.porcentaje_presupuesto)
            const diferencia = categoria.total - categoria.total_semana_anterior
            return (
              <li key={categoria.id_categoria} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{categoria.categoria}</span>
                  <span className="shrink-0 tabular-nums">
                    <strong>{formatCLP(categoria.total)}</strong>
                    {categoria.presupuesto_semanal ? (
                      <span className="text-muted-foreground"> / {formatCLP(categoria.presupuesto_semanal)}</span>
                    ) : null}
                  </span>
                </div>
                {categoria.presupuesto_semanal && estado ? (
                  <div className="h-1.5 overflow-hidden rounded-[3px] bg-[color:var(--surface-low)]">
                    <span
                      className="block h-full rounded-[3px]"
                      style={{ width: `${Math.min(100, categoria.porcentaje_presupuesto ?? 0)}%`, background: COLOR_ESTADO[estado] }}
                    />
                  </div>
                ) : null}
                {resumen.es_semana_actual ? null : (
                  <p className="text-xs text-muted-foreground">
                    {diferencia === 0
                      ? "Igual que la semana anterior"
                      : `${diferencia > 0 ? "+" : "−"}${formatCLP(Math.abs(diferencia))} vs. la semana anterior`}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function UltimasSemanas() {
  const query = useTendenciaSemanal(8)
  const tendencia = query.data

  return (
    <Card titulo="Ultimas semanas">
      {tendencia ? (
        tendencia.items.length > 0 ? (
          <>
            <ColumnChart
              label="Gasto de las ultimas semanas"
              height={170}
              series={[{ key: "gasto", label: "Gasto", color: "var(--serie-gasto)" }]}
              currentColor="var(--foreground)"
              formatValue={formatCLP}
              formatTick={formatCLPCompact}
              reference={tendencia.meta_semanal ? { value: tendencia.meta_semanal, label: "Meta" } : undefined}
              data={tendencia.items.map((item) => ({
                id: item.semana_inicio,
                label: formatShortDate(item.semana_inicio).split(" ")[0],
                fullLabel: rangoSemana(item.semana_inicio, item.semana_fin),
                values: { gasto: item.gasto_total },
                current: item.es_semana_actual,
              }))}
            />
            <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm sm:grid-cols-3">
              <Dato
                etiqueta="Promedio semanal"
                valor={tendencia.promedio_semanas_completas !== null ? formatCLP(tendencia.promedio_semanas_completas) : "—"}
              />
              {tendencia.meta_semanal ? (
                <>
                  <Dato
                    etiqueta={(tendencia.ahorro_vs_meta_acumulado ?? 0) >= 0 ? "Ahorrado vs. meta" : "Sobre la meta"}
                    valor={tendencia.ahorro_vs_meta_acumulado !== null ? formatCLP(Math.abs(tendencia.ahorro_vs_meta_acumulado)) : "—"}
                  />
                  <Dato
                    etiqueta="Semanas cumplidas"
                    valor={`${tendencia.semanas_cumplidas} de ${tendencia.items.filter((item) => !item.es_semana_actual).length}`}
                  />
                </>
              ) : null}
            </dl>
            <p className="text-xs text-muted-foreground">Semanas cerradas, comparadas con tu meta de hoy.</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Todavia no hay semanas para comparar.</p>
        )
      ) : query.isError ? (
        <ErrorInline onRetry={() => void query.refetch()} inline />
      ) : (
        <Cargando alto={220} />
      )}
    </Card>
  )
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{titulo}</h2>
      {children}
    </section>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className="truncate font-semibold tabular-nums">{valor}</dd>
    </div>
  )
}

function Cargando({ alto }: { alto: number }) {
  return <div aria-hidden className="animate-pulse rounded-2xl bg-[color:var(--surface-low)]" style={{ height: alto }} />
}

function ErrorInline({ onRetry, inline = false }: { onRetry: () => void; inline?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 text-sm", !inline && "rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)]")}>
      <p>No pudimos cargar la semana.</p>
      <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4">
        <RefreshCw className="size-4" aria-hidden />
        Reintentar
      </button>
    </div>
  )
}
