"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SkeletonCard } from "@/components/ui/skeleton"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { formatCLP } from "@/lib/format"
import { useDeudas } from "@/modules/finanzas/hooks/useFinanzas"
import type { DeudaResponse } from "@/modules/finanzas/types/finanzas"
import { DeudaFormDialog, TIPO_DEUDA_UI } from "./deuda-form-dialog"

const tituloClass = "text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"

/** Link al registro de un movimiento que abona la deuda, con tipo y deuda ya elegidos. */
export function hrefAbonar(deuda: Pick<DeudaResponse, "id_deuda" | "tipo">) {
  const tipo = deuda.tipo === "debo" ? "gasto" : "ingreso"
  return `/app/finanzas/registrar-movimiento?tipo=${tipo}&deuda=${deuda.id_deuda}`
}

export function DeudasManager() {
  const router = useRouter()
  const query = useDeudas()
  const [creando, setCreando] = useState(false)

  const deudas = query.data?.items ?? []
  const activas = deudas.filter((deuda) => deuda.estado === "activa")
  const pagadas = deudas.filter((deuda) => deuda.estado === "pagada")
  const activasDebo = activas.filter((deuda) => deuda.tipo === "debo").length
  const activasMeDeben = activas.length - activasDebo

  if (query.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
        </div>
        <SkeletonCard className="h-32" />
        <SkeletonCard className="h-32" />
      </div>
    )
  }

  if (query.isError) {
    return <p className="text-sm font-medium text-destructive">{getFriendlyErrorMessage(query.error)}</p>
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <Total
          tipo="debo"
          monto={query.data?.total_debo ?? 0}
          detalle={activasDebo === 1 ? "1 deuda activa" : `${activasDebo} deudas activas`}
        />
        <Total
          tipo="me_deben"
          monto={query.data?.total_me_deben ?? 0}
          detalle={activasMeDeben === 1 ? "1 préstamo activo" : `${activasMeDeben} préstamos activos`}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className={tituloClass}>Activas</h2>
        <Button type="button" onClick={() => setCreando(true)}>
          <Plus className="size-4" aria-hidden />
          Nueva deuda
        </Button>
      </div>

      {activas.length === 0 ? (
        <p className="rounded-2xl bg-[color:var(--surface-lowest)] p-5 text-sm text-muted-foreground shadow-[var(--shadow-airy)]">
          {deudas.length === 0
            ? "Registra lo que debes (un crédito, una compra en cuotas) o lo que te deben. Después la vas pagando de a poco con gastos o cobrando con ingresos, y el saldo se descuenta solo."
            : "No tienes deudas pendientes."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {activas.map((deuda) => (
            <li key={deuda.id_deuda}>
              <DeudaCard deuda={deuda} />
            </li>
          ))}
        </ul>
      )}

      {pagadas.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className={tituloClass}>Pagadas</h2>
          <ul className="divide-y divide-border rounded-2xl bg-[color:var(--surface-lowest)] shadow-[var(--shadow-airy)]">
            {pagadas.map((deuda) => (
              <li key={deuda.id_deuda}>
                <Link
                  href={`/app/finanzas/deudas/${deuda.id_deuda}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-[color:var(--surface-low)]"
                >
                  <Check className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{deuda.nombre}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{TIPO_DEUDA_UI[deuda.tipo].label}</span>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{formatCLP(deuda.monto_total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <DeudaFormDialog
        open={creando}
        onOpenChange={setCreando}
        onCreada={(deuda) => router.push(`/app/finanzas/deudas/${deuda.id_deuda}`)}
      />
    </div>
  )
}

function Total({ tipo, monto, detalle }: { tipo: DeudaResponse["tipo"]; monto: number; detalle: string }) {
  const ui = TIPO_DEUDA_UI[tipo]
  return (
    <section className="flex min-w-0 flex-col gap-1 rounded-2xl p-4 sm:p-5" style={{ background: ui.color, color: ui.on }}>
      <h2 className="text-xs font-bold uppercase tracking-[0.16em] opacity-85">{ui.label}</h2>
      <p className="truncate font-display text-2xl leading-tight tabular-nums sm:text-3xl">{formatCLP(monto)}</p>
      <p className="text-xs font-medium opacity-85">{detalle}</p>
    </section>
  )
}

function BarraProgreso({ deuda }: { deuda: Pick<DeudaResponse, "abonado" | "monto_total" | "tipo"> }) {
  const porcentaje = Math.min(100, Math.round((deuda.abonado / deuda.monto_total) * 100))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={porcentaje}
      aria-label={`${porcentaje}% ${deuda.tipo === "debo" ? "pagado" : "cobrado"}`}
      className="h-2 w-full overflow-hidden rounded-sm bg-[color:var(--surface-low)]"
    >
      <div className="h-full transition-[width] duration-500" style={{ width: `${porcentaje}%`, background: TIPO_DEUDA_UI[deuda.tipo].color }} />
    </div>
  )
}

function DeudaCard({ deuda }: { deuda: DeudaResponse }) {
  const ui = TIPO_DEUDA_UI[deuda.tipo]
  const verbo = deuda.tipo === "debo" ? "Pagado" : "Cobrado"

  return (
    <article className="flex flex-col rounded-2xl bg-[color:var(--surface-lowest)] shadow-[var(--shadow-airy)]">
      <Link
        href={`/app/finanzas/deudas/${deuda.id_deuda}`}
        className="flex flex-col gap-3 rounded-t-2xl p-4 transition-colors hover:bg-[color:var(--surface-low)] sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span
              className="inline-block rounded-sm px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.12em]"
              style={{ background: ui.color, color: ui.on }}
            >
              {ui.label}
            </span>
            <h3 className="mt-1.5 truncate text-base font-semibold">{deuda.nombre}</h3>
            {deuda.contraparte ? <p className="truncate text-sm text-muted-foreground">{deuda.contraparte}</p> : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-xl leading-tight tabular-nums sm:text-2xl">{formatCLP(deuda.saldo)}</p>
            <p className="text-xs text-muted-foreground">por {deuda.tipo === "debo" ? "pagar" : "cobrar"}</p>
          </div>
        </div>
        <BarraProgreso deuda={deuda} />
        <p className="text-xs text-muted-foreground">
          {verbo} {formatCLP(deuda.abonado)} de {formatCLP(deuda.monto_total)}
          {deuda.cantidad_abonos > 0 ? ` · ${deuda.cantidad_abonos} ${deuda.cantidad_abonos === 1 ? "abono" : "abonos"}` : ""}
        </p>
      </Link>
      <div className="border-t border-border px-4 py-2 sm:px-5">
        <Link
          href={hrefAbonar(deuda)}
          className="inline-flex h-9 items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline"
        >
          <Plus className="size-4" aria-hidden />
          {ui.abonar}
        </Link>
      </div>
    </article>
  )
}
