"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { formatMonth, toLocalIsoDate } from "@/lib/dates"
import { cn } from "@/lib/utils"

export interface Periodo {
  year: number
  month: number
}

export function mesActual(): Periodo {
  const [year, month] = toLocalIsoDate().split("-").map(Number)
  return { year, month }
}

export function mesAnterior({ year, month }: Periodo): Periodo {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

/** Mes seleccionado (arranca en el actual, en hora de Chile) y navegacion entre meses. */
export function usePeriodoMensual() {
  const [periodo, setPeriodo] = useState<Periodo>(mesActual)
  const actual = mesActual()
  const esMesActual = periodo.year === actual.year && periodo.month === actual.month
  const mover = (delta: number) =>
    setPeriodo(({ year, month }) => {
      const total = year * 12 + (month - 1) + delta
      return { year: Math.floor(total / 12), month: (total % 12) + 1 }
    })
  return { periodo, esMesActual, mover }
}

export function PeriodoSelector({
  periodo,
  esMesActual,
  onMove,
  className,
}: {
  periodo: Periodo
  esMesActual: boolean
  onMove: (delta: number) => void
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        onClick={() => onMove(-1)}
        aria-label="Mes anterior"
        className="inline-flex size-10 items-center justify-center rounded-md hover:bg-[color:var(--surface-low)] focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ChevronLeft className="size-5" />
      </button>
      <p className="min-w-0 flex-1 text-center font-display text-lg capitalize sm:flex-none sm:px-2 sm:text-xl" aria-live="polite">
        {formatMonth(periodo.year, periodo.month)} {periodo.year}
      </p>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={esMesActual}
        aria-label="Mes siguiente"
        className="inline-flex size-10 items-center justify-center rounded-md hover:bg-[color:var(--surface-low)] focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-30"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  )
}
