"use client"

import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatCLP } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ProductoResponse } from "@/modules/catalogo/types/catalogo"
import type { MovimientoItemCreate } from "@/modules/finanzas/types/finanzas"
import { AgregarProductoDialog, detalleProducto, EstadoBadge } from "./agregar-producto-dialog"

/** Producto anotado en el formulario, antes de que exista el gasto. */
export interface ProductoPorGuardar {
  key: string
  producto: ProductoResponse
  cantidad: number
  precio_total: number | null
}

const cantidadFormatter = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 })

export function totalDetallado(items: ProductoPorGuardar[]) {
  return items.reduce((total, item) => total + (item.precio_total ?? 0), 0)
}

export function aItemsCreate(items: ProductoPorGuardar[]): MovimientoItemCreate[] {
  return items.map(({ producto, cantidad, precio_total }) => ({ id_producto: producto.id_producto, cantidad, precio_total }))
}

interface Props {
  items: ProductoPorGuardar[]
  onChange: (items: ProductoPorGuardar[]) => void
  monto: number
  agregando: boolean
  onAgregandoChange: (abierto: boolean) => void
}

/**
 * Productos de un gasto que aun no se registra: se guardan junto con el en la misma
 * solicitud. Usa el mismo dialogo que el detalle de un gasto ya creado.
 */
export function ProductosNuevoGasto({ items, onChange, monto, agregando, onAgregandoChange }: Props) {
  const detallado = totalDetallado(items)
  const restante = monto - detallado

  const agregar = async (payload: MovimientoItemCreate, producto: ProductoResponse) => {
    onChange([
      ...items,
      { key: crypto.randomUUID(), producto, cantidad: payload.cantidad ?? 1, precio_total: payload.precio_total ?? null },
    ])
    return { ok: true } as const
  }

  return (
    <>
      {items.length > 0 ? (
        <div className="-mt-2 flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Productos</span>
            {monto > 0 && detallado > 0 ? (
              <span className={cn("text-xs", restante < 0 ? "font-semibold text-destructive" : "text-muted-foreground")}>
                {restante > 0 ? `Faltan ${formatCLP(restante)}` : restante < 0 ? `Supera por ${formatCLP(-restante)}` : "Completo"}
              </span>
            ) : null}
          </div>
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const detalle = [item.producto.nombre_marca, detalleProducto(item.producto)].filter(Boolean).join(" · ")
              return (
                <li key={item.key} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{item.producto.nombre_producto}</span>
                      {item.producto.estado !== "aprobado" ? <EstadoBadge estado={item.producto.estado} /> : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {cantidadFormatter.format(item.cantidad)}
                      {detalle ? ` · ${detalle}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {item.precio_total != null ? formatCLP(item.precio_total) : <span className="font-normal text-muted-foreground">Sin precio</span>}
                  </span>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Quitar ${item.producto.nombre_producto}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => onChange(items.filter((otro) => otro.key !== item.key))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            onClick={() => onAgregandoChange(true)}
            className="inline-flex items-center gap-1 self-start text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <Plus className="size-3.5" aria-hidden />
            Agregar otro producto
          </button>
        </div>
      ) : null}

      <AgregarProductoDialog open={agregando} onOpenChange={onAgregandoChange} restante={restante} onAgregar={agregar} />
    </>
  )
}
