"use client"

import { useId, useState } from "react"
import { cn } from "@/lib/utils"

export interface ColumnSerie {
  key: string
  label: string
  /** Color de la marca (CSS). El texto nunca usa este color: va en tokens de texto. */
  color: string
}

export interface ColumnDatum {
  id: string
  /** Etiqueta corta del eje X ("sep"). */
  label: string
  /** Etiqueta larga para tooltip y tabla ("septiembre 2026"). */
  fullLabel?: string
  values: Record<string, number>
  /** Periodo en curso: se pinta con `currentColor` cuando hay una sola serie. */
  current?: boolean
}

interface ColumnChartProps {
  series: ColumnSerie[]
  data: ColumnDatum[]
  formatValue: (value: number) => string
  formatTick?: (value: number) => string
  /** Descripcion para lectores de pantalla y titulo de la tabla. */
  label: string
  height?: number
  /** "surface" sobre tarjetas; "hero" sobre el bloque protagonista (sin ejes). */
  tone?: "surface" | "hero"
  /** Color del periodo en curso (solo con una serie). */
  currentColor?: string
  /** Linea horizontal de referencia (p. ej. promedio diario). Sin label, solo la linea. */
  reference?: { value: number; label?: string }
  /** Muestra la etiqueta del eje X cada N columnas (y siempre la del periodo en curso). */
  xLabelEvery?: number
  className?: string
}

const MAX_BAR = 24
const AXIS_WIDTH = 48

/** Pasos "redondos" (1, 2, 5 x 10^n) para que los ticks sean legibles. */
export function niceTicks(max: number, count = 3): number[] {
  if (max <= 0) return [0]
  const raw = max / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((f) => f * magnitude).find((s) => s >= raw) ?? raw
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let value = 0; value <= top + step / 2; value += step) ticks.push(value)
  return ticks
}

export function ColumnChart({
  series,
  data,
  formatValue,
  formatTick = formatValue,
  label,
  height = 180,
  tone = "surface",
  currentColor,
  reference,
  xLabelEvery = 1,
  className,
}: ColumnChartProps) {
  const [active, setActive] = useState<number | null>(null)
  const tableId = useId()
  const isHero = tone === "hero"
  const single = series.length === 1

  const max = Math.max(0, reference?.value ?? 0, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0)))
  // Con muchas columnas (dias del mes) el espacio entre ellas se reduce al minimo.
  const dense = data.length > 14
  const gapClass = dense ? "gap-[2px]" : isHero ? "gap-1.5" : "gap-2"
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const axisWidth = isHero ? 0 : AXIS_WIDTH

  const barColor = (serie: ColumnSerie, datum: ColumnDatum) =>
    single && datum.current && currentColor ? currentColor : serie.color

  return (
    <figure className={cn("flex flex-col gap-3", className)}>
      {series.length > 1 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden>
          {series.map((serie) => (
            <li key={serie.key} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-[2px]" style={{ background: serie.color }} />
              {serie.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative" style={{ height }} role="img" aria-label={label} aria-describedby={tableId}>
        {/* Grilla: lineas finas y recesivas, sin ejes pesados. */}
        {!isHero
          ? ticks.map((tick) => (
              <div
                key={tick}
                aria-hidden
                className="absolute right-0 flex items-center"
                style={{ bottom: `${(tick / top) * 100}%`, left: 0, transform: "translateY(50%)" }}
              >
                <span
                  className="shrink-0 pr-2 text-right text-[10px] tabular-nums text-muted-foreground"
                  style={{ width: axisWidth }}
                >
                  {formatTick(tick)}
                </span>
                <span className="h-px flex-1 bg-[color:var(--chart-grid)]" />
              </div>
            ))
          : null}

        {reference && reference.value > 0 ? (
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 z-20 border-t-2 border-foreground/70"
            style={{ left: axisWidth, bottom: `${(reference.value / top) * 100}%` }}
          >
            {reference.label ? (
              <span className="absolute right-0 bottom-1 rounded-sm bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background tabular-nums">
                {reference.label}
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          className={cn("absolute inset-y-0 right-0 flex items-end", gapClass)}
          style={{ left: axisWidth }}
          onMouseLeave={() => setActive(null)}
        >
          {data.map((datum, index) => {
            const isActive = active === index
            return (
              <div
                key={datum.id}
                tabIndex={0}
                aria-label={`${datum.fullLabel ?? datum.label}: ${series
                  .map((s) => `${s.label} ${formatValue(datum.values[s.key] ?? 0)}`)
                  .join(", ")}`}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                className="relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isActive ? (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-0 -z-0 rounded-sm",
                      isHero ? "bg-[color:var(--hero-line)]" : "bg-[color:var(--surface-low)]",
                    )}
                  />
                ) : null}
                {series.map((serie) => {
                  const value = datum.values[serie.key] ?? 0
                  return (
                    <span
                      key={serie.key}
                      className="relative z-10 block rounded-t-[3px] transition-[height] duration-500 ease-out motion-reduce:transition-none"
                      style={{
                        width: `min(${MAX_BAR}px, ${100 / series.length}%)`,
                        height: value > 0 ? `max(2px, ${(value / top) * 100}%)` : 0,
                        background: barColor(serie, datum),
                      }}
                    />
                  )
                })}

                {isActive ? (
                  <div
                    role="presentation"
                    className={cn(
                      "pointer-events-none absolute bottom-full z-20 mb-2 w-max max-w-[12rem] rounded-md px-3 py-2 text-xs shadow-[var(--shadow-airy-lg)]",
                      index < data.length / 2 ? "left-0" : "right-0",
                      "bg-[color:var(--popover)] text-[color:var(--popover-foreground)]",
                    )}
                  >
                    <p className="font-semibold capitalize">{datum.fullLabel ?? datum.label}</p>
                    {series.map((serie) => (
                      <p key={serie.key} className="mt-1 flex items-center gap-1.5 tabular-nums">
                        <span className="size-2 rounded-[2px]" style={{ background: barColor(serie, datum) }} />
                        <span className="text-muted-foreground">{serie.label}</span>
                        <span className="ml-auto pl-3 font-semibold">
                          {formatValue(datum.values[serie.key] ?? 0)}
                        </span>
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <div
        aria-hidden
        className={cn("flex text-[10px] font-medium uppercase tracking-wide", gapClass)}
        style={{ paddingLeft: axisWidth }}
      >
        {data.map((datum, index) => (
          <span
            key={datum.id}
            className={cn(
              // min-w-0: la etiqueta desborda centrada sobre su columna sin ensancharla.
              "flex min-w-0 flex-1 justify-center overflow-visible whitespace-nowrap",
              index % xLabelEvery !== 0 && !datum.current && "invisible",
              isHero ? "text-[color:var(--hero-muted)]" : "text-muted-foreground",
              datum.current && (isHero ? "text-[color:var(--hero-foreground)]" : "text-foreground"),
            )}
          >
            {datum.label}
          </span>
        ))}
      </div>

      {/* Vista de tabla: el dato completo sin depender del color ni del hover. */}
      <table id={tableId} className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Periodo</th>
            {series.map((serie) => (
              <th key={serie.key} scope="col">
                {serie.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((datum) => (
            <tr key={datum.id}>
              <th scope="row">{datum.fullLabel ?? datum.label}</th>
              {series.map((serie) => (
                <td key={serie.key}>{formatValue(datum.values[serie.key] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
