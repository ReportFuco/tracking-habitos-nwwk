"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { addDays, formatShortDate, toLocalIsoDate } from "@/lib/dates"
import { formatCLP } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useFinanzas } from "@/modules/finanzas/hooks/useFinanzas"
import { esProductoCredito, resumirSaldos } from "@/modules/finanzas/saldo"
import type { CuentaResponse } from "@/modules/finanzas/types/finanzas"
import { SaldoCuentaDialog } from "./saldo-cuenta-dialog"

interface Props {
  /** En la pagina de cuentas cada fila se puede ajustar; en la portada solo se declara. */
  ajustable?: boolean
}

/**
 * Cuanto hay en las cuentas: lo disponible arriba y cada cuenta abajo. Una cuenta sin
 * saldo declarado ofrece declararlo en el momento; desde ahi lo mueven los movimientos.
 */
export function SaldoCuentas({ ajustable = false }: Props) {
  const { cuentas, loadingCatalogos } = useFinanzas()
  const [editando, setEditando] = useState<CuentaResponse | null>(null)

  if (loadingCatalogos && cuentas.length === 0) {
    return <div aria-hidden className="h-40 animate-pulse rounded-2xl bg-[color:var(--surface-low)]" />
  }

  if (cuentas.length === 0) {
    return (
      <section className="flex flex-col items-start gap-3 rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
        <p className="text-sm text-muted-foreground">
          Agrega tu cuenta del banco (o tu efectivo) con lo que tienes hoy, y Ritmo te lleva el saldo con cada gasto
          que anotes.
        </p>
        <Link
          href="/app/finanzas/registrar-cuenta"
          className="inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
        >
          <Plus className="size-4" aria-hidden />
          Agregar mi primera cuenta
        </Link>
      </section>
    )
  }

  const resumen = resumirSaldos(cuentas)

  return (
    <section className="overflow-hidden rounded-2xl bg-[color:var(--surface-lowest)] shadow-[var(--shadow-airy)]">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 p-4 sm:p-5">
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Disponible</p>
          {resumen.conSaldo > 0 ? (
            <p className="font-display text-[2rem] leading-none tabular-nums sm:text-4xl">{formatCLP(resumen.disponible)}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Declara cuánto tienes en tus cuentas para verlo aquí.</p>
          )}
        </div>
        {resumen.deudaTarjetas > 0 ? (
          <p className="text-sm text-muted-foreground">
            Tarjetas: debes <strong className="tabular-nums text-[color:var(--gasto)]">{formatCLP(resumen.deudaTarjetas)}</strong>
          </p>
        ) : null}
      </header>

      <ul className="divide-y divide-border border-t border-border">
        {cuentas.map((cuenta) => (
          <FilaCuenta key={cuenta.id_cuenta} cuenta={cuenta} ajustable={ajustable} onAjustar={() => setEditando(cuenta)} />
        ))}
      </ul>

      <SaldoCuentaDialog cuenta={editando} onOpenChange={(open) => (open ? null : setEditando(null))} />
    </section>
  )
}

/** "desde 17 oct" (o "desde 3 nov 2025"): el saldo cuenta los movimientos de ese dia en adelante. */
function desdeCuando(fechaSaldoInicial: string | null | undefined) {
  if (!fechaSaldoInicial) return null
  const desde = addDays(fechaSaldoInicial.slice(0, 10), 1)
  const otroAnio = desde.slice(0, 4) !== toLocalIsoDate().slice(0, 4)
  return `desde ${formatShortDate(desde)}${otroAnio ? ` ${desde.slice(0, 4)}` : ""}`
}

function FilaCuenta({
  cuenta,
  ajustable,
  onAjustar,
}: {
  cuenta: CuentaResponse
  ajustable: boolean
  onAjustar: () => void
}) {
  const saldo = cuenta.saldo_actual
  const credito = esProductoCredito(cuenta.nombre_producto)
  const detalle = [cuenta.nombre_banco, cuenta.nombre_producto].filter(Boolean).join(" · ")
  const desde = desdeCuando(cuenta.fecha_saldo_inicial)

  return (
    <li className="flex min-h-14 items-center gap-3 px-4 py-2.5 sm:px-5">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">{cuenta.nombre_cuenta}</span>
        {detalle ? <span className="truncate text-xs text-muted-foreground">{detalle}</span> : null}
      </span>
      {saldo == null ? (
        <button
          type="button"
          onClick={onAjustar}
          className="shrink-0 rounded-md bg-[color:var(--module-finanzas-fill)] px-3 py-1.5 text-xs font-bold text-[color:var(--module-finanzas-on)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {credito ? "¿Cuánto debes?" : "¿Cuánto tienes?"}
        </button>
      ) : (
        <span className="flex shrink-0 items-center gap-3">
          <span className="flex flex-col items-end">
            <span
              className={cn("font-semibold tabular-nums", (credito || saldo < 0) && saldo !== 0 && "text-[color:var(--gasto)]")}
            >
              {credito ? formatCLP(Math.max(0, -saldo)) : formatCLP(saldo)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {[credito ? "debes" : null, desde].filter(Boolean).join(" · ")}
            </span>
          </span>
          {ajustable ? (
            <button
              type="button"
              onClick={onAjustar}
              className="text-xs font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Ajustar
            </button>
          ) : null}
        </span>
      )}
    </li>
  )
}
