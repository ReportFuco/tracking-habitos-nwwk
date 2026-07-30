"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowUpRight, Landmark, MapPin, ReceiptText, Wallet } from "lucide-react"
import { FinanzasAPI } from "@/modules/finanzas/api/finanzas.api"
import { MovimientoDetailSkeleton } from "@/modules/finanzas/components/skeletons/movimiento-detail-skeleton"
import type { MovimientoResponse } from "@/modules/finanzas/types/finanzas"
import { getFriendlyErrorMessage } from "@/lib/error-messages"

export function MovimientoDetailView({ idMovimiento }: { idMovimiento: number }) {
  const router = useRouter()
  const [movimiento, setMovimiento] = useState<MovimientoResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await FinanzasAPI.getMovimientoById(idMovimiento)
        setMovimiento(data)
      } catch (err) {
        setError(getFriendlyErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [idMovimiento])

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(value)

  const formatDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat("es-CL", {
        dateStyle: "full",
        timeStyle: "short",
      }).format(new Date(value))
    } catch {
      return value
    }
  }

  if (loading) {
    return <MovimientoDetailSkeleton includeChrome={false} />
  }

  if (error || !movimiento) {
    return (
      <section className="rounded-[1.75rem] bg-[color:var(--surface-low)] p-6">
        <p className="text-sm text-muted-foreground">
          {error ?? "No pudimos cargar este movimiento."}
        </p>
        <button
          type="button"
          onClick={() => router.push("/app/finanzas/movimientos")}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver a movimientos
        </button>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-6">
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[1.75rem] bg-[color:var(--surface-low)] p-6">
          <p className="font-label text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
            Movimiento
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground">
            {formatCurrency(movimiento.monto)}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            {movimiento.descripcion || "Este movimiento no tiene descripcion registrada."}
          </p>
        </article>

        <article className="rounded-[1.75rem] bg-[color:var(--surface-lowest)] p-6 shadow-[var(--shadow-airy)]">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex rounded-full bg-primary/12 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
              {movimiento.tipo_movimiento}
            </span>
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {movimiento.tipo_gasto}
            </span>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Entrada individual del diario financiero asociada a tu cuenta y categoria.
          </p>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-5 shadow-[var(--shadow-airy)]">
          <p className="font-label text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
            Categoria
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm text-foreground">
            <ArrowUpRight className="size-4 text-[color:var(--module-finanzas)]" />
            {movimiento.categoria ?? "-"}
          </p>
        </article>
        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-5 shadow-[var(--shadow-airy)]">
          <p className="font-label text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
            Cuenta bancaria
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm text-foreground">
            <Landmark className="size-4 text-[color:var(--module-finanzas)]" />
            {movimiento.nombre_cuenta ?? "-"}
          </p>
        </article>
        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-5 shadow-[var(--shadow-airy)]">
          <p className="font-label text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
            Fecha
          </p>
          <p className="mt-3 text-sm text-foreground">{formatDate(movimiento.created_at)}</p>
        </article>
        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-5 shadow-[var(--shadow-airy)]">
          <p className="font-label text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
            Registro
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm text-foreground">
            <ReceiptText className="size-4 text-[color:var(--module-finanzas)]" />
            ID #{movimiento.id_transaccion}
          </p>
        </article>
        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-5 shadow-[var(--shadow-airy)]">
          <p className="font-label text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
            Lugar de compra
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm text-foreground">
            <MapPin className="size-4 text-[color:var(--module-finanzas)]" />
            {movimiento.en_lugar_compra
              ? `Confirmado · ±${Math.round(movimiento.precision_ubicacion ?? 0)} m`
              : "No asociado"}
          </p>
        </article>
      </section>

      <section className="rounded-[1.75rem] bg-[color:var(--surface-low)] p-6">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/app/finanzas/movimientos"
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--surface-lowest)] px-4 py-2 text-sm font-medium text-foreground shadow-[var(--shadow-airy)] transition hover:bg-[color:var(--surface-variant)]"
          >
            <ArrowLeft className="size-4" />
            Volver a movimientos
          </Link>
          <Link
            href="/app/finanzas/registrar-movimiento"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            <Wallet className="size-4" />
            Registrar otro movimiento
          </Link>
        </div>
      </section>
    </section>
  )
}
