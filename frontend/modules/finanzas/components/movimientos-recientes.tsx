"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowDownLeft, ArrowUpRight, CloudOff } from "lucide-react"
import { formatShortDate } from "@/lib/dates"
import { formatCLP } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useFinanzas } from "@/modules/finanzas/hooks/useFinanzas"

/** Ultimos movimientos junto al formulario: confirma de un vistazo lo recien anotado. */
export function MovimientosRecientes({ limit = 5 }: { limit?: number }) {
  const { movimientos, loadingCatalogos } = useFinanzas()
  const recientes = movimientos.slice(0, limit)

  // Ids visibles al cargar: solo destella lo que aparece despues (lo recien anotado).
  const [iniciales, setIniciales] = useState<Set<number> | null>(null)
  if (iniciales === null && recientes.length > 0) {
    setIniciales(new Set(recientes.map((m) => m.id_transaccion)))
  }

  return (
    <section aria-labelledby="recientes-titulo" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="recientes-titulo" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Recientes
        </h2>
        <Link href="/app/finanzas/movimientos" className="text-sm font-semibold underline-offset-4 hover:underline">
          Ver todos
        </Link>
      </div>

      {loadingCatalogos && recientes.length === 0 ? (
        <div className="flex flex-col gap-2" aria-hidden>
          {[1, 2, 3].map((item) => (
            <span key={item} className="h-14 animate-pulse rounded-lg bg-[color:var(--surface-low)]" />
          ))}
        </div>
      ) : recientes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavia no hay movimientos.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl bg-[color:var(--surface-lowest)] shadow-[var(--shadow-airy)]">
          {recientes.map((movimiento) => {
            const esIngreso = movimiento.tipo_movimiento === "ingreso"
            const Icon = esIngreso ? ArrowDownLeft : ArrowUpRight
            return (
              <li
                key={movimiento.id_transaccion}
                className={cn(
                  "first:rounded-t-xl last:rounded-b-xl",
                  iniciales !== null && !iniciales.has(movimiento.id_transaccion) && "motion-safe:animate-[ritmo-flash_1.4s_ease-out]",
                )}
              >
                <Link
                  // Un movimiento pendiente todavia no existe en el servidor: no tiene detalle.
                  href={movimiento.pendiente_sincronizacion ? "/app/finanzas/movimientos" : `/app/finanzas/movimientos/${movimiento.id_transaccion}`}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[color:var(--surface-low)]"
                >
                  <span
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md"
                    style={{
                      background: esIngreso ? "var(--ingreso)" : "var(--gasto)",
                      color: esIngreso ? "var(--ingreso-on)" : "var(--gasto-on)",
                    }}
                    aria-hidden
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold capitalize">
                      {movimiento.descripcion || movimiento.categoria || "Sin categoria"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[movimiento.descripcion ? movimiento.categoria : null, movimiento.nombre_cuenta, formatShortDate(movimiento.created_at)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold tabular-nums">
                    {movimiento.pendiente_sincronizacion ? (
                      <CloudOff className="size-3.5 text-muted-foreground" aria-label="Pendiente de sincronizar" />
                    ) : null}
                    {esIngreso ? "+" : "−"}
                    {formatCLP(movimiento.monto)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
