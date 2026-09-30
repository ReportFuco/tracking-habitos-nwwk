"use client"

import { FormEvent, useState } from "react"
import { Pencil, Plus, ShoppingBasket, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatCLP } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useMovimientoItems } from "@/modules/finanzas/hooks/useFinanzas"
import type { MovimientoItemResponse, MovimientoResponse } from "@/modules/finanzas/types/finanzas"
import { AgregarProductoDialog, EstadoBadge, parseCantidad } from "./agregar-producto-dialog"

const cantidadFormatter = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 })
const milesFormatter = new Intl.NumberFormat("es-CL")

/**
 * Detalle de productos de un gasto. Es opcional y puede ser parcial: la barra muestra
 * cuanto del monto ya esta detallado.
 */
export function MovimientoProductos({ movimiento }: { movimiento: MovimientoResponse }) {
  const { agregarItem, editarItem, quitarItem, guardandoItem } = useMovimientoItems(movimiento.id_transaccion)
  const [agregando, setAgregando] = useState(false)
  const [editando, setEditando] = useState<MovimientoItemResponse | null>(null)

  const items = movimiento.items
  const detallado = movimiento.total_detallado
  const restante = movimiento.monto - detallado
  const porcentaje = Math.min(100, Math.round((detallado / movimiento.monto) * 100))

  if (movimiento.pendiente_sincronizacion) {
    return (
      <section className="rounded-2xl bg-[color:var(--surface-lowest)] p-4 text-sm text-muted-foreground shadow-[var(--shadow-airy)]">
        Podras detallar los productos cuando este gasto se sincronice.
      </section>
    )
  }

  const quitar = async (item: MovimientoItemResponse) => {
    const result = await quitarItem(item.id_item)
    if (!result.ok) toast.error("No pudimos quitar el producto", { description: result.message })
  }

  return (
    <section aria-labelledby="productos-titulo" className="flex flex-col gap-3 rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="productos-titulo" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Productos
        </h2>
        {items.length > 0 ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setAgregando(true)}>
            <Plus className="size-4" aria-hidden />
            Agregar
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            Anota que compraste en este gasto. Con el tiempo veras cuanto pagas por cada producto.
          </p>
          <Button type="button" onClick={() => setAgregando(true)}>
            <ShoppingBasket className="size-4" aria-hidden />
            Detallar productos
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">
                Detallado {formatCLP(detallado)} <span className="font-normal text-muted-foreground">de {formatCLP(movimiento.monto)}</span>
              </span>
              <span className={cn("text-xs", restante < 0 ? "font-semibold text-destructive" : "text-muted-foreground")}>
                {restante > 0 ? `Faltan ${formatCLP(restante)}` : restante < 0 ? `Supera por ${formatCLP(-restante)}` : "Completo"}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Monto detallado"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={porcentaje}
              className="h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-low)]"
            >
              <div className="h-full bg-[color:var(--gasto)] transition-[width]" style={{ width: `${porcentaje}%` }} />
            </div>
          </div>

          <ul className="divide-y divide-border">
            {items.map((item) => {
              const detalle = [item.nombre_marca, item.detalle_producto].filter(Boolean).join(" · ")
              return (
                <li key={item.id_item} className="flex items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{item.nombre_producto}</span>
                      {item.estado_producto !== "aprobado" ? <EstadoBadge estado={item.estado_producto} /> : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {cantidadFormatter.format(item.cantidad)}
                      {item.precio_unitario != null && item.cantidad !== 1 ? ` × ${formatCLP(Math.round(item.precio_unitario))}` : ""}
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
                    aria-label={`Editar ${item.nombre_producto}`}
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setEditando(item)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Quitar ${item.nombre_producto}`}
                    className="text-muted-foreground hover:text-destructive"
                    disabled={guardandoItem}
                    onClick={() => void quitar(item)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <AgregarProductoDialog open={agregando} onOpenChange={setAgregando} restante={restante} onAgregar={agregarItem} />
      {editando ? (
        <EditarItemDialog
          key={editando.id_item}
          item={editando}
          onClose={() => setEditando(null)}
          onGuardar={(payload) => editarItem(editando.id_item, payload)}
        />
      ) : null}
    </section>
  )
}

function EditarItemDialog({
  item,
  onClose,
  onGuardar,
}: {
  item: MovimientoItemResponse
  onClose: () => void
  onGuardar: (payload: { cantidad: number; precio_total: number | null }) => Promise<{ ok: true } | { ok: false; message: string }>
}) {
  const [cantidad, setCantidad] = useState(String(item.cantidad).replace(".", ","))
  const [precio, setPrecio] = useState(item.precio_total != null ? String(item.precio_total) : "")
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const guardar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const valorCantidad = parseCantidad(cantidad)
    if (!(valorCantidad > 0)) {
      setError("La cantidad debe ser mayor a 0")
      return
    }
    setGuardando(true)
    const result = await onGuardar({ cantidad: valorCantidad, precio_total: precio ? Number(precio) : null })
    setGuardando(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    onClose()
  }

  const inputClass = "h-11 w-full min-w-0 rounded-md border border-border bg-transparent px-3 text-sm tabular-nums outline-none focus:border-foreground"

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="p-4 sm:max-w-sm sm:p-6">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle className="truncate">{item.nombre_producto}</DialogTitle>
          <DialogDescription>Corrige la cantidad o el precio. Deja el precio vacio si no lo sabes.</DialogDescription>
        </DialogHeader>
        <form onSubmit={guardar} noValidate className="flex flex-col gap-4">
          <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="editar-item-cantidad" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Cantidad
              </label>
              <input
                id="editar-item-cantidad"
                inputMode="decimal"
                value={cantidad}
                onChange={(event) => setCantidad(event.target.value.replace(/[^\d.,]/g, ""))}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="editar-item-precio" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Precio total
              </label>
              <input
                id="editar-item-precio"
                inputMode="numeric"
                placeholder="Sin precio"
                value={precio ? milesFormatter.format(Number(precio)) : ""}
                onChange={(event) => setPrecio(event.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 11))}
                className={inputClass}
              />
            </div>
          </div>
          {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" className="h-11 flex-1" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
            <Button type="button" variant="outline" className="h-11" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
