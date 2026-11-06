"use client"

import { type CSSProperties, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/*
 * Fechas en hora local del dispositivo: una sesion de las 23:30 cuenta para ese dia y no
 * para el siguiente, que es lo que pasaria leyendo la fecha en UTC.
 */
const soloDia = (fecha: Date) => new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())

export const sumarDias = (fecha: Date, dias: number) =>
  new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + dias)

/** Lunes de la semana de `fecha`: en Chile la semana parte el lunes. */
export const inicioDeSemana = (fecha: Date) => {
  const dia = soloDia(fecha)
  return sumarDias(dia, -((dia.getDay() + 6) % 7))
}

const claveDia = (fecha: Date) => `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`

const mismoDia = (a: Date, b: Date) => claveDia(a) === claveDia(b)

const DIAS = ["L", "M", "X", "J", "V", "S", "D"]

const formatoMes = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric" })
const formatoDiaMes = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" })

export const rangoSemana = (inicio: Date) =>
  `${formatoDiaMes.format(inicio)} – ${formatoDiaMes.format(sumarDias(inicio, 6))}`

/**
 * Calendario del mes en filas de semana.
 *
 * Cada fila es un solo boton: lo que se elige es la semana, y un objetivo del ancho de la
 * tarjeta se acierta mejor con el pulgar que un dia suelto. Los dias con entreno van en
 * bloque solido del modulo; a la derecha, cuantos entrenos sumo esa semana.
 */
export function CalendarioSemanas({
  fechas,
  semana,
  onSeleccionarSemana,
}: {
  /** Inicio (ISO) de cada entrenamiento. */
  fechas: string[]
  /** Lunes de la semana elegida. */
  semana: Date
  onSeleccionarSemana: (inicio: Date) => void
}) {
  const hoy = soloDia(new Date())
  const mesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const [mes, setMes] = useState(() => new Date(semana.getFullYear(), semana.getMonth(), 1))

  const porDia = useMemo(() => {
    const conteo = new Map<string, number>()

    for (const iso of fechas) {
      const fecha = new Date(iso)

      if (Number.isNaN(fecha.getTime())) {
        continue
      }

      const clave = claveDia(fecha)
      conteo.set(clave, (conteo.get(clave) ?? 0) + 1)
    }

    return conteo
  }, [fechas])

  const semanas = useMemo(() => {
    const filas: Date[][] = []
    const ultimoDia = new Date(mes.getFullYear(), mes.getMonth() + 1, 0)

    for (let inicio = inicioDeSemana(mes); inicio <= ultimoDia; inicio = sumarDias(inicio, 7)) {
      filas.push(Array.from({ length: 7 }, (_, indice) => sumarDias(inicio, indice)))
    }

    return filas
  }, [mes])

  const moverMes = (delta: number) =>
    setMes((previo) => new Date(previo.getFullYear(), previo.getMonth() + delta, 1))

  const esMesActual = mes.getTime() === mesActual.getTime()
  const enSemanaActual = mismoDia(semana, inicioDeSemana(hoy))

  return (
    <section className="rounded-2xl bg-surface-lowest p-4 shadow-(--shadow-airy) sm:rounded-3xl sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
            Calendario
          </p>
          <h3
            key={mes.getTime()}
            className="ritmo-entrada mt-0.5 truncate text-base font-semibold capitalize tracking-tight text-foreground sm:text-lg"
          >
            {formatoMes.format(mes)}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!esMesActual || !enSemanaActual ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 rounded-sm px-3"
              onClick={() => {
                setMes(mesActual)
                onSeleccionarSemana(inicioDeSemana(hoy))
              }}
            >
              Hoy
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Mes anterior"
            className="size-11 rounded-full p-0"
            onClick={() => moverMes(-1)}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Mes siguiente"
            disabled={esMesActual}
            className="size-11 rounded-full p-0"
            onClick={() => moverMes(1)}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <div
          aria-hidden
          className="grid grid-cols-[repeat(7,minmax(0,1fr))_2.75rem] gap-1 px-1 font-label text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
        >
          {DIAS.map((dia) => (
            <span key={dia} className="text-center">
              {dia}
            </span>
          ))}
          <span className="text-center">Total</span>
        </div>

        {/* key por mes: al cambiarlo, las semanas entran de nuevo en cascada. */}
        <div key={mes.getTime()} className="space-y-1">
          {semanas.map((dias, fila) => {
            const inicio = dias[0]
            const seleccionada = mismoDia(inicio, semana)
            const futura = inicio > hoy
            const total = dias.reduce((suma, dia) => suma + (porDia.get(claveDia(dia)) ?? 0), 0)

            return (
              <button
                key={claveDia(inicio)}
                type="button"
                disabled={futura}
                aria-pressed={seleccionada}
                aria-label={`Semana del ${rangoSemana(inicio)}: ${total} ${
                  total === 1 ? "entrenamiento" : "entrenamientos"
                }`}
                onClick={() => onSeleccionarSemana(inicio)}
                style={{ "--i": fila } as CSSProperties}
                className={cn(
                  "ritmo-entrada grid w-full touch-manipulation grid-cols-[repeat(7,minmax(0,1fr))_2.75rem] items-center gap-1 rounded-lg p-1 transition-[background-color,box-shadow,transform] duration-300 ease-out active:scale-[0.985] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default",
                  seleccionada
                    ? "bg-[color-mix(in_oklch,var(--module-entrenamientos)_12%,transparent)] ring-1 ring-[color:var(--module-entrenamientos)]/40"
                    : "enabled:hover:bg-surface-low",
                )}
              >
                {dias.map((dia, columna) => {
                  const entrenos = porDia.get(claveDia(dia)) ?? 0
                  const fueraDeMes = dia.getMonth() !== mes.getMonth()
                  const esHoy = mismoDia(dia, hoy)

                  return (
                    <span
                      key={claveDia(dia)}
                      // Los dias entrenados "crecen" al aparecer, en orden de lectura.
                      style={
                        entrenos > 0 ? ({ "--i": fila * 7 + columna } as CSSProperties) : undefined
                      }
                      className={cn(
                        "flex h-9 items-center justify-center rounded-sm text-sm tabular-nums transition-colors duration-300 sm:h-10",
                        entrenos > 0 && "ritmo-crece",
                        entrenos > 0
                          ? "bg-(--module-entrenamientos-fill) font-semibold text-(--module-entrenamientos-on)"
                          : dia > hoy
                            ? "text-muted-foreground/40"
                            : "text-foreground",
                        fueraDeMes && "opacity-45",
                        esHoy && entrenos === 0 && "ring-1 ring-inset ring-foreground/50",
                        esHoy &&
                          entrenos > 0 &&
                          "ring-2 ring-inset ring-(--module-entrenamientos-on)/60",
                      )}
                    >
                      {dia.getDate()}
                    </span>
                  )
                })}
                <span
                  className={cn(
                    "text-center text-sm font-semibold tabular-nums",
                    total > 0
                      ? "text-[color:var(--module-entrenamientos)]"
                      : "text-muted-foreground/50",
                  )}
                >
                  {futura ? "" : total}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm bg-(--module-entrenamientos-fill)" />
          Entrenaste
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm ring-1 ring-inset ring-foreground/50" />
          Hoy
        </span>
        <span>Toca una semana para ver sus sesiones.</span>
      </div>
    </section>
  )
}
