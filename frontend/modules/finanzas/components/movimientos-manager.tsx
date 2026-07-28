"use client"

import { useRouter } from "next/navigation"
import { ArrowUpRight, ShoppingCart, Wallet } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useFinanzas } from "@/modules/finanzas/hooks/useFinanzas"
import { MovimientosSkeleton } from "@/modules/finanzas/components/skeletons/movimientos-skeleton"
import { TipoMovimiento } from "@/modules/finanzas/types/finanzas"

export function MovimientosManager() {
  const router = useRouter()
  const {
    movimientos,
    totalGastoMensual,
    hasMoreMovimientos,
    loadingMoreMovimientos,
    loadingCatalogos,
    loadMoreMovimientos,
  } = useFinanzas()

  const totalIngresos = movimientos
    .filter((m) => m.tipo_movimiento === "ingreso")
    .reduce((acc, m) => acc + m.monto, 0)

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(value)

  const formatDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat("es-CL", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    } catch {
      return value
    }
  }

  const getCategoryTone = (tipo: TipoMovimiento) =>
    tipo === "ingreso" ? "bg-secondary" : "bg-module-finanzas"

  const navigate = (id: number) => router.push(`/app/finanzas/movimientos/${id}`)

  if (loadingCatalogos && movimientos.length === 0) {
    return <MovimientosSkeleton />
  }

  return (
    <section className="flex flex-col gap-4 sm:gap-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
        <article className="hidden rounded-[1.5rem] bg-surface-low p-4 sm:block sm:p-6 lg:col-span-1 sm:col-span-2">
          <p className="font-label text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
            Diario financiero
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-2xl lg:text-3xl">
            Tus movimientos toman el protagonismo aqui.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-5 text-muted-foreground sm:leading-6">
            Esta vista se concentra en revisar, leer y ajustar movimientos existentes.
          </p>
        </article>

        <article className="rounded-[1.5rem] bg-surface-lowest p-4 shadow-(--shadow-airy) sm:p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">
            <ArrowUpRight className="size-3.5 text-module-finanzas sm:size-4" />
            Ingresos
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:mt-4 sm:text-3xl">
            {formatCurrency(totalIngresos)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:mt-2 sm:text-sm">
            Suma de ingresos cargados.
          </p>
        </article>

        <article className="rounded-[1.5rem] bg-surface-lowest p-4 shadow-(--shadow-airy) sm:p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">
            <Wallet className="size-3.5 text-module-finanzas sm:size-4" />
            Gastos del mes
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:mt-4 sm:text-3xl">
            {formatCurrency(totalGastoMensual)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:mt-2 sm:text-sm">
            Total mensual segun el servidor.
          </p>
        </article>
      </section>

      <section className="rounded-[1.75rem] bg-surface-low p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-label text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
              Registro actual
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Movimientos recientes
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            En desktop se muestran como tabla. En pantallas pequenas, como cards editoriales.
          </p>
        </div>

        {movimientos.length === 0 ? (
          <div className="mt-6 rounded-[1.5rem] bg-surface-lowest p-6 text-sm leading-6 text-muted-foreground shadow-(--shadow-airy)">
            Aun no tienes movimientos registrados. Usa el flujo de{" "}
            <span className="font-medium text-foreground">Registrar movimientos</span> para comenzar a construir tu diario financiero.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="mt-6 hidden overflow-hidden rounded-[1.5rem] bg-surface-low shadow-[0_8px_48px_-12px_rgba(0,0,0,0.05)] lg:block">
              <Table>
                <TableHeader className="bg-primary text-primary-foreground">
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableHead className="px-8 py-5 font-label text-[10px] font-bold uppercase tracking-[0.22em] text-primary-foreground">
                      Movimiento
                    </TableHead>
                    <TableHead className="px-6 py-5 font-label text-[10px] font-bold uppercase tracking-[0.22em] text-primary-foreground">
                      Categoria
                    </TableHead>
                    <TableHead className="px-6 py-5 font-label text-[10px] font-bold uppercase tracking-[0.22em] text-primary-foreground">
                      Cuenta
                    </TableHead>
                    <TableHead className="px-6 py-5 font-label text-[10px] font-bold uppercase tracking-[0.22em] text-primary-foreground">
                      Fecha
                    </TableHead>
                    <TableHead className="px-6 py-5 text-right font-label text-[10px] font-bold uppercase tracking-[0.22em] text-primary-foreground">
                      Monto
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:not(:last-child)]:border-b [&_tr:not(:last-child)]:border-border/30">
                  {movimientos.map((movimiento, index) => (
                    <TableRow
                      key={movimiento.id_transaccion}
                      role="link"
                      tabIndex={0}
                      className={cn(
                        "cursor-pointer border-0 transition-colors hover:bg-primary/8 focus-visible:bg-primary/8",
                        index % 2 === 0 ? "bg-surface-lowest" : "bg-surface-low"
                      )}
                      onClick={() => navigate(movimiento.id_transaccion)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          navigate(movimiento.id_transaccion)
                        }
                      }}
                    >
                      <TableCell className="px-5 py-4 align-top">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em]",
                                movimiento.tipo_movimiento === "ingreso"
                                  ? "bg-secondary/12 text-secondary"
                                  : "bg-primary/12 text-primary"
                              )}
                            >
                              {movimiento.tipo_movimiento}
                            </span>
                            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                              {movimiento.tipo_gasto}
                            </span>
                            {(movimiento.compras_vinculadas?.length ?? 0) > 0 ? (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground" title="Tiene compras vinculadas">
                                <ShoppingCart className="size-3" />
                                {movimiento.compras_vinculadas!.length}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {movimiento.descripcion || "Sin descripcion"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-6">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", getCategoryTone(movimiento.tipo_movimiento))} />
                          <span>{movimiento.categoria ?? "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-6">{movimiento.nombre_cuenta ?? "-"}</TableCell>
                      <TableCell className="px-5 py-4 text-sm text-muted-foreground">
                        {formatDate(movimiento.created_at)}
                      </TableCell>
                      <TableCell className="px-8 py-6 text-right">
                        <span className="font-mono font-semibold tracking-tight">
                          {formatCurrency(movimiento.monto)}
                        </span>
                        {(movimiento.total_compras_vinculadas ?? 0) > 0 ? (
                          <p className="text-[11px] text-muted-foreground">
                            {formatCurrency(movimiento.total_compras_vinculadas!)} en compras
                          </p>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <footer className="flex items-center justify-between border-t border-border/30 bg-surface-low px-8 py-4">
                <span className="font-label text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Mostrando {movimientos.length} movimiento{movimientos.length === 1 ? "" : "s"}
                </span>
                {hasMoreMovimientos ? (
                  <button
                    onClick={() => void loadMoreMovimientos()}
                    disabled={loadingMoreMovimientos}
                    className="text-xs font-medium text-primary transition hover:text-primary/80 disabled:opacity-50"
                  >
                    {loadingMoreMovimientos ? "Cargando..." : "Cargar más"}
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">Diario financiero activo</span>
                )}
              </footer>
            </div>

            {/* Mobile cards */}
            <div className="mt-6 grid gap-4 lg:hidden">
              {movimientos.map((movimiento) => (
                <article
                  key={movimiento.id_transaccion}
                  className="rounded-[1.5rem] bg-surface-lowest p-5 shadow-(--shadow-airy)"
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(movimiento.id_transaccion)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      navigate(movimiento.id_transaccion)
                    }
                  }}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em]",
                              movimiento.tipo_movimiento === "ingreso"
                                ? "bg-secondary/12 text-secondary"
                                : "bg-primary/12 text-primary"
                            )}
                          >
                            {movimiento.tipo_movimiento}
                          </span>
                          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            {movimiento.tipo_gasto}
                          </span>
                          {(movimiento.compras_vinculadas?.length ?? 0) > 0 ? (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <ShoppingCart className="size-3" />
                              {movimiento.compras_vinculadas!.length} compra{movimiento.compras_vinculadas!.length === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-lg font-semibold tracking-tight text-foreground">
                          {formatCurrency(movimiento.monto)}
                        </p>
                        {(movimiento.total_compras_vinculadas ?? 0) > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(movimiento.total_compras_vinculadas!)} en compras vinculadas
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.25rem] bg-surface-low p-4">
                        <p className="font-label text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
                          Categoria
                        </p>
                        <p className="mt-2 text-sm text-foreground">{movimiento.categoria ?? "-"}</p>
                      </div>
                      <div className="rounded-[1.25rem] bg-surface-low p-4">
                        <p className="font-label text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
                          Cuenta
                        </p>
                        <p className="mt-2 text-sm text-foreground">
                          {movimiento.nombre_cuenta ?? "-"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>{movimiento.descripcion || "Sin descripcion"}</p>
                      <p>{formatDate(movimiento.created_at)}</p>
                    </div>
                  </div>
                </article>
              ))}

              {hasMoreMovimientos ? (
                <button
                  onClick={() => void loadMoreMovimientos()}
                  disabled={loadingMoreMovimientos}
                  className="rounded-[1.5rem] bg-surface-lowest py-4 text-sm font-medium text-primary shadow-(--shadow-airy) transition hover:bg-primary/5 disabled:opacity-50"
                >
                  {loadingMoreMovimientos ? "Cargando..." : "Cargar más movimientos"}
                </button>
              ) : null}
            </div>
          </>
        )}
      </section>
    </section>
  )
}
