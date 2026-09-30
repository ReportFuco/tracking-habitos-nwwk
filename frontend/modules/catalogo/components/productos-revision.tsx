"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, GitMerge, Pencil, X } from "lucide-react"
import { toast } from "sonner"
import { FormPanel } from "@/components/forms/editorial-form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { queryKeys } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import { CatalogoAPI } from "@/modules/catalogo/api/catalogo.api"
import type { ProductoResponse } from "@/modules/catalogo/types/catalogo"

const fechaFormatter = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" })

function detalle(producto: ProductoResponse) {
  const contenido =
    producto.contenido_neto != null ? `${producto.contenido_neto} ${producto.unidad_contenido ?? ""}`.trim() : null
  return [producto.nombre_marca, contenido, producto.formato, producto.sabor, producto.codigo_barra]
    .filter(Boolean)
    .join(" · ")
}

/**
 * Cola de productos que propusieron los usuarios. Aprobar los suma al catalogo
 * compartido; si ya existia, se fusionan (sus usos pasan al existente); rechazar los deja
 * privados de quien los creo.
 */
export function ProductosRevision({ onEditar }: { onEditar: (producto: ProductoResponse) => void }) {
  const queryClient = useQueryClient()
  const [fusionando, setFusionando] = useState<ProductoResponse | null>(null)

  const pendientesQuery = useQuery({
    queryKey: queryKeys.catalogo.productosRevision("pendiente"),
    queryFn: () => CatalogoAPI.getProductosEnRevision("pendiente"),
  })

  const invalidar = () => queryClient.invalidateQueries({ queryKey: queryKeys.catalogo.productosRoot })
  const accion = useMutation({
    mutationFn: ({ tipo, producto }: { tipo: "aprobar" | "rechazar"; producto: ProductoResponse }) =>
      tipo === "aprobar" ? CatalogoAPI.aprobarProducto(producto.id_producto) : CatalogoAPI.rechazarProducto(producto.id_producto),
    onSuccess: (_data, { tipo, producto }) => {
      toast.success(tipo === "aprobar" ? `«${producto.nombre_producto}» aprobado` : `«${producto.nombre_producto}» rechazado`)
      return invalidar()
    },
    onError: (err) => toast.error("No se pudo completar", { description: getFriendlyErrorMessage(err) }),
  })

  const pendientes = pendientesQuery.data ?? []
  if (pendientesQuery.isLoading || pendientes.length === 0) return null

  return (
    <FormPanel eyebrow={`Por revisar · ${pendientes.length}`}>
      <ul className="divide-y divide-border">
        {pendientes.map((producto) => (
          <li key={producto.id_producto} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-medium">{producto.nombre_producto}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[detalle(producto), `@${producto.username_creador ?? "usuario"}`, fechaFormatter.format(new Date(producto.created_at))]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1">
              <Button size="sm" disabled={accion.isPending} onClick={() => accion.mutate({ tipo: "aprobar", producto })}>
                <Check className="size-4" aria-hidden />
                Aprobar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setFusionando(producto)}>
                <GitMerge className="size-4" aria-hidden />
                Fusionar
              </Button>
              <Button size="sm" variant="ghost" aria-label={`Editar ${producto.nombre_producto}`} onClick={() => onEditar(producto)}>
                <Pencil className="size-4" aria-hidden />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={accion.isPending}
                onClick={() => accion.mutate({ tipo: "rechazar", producto })}
              >
                <X className="size-4" aria-hidden />
                Rechazar
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {fusionando ? (
        <FusionarDialog
          key={fusionando.id_producto}
          origen={fusionando}
          onClose={() => setFusionando(null)}
          onFusionado={async () => {
            setFusionando(null)
            await invalidar()
          }}
        />
      ) : null}
    </FormPanel>
  )
}

function FusionarDialog({
  origen,
  onClose,
  onFusionado,
}: {
  origen: ProductoResponse
  onClose: () => void
  onFusionado: () => Promise<void>
}) {
  const [busqueda, setBusqueda] = useState(origen.nombre_producto)
  const [debounced, setDebounced] = useState(origen.nombre_producto)
  const [destino, setDestino] = useState<ProductoResponse | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(busqueda.trim()), 250)
    return () => clearTimeout(timer)
  }, [busqueda])

  const resultados = useQuery({
    queryKey: queryKeys.catalogo.productos({ q: debounced }),
    queryFn: () => CatalogoAPI.getProductos({ q: debounced, limit: 20 }),
    enabled: debounced.length > 0,
  })
  const candidatos = (resultados.data ?? []).filter(
    (producto) => producto.estado === "aprobado" && producto.id_producto !== origen.id_producto,
  )

  const fusionar = useMutation({
    mutationFn: (idDestino: number) => CatalogoAPI.fusionarProducto(origen.id_producto, idDestino),
    onSuccess: async (producto) => {
      toast.success(`Fusionado con «${producto.nombre_producto}»`)
      await onFusionado()
    },
    onError: (err) => toast.error("No se pudo fusionar", { description: getFriendlyErrorMessage(err) }),
  })

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-hidden sm:max-w-md">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle>Fusionar «{origen.nombre_producto}»</DialogTitle>
          <DialogDescription>
            Elige el producto aprobado que se conserva. Los gastos y consumos que usan el duplicado pasan a ese, y el
            duplicado se elimina.
          </DialogDescription>
        </DialogHeader>
        <input
          autoFocus
          type="search"
          aria-label="Buscar producto aprobado"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          className="h-11 w-full rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:border-foreground"
        />
        <ul className="-mx-1 min-h-0 overflow-y-auto">
          {candidatos.length === 0 ? (
            <li className="px-1 py-2 text-sm text-muted-foreground">
              {resultados.isFetching ? "Buscando..." : "Sin productos aprobados con ese texto."}
            </li>
          ) : (
            candidatos.map((producto) => (
              <li key={producto.id_producto}>
                <button
                  type="button"
                  aria-pressed={destino?.id_producto === producto.id_producto}
                  onClick={() => setDestino(producto)}
                  className={cn(
                    "w-full rounded-md px-2 py-2 text-left hover:bg-[color:var(--surface-low)]",
                    destino?.id_producto === producto.id_producto && "bg-foreground text-background hover:bg-foreground",
                  )}
                >
                  <span className="block truncate text-sm font-semibold">{producto.nombre_producto}</span>
                  <span className="block truncate text-xs opacity-75">{detalle(producto) || "Sin detalle"}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <div className="flex gap-2">
          <Button
            className="h-11 flex-1"
            disabled={!destino || fusionar.isPending}
            onClick={() => destino && fusionar.mutate(destino.id_producto)}
          >
            {fusionar.isPending ? "Fusionando..." : destino ? `Fusionar con «${destino.nombre_producto}»` : "Elige un producto"}
          </Button>
          <Button variant="outline" className="h-11" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
