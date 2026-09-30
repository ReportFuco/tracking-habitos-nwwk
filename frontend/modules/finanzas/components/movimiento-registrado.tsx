"use client"

import Link from "next/link"
import { useEffect, type CSSProperties } from "react"
import { CloudOff, Plus, ShoppingBasket } from "lucide-react"
import { formatCLP } from "@/lib/format"
import type { TipoMovimiento } from "@/modules/finanzas/types/finanzas"

export interface MovimientoRegistradoInfo {
  id: string
  /** Id del movimiento en el backend; no existe si quedo en la cola offline. */
  idMovimiento?: number
  tipo: TipoMovimiento
  monto: number
  categoria?: string
  cuenta?: string
  queued: boolean
}

interface MovimientoRegistradoProps {
  info: MovimientoRegistradoInfo
  onClose: () => void
  /** Cierra y deja el formulario listo para el siguiente registro. */
  onAnother: () => void
}

const AUTO_CLOSE_MS = 2600

// Bloques de colores de modulo que salen disparados desde el check (el "cartel" de Ritmo).
const BURST = [
  { dx: "-92px", dy: "-70px", rot: "-40deg", color: "var(--module-finanzas-fill)", size: 14 },
  { dx: "88px", dy: "-78px", rot: "35deg", color: "var(--module-compras-fill)", size: 12 },
  { dx: "-110px", dy: "8px", rot: "-80deg", color: "var(--module-nutricion-fill)", size: 10 },
  { dx: "112px", dy: "4px", rot: "70deg", color: "var(--module-entrenamientos-fill)", size: 14 },
  { dx: "-60px", dy: "-104px", rot: "20deg", color: "var(--highlight)", size: 9 },
  { dx: "58px", dy: "-110px", rot: "-25deg", color: "var(--module-finanzas-fill)", size: 9 },
  { dx: "-30px", dy: "-120px", rot: "60deg", color: "var(--module-entrenamientos-fill)", size: 8 },
  { dx: "26px", dy: "-124px", rot: "-60deg", color: "var(--module-nutricion-fill)", size: 11 },
]

/**
 * Confirmacion de un movimiento registrado. Aparece sobre el formulario, se cierra sola y
 * se puede descartar con un toque o Escape. Anuncia el resultado a lectores de pantalla.
 */
export function MovimientoRegistrado({ info, onClose, onAnother }: MovimientoRegistradoProps) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, AUTO_CLOSE_MS)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("keydown", onKey)
    }
  }, [info.id, onClose])

  const esIngreso = info.tipo === "ingreso"
  const color = esIngreso ? "var(--ingreso)" : "var(--gasto)"
  const onColor = esIngreso ? "var(--ingreso-on)" : "var(--gasto-on)"
  const titulo = info.queued
    ? "Guardado sin conexion"
    : esIngreso
      ? "Ingreso registrado"
      : "Gasto registrado"
  const detalle = [info.categoria, info.cuenta].filter(Boolean).join(" · ")

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] motion-safe:animate-[ritmo-fade_180ms_ease-out] sm:items-center sm:pb-4"
      onClick={onClose}
    >
      <div
        role="status"
        aria-live="polite"
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-sm overflow-visible rounded-2xl p-5 shadow-[var(--shadow-airy-lg)] motion-safe:animate-[ritmo-pop_520ms_cubic-bezier(0.2,0.9,0.3,1.2)_both]"
        style={{ background: color, color: onColor }}
      >
        <div className="relative mx-auto flex size-16 items-center justify-center">
          {BURST.map((block, index) => (
            <span
              key={index}
              aria-hidden
              className="absolute top-1/2 left-1/2 -mt-1.5 -ml-1.5 rounded-[2px] opacity-0 motion-safe:animate-[ritmo-burst_700ms_cubic-bezier(0.1,0.7,0.3,1)_120ms_both]"
              style={
                {
                  width: block.size,
                  height: block.size,
                  background: block.color,
                  "--dx": block.dx,
                  "--dy": block.dy,
                  "--rot": block.rot,
                } as CSSProperties
              }
            />
          ))}
          <span
            className="relative flex size-16 items-center justify-center rounded-lg bg-[color:var(--sidebar)] text-[color:var(--highlight)]"
            aria-hidden
          >
            {info.queued ? (
              <CloudOff className="size-7" />
            ) : (
              <svg viewBox="0 0 24 24" className="size-8" fill="none">
                <path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="square"
                  strokeDasharray={32}
                  className="motion-safe:animate-[ritmo-check_380ms_ease-out_220ms_both]"
                />
              </svg>
            )}
          </span>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-85">{titulo}</p>
          <p className="mt-1 font-display text-4xl leading-none">
            {esIngreso ? "+" : "−"}
            {formatCLP(info.monto)}
          </p>
          {detalle ? <p className="mt-2 text-sm capitalize opacity-90">{detalle}</p> : null}
          {info.queued ? (
            <p className="mt-2 text-xs opacity-85">Se envia solo cuando vuelva internet.</p>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onAnother}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-[color:var(--sidebar)] text-sm font-semibold text-[color:var(--sidebar-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sidebar)]"
          >
            <Plus className="size-4" aria-hidden />
            Anotar otro
          </button>
          <Link
            href="/app/finanzas/movimientos"
            className="inline-flex min-h-11 items-center justify-center rounded-md border-2 border-current text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Ver movimientos
          </Link>
        </div>
        {!esIngreso && info.idMovimiento ? (
          <Link
            href={`/app/finanzas/movimientos/${info.idMovimiento}`}
            className="mt-2 flex min-h-11 items-center justify-center gap-1.5 rounded-md text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <ShoppingBasket className="size-4" aria-hidden />
            Detallar productos
          </Link>
        ) : null}

        {/* Cuenta regresiva del cierre automatico. */}
        <span
          aria-hidden
          className="absolute inset-x-5 bottom-0 h-1 origin-left bg-current opacity-40 motion-safe:animate-[ritmo-countdown_2600ms_linear_both]"
        />
      </div>
    </div>
  )
}
