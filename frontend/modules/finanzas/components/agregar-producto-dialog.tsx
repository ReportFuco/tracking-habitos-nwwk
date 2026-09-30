"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, LoaderCircle, PackagePlus, Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { SearchableCombobox } from "@/components/forms/searchable-combobox"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { formatCLP } from "@/lib/format"
import { isAppOffline, OFFLINE_ACTION_MESSAGE } from "@/lib/online-only"
import { queryKeys } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import { CatalogoAPI } from "@/modules/catalogo/api/catalogo.api"
import type { ProductoResponse } from "@/modules/catalogo/types/catalogo"
import type { MovimientoItemCreate } from "@/modules/finanzas/types/finanzas"

type Paso = "buscar" | "crear" | "detalle"

const UNIDADES = ["g", "kg", "ml", "L", "un"] as const
const milesFormatter = new Intl.NumberFormat("es-CL")
const cantidadFormatter = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 })

const inputClass =
  "h-11 w-full min-w-0 rounded-md border border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
const labelClass = "text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"

/** "1 L · Caja · Frutilla" para distinguir variantes del mismo producto. */
export function detalleProducto(producto: Pick<ProductoResponse, "contenido_neto" | "unidad_contenido" | "formato" | "sabor">) {
  const contenido =
    producto.contenido_neto != null
      ? `${cantidadFormatter.format(producto.contenido_neto)} ${producto.unidad_contenido ?? ""}`.trim()
      : null
  return [contenido, producto.formato, producto.sabor].filter(Boolean).join(" · ")
}

/** "0,75" o "0.75" -> 0.75. NaN si no es un numero. */
export function parseCantidad(valor: string) {
  return Number(valor.trim().replace(",", "."))
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Monto del gasto aun sin detallar: se ofrece como precio con un toque. */
  restante: number
  /** Recibe tambien el producto elegido, para quien lo muestre antes de guardarlo. */
  onAgregar: (
    payload: MovimientoItemCreate,
    producto: ProductoResponse,
  ) => Promise<{ ok: true } | { ok: false; message: string }>
}

/**
 * Buscar un producto (o crearlo si no existe) y agregarlo al gasto con cantidad y precio.
 * Queda abierto despues de agregar: un ticket suele traer varios productos seguidos.
 */
export function AgregarProductoDialog({ open, onOpenChange, restante, onAgregar }: Props) {
  const queryClient = useQueryClient()
  const [paso, setPaso] = useState<Paso>("buscar")
  const [busqueda, setBusqueda] = useState("")
  const [busquedaDebounced, setBusquedaDebounced] = useState("")
  const [elegido, setElegido] = useState<ProductoResponse | null>(null)
  const [cantidad, setCantidad] = useState("1")
  const [precio, setPrecio] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const buscarRef = useRef<HTMLInputElement>(null)

  const [nuevo, setNuevo] = useState({ nombre: "", id_marca: "", contenido: "", unidad: "", formato: "", codigo: "" })

  useEffect(() => {
    const timer = setTimeout(() => setBusquedaDebounced(busqueda.trim()), 250)
    return () => clearTimeout(timer)
  }, [busqueda])

  const buscando = busquedaDebounced.length > 0
  const resultadosQuery = useQuery({
    queryKey: queryKeys.catalogo.productos({ q: busquedaDebounced }),
    queryFn: () => CatalogoAPI.getProductos({ q: busquedaDebounced, limit: 20 }),
    enabled: open && buscando,
    staleTime: 60_000,
  })
  const frecuentesQuery = useQuery({
    queryKey: queryKeys.catalogo.productosFrecuentes,
    queryFn: CatalogoAPI.getProductosFrecuentes,
    enabled: open && !buscando,
    staleTime: 60_000,
  })
  const marcasQuery = useQuery({
    queryKey: queryKeys.catalogo.marcas,
    queryFn: CatalogoAPI.getMarcas,
    enabled: open && paso === "crear",
    staleTime: 5 * 60_000,
  })
  const marcaOptions = useMemo(
    () => (marcasQuery.data ?? []).map((marca) => ({ value: String(marca.id_marca), label: marca.nombre_marca })),
    [marcasQuery.data],
  )

  const lista = buscando ? resultadosQuery.data : frecuentesQuery.data
  const cargandoLista = buscando ? resultadosQuery.isFetching && !resultadosQuery.data : frecuentesQuery.isLoading

  const reiniciar = () => {
    setPaso("buscar")
    setBusqueda("")
    setElegido(null)
    setCantidad("1")
    setPrecio("")
    setError(null)
  }

  const cambiarApertura = (abierto: boolean) => {
    if (!abierto) reiniciar()
    onOpenChange(abierto)
  }

  const elegir = (producto: ProductoResponse) => {
    setElegido(producto)
    setCantidad("1")
    setPrecio("")
    setError(null)
    setPaso("detalle")
  }

  const irACrear = () => {
    setNuevo({ nombre: busqueda.trim(), id_marca: "", contenido: "", unidad: "", formato: "", codigo: "" })
    setError(null)
    setPaso("crear")
  }

  const crearProducto = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // El dialogo puede vivir dentro de otro formulario (el de nuevo movimiento): en React el
    // submit sube a traves del portal y terminaria registrando ese formulario tambien.
    event.stopPropagation()
    if (!nuevo.nombre.trim()) {
      setError("Ponle un nombre al producto")
      return
    }
    const contenido = nuevo.contenido ? parseCantidad(nuevo.contenido) : null
    if (contenido !== null && !(contenido > 0)) {
      setError("El contenido debe ser un numero mayor a 0")
      return
    }
    if (isAppOffline()) {
      setError(OFFLINE_ACTION_MESSAGE)
      return
    }
    setGuardando(true)
    try {
      const producto = await CatalogoAPI.createProducto({
        nombre_producto: nuevo.nombre.trim(),
        id_marca: nuevo.id_marca ? Number(nuevo.id_marca) : null,
        contenido_neto: contenido,
        unidad_contenido: contenido !== null ? nuevo.unidad || null : null,
        formato: nuevo.formato.trim() || null,
        codigo_barra: nuevo.codigo.trim() || null,
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.catalogo.productosRoot })
      elegir(producto)
    } catch (err) {
      setError(getFriendlyErrorMessage(err))
    } finally {
      setGuardando(false)
    }
  }

  const agregar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!elegido) return
    const valorCantidad = parseCantidad(cantidad)
    if (!(valorCantidad > 0)) {
      setError("La cantidad debe ser mayor a 0")
      return
    }
    setGuardando(true)
    const result = await onAgregar({
      id_producto: elegido.id_producto,
      cantidad: valorCantidad,
      precio_total: precio ? Number(precio) : null,
    }, elegido)
    setGuardando(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    toast.success(`${elegido.nombre_producto} agregado`)
    reiniciar()
    window.requestAnimationFrame(() => buscarRef.current?.focus())
  }

  const valorCantidad = parseCantidad(cantidad)
  const unitario = precio && valorCantidad > 0 && valorCantidad !== 1 ? Number(precio) / valorCantidad : null

  return (
    <Dialog open={open} onOpenChange={cambiarApertura}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-hidden p-4 sm:max-w-md sm:p-6">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle>
            {paso === "crear" ? "Producto nuevo" : paso === "detalle" ? "Cantidad y precio" : "Agregar producto"}
          </DialogTitle>
          <DialogDescription>
            {paso === "crear"
              ? "Lo puedes usar de inmediato. Para que otros lo vean, un administrador lo revisa."
              : paso === "detalle"
                ? "El precio es opcional, pero sirve para ver como cambia en el tiempo."
                : "Busca en el catalogo o crea el producto si no esta."}
          </DialogDescription>
        </DialogHeader>

        {paso === "buscar" ? (
          <div className="flex min-h-0 flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                ref={buscarRef}
                autoFocus
                type="search"
                aria-label="Buscar producto"
                placeholder="Nombre, marca o codigo de barra"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                className={cn(inputClass, "pl-9")}
              />
            </div>

            <p className={labelClass}>{buscando ? "Resultados" : "Los que mas compras"}</p>
            <ul className="-mx-1 flex min-h-0 flex-col overflow-y-auto">
              {cargandoLista ? (
                <li className="flex items-center gap-2 px-1 py-3 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  Buscando...
                </li>
              ) : (lista ?? []).length === 0 ? (
                <li className="px-1 py-3 text-sm text-muted-foreground">
                  {buscando ? "No encontramos ese producto." : "Aun no detallas productos. Busca uno para empezar."}
                </li>
              ) : (
                (lista ?? []).map((producto) => {
                  const detalle = [producto.nombre_marca, detalleProducto(producto)].filter(Boolean).join(" · ")
                  return (
                    <li key={producto.id_producto}>
                      <button
                        type="button"
                        onClick={() => elegir(producto)}
                        className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2.5 text-left hover:bg-[color:var(--surface-low)] focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{producto.nombre_producto}</span>
                          {detalle ? <span className="block truncate text-xs text-muted-foreground">{detalle}</span> : null}
                        </span>
                        {producto.estado !== "aprobado" ? <EstadoBadge estado={producto.estado} /> : null}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>

            <Button type="button" variant="outline" className="h-11 justify-start" onClick={irACrear}>
              <PackagePlus className="size-4" aria-hidden />
              <span className="truncate">{busqueda.trim() ? `Crear «${busqueda.trim()}»` : "Crear producto nuevo"}</span>
            </Button>
          </div>
        ) : null}

        {paso === "crear" ? (
          <form onSubmit={crearProducto} noValidate className="flex min-h-0 flex-col gap-4 overflow-y-auto">
            <Campo id="nuevo-nombre" label="Nombre">
              <input
                id="nuevo-nombre"
                autoFocus
                maxLength={160}
                placeholder="Ej: Leche entera"
                value={nuevo.nombre}
                onChange={(event) => setNuevo((prev) => ({ ...prev, nombre: event.target.value }))}
                className={inputClass}
              />
            </Campo>
            <Campo id="nuevo-marca" label="Marca" hint="Opcional">
              <SearchableCombobox
                id="nuevo-marca"
                value={nuevo.id_marca}
                onChange={(value) => setNuevo((prev) => ({ ...prev, id_marca: value }))}
                options={marcaOptions}
                loading={marcasQuery.isLoading}
                placeholder="Sin marca"
                searchPlaceholder="Buscar marca..."
                emptyMessage="Sin esa marca: escribela en el nombre"
                allowClear
              />
            </Campo>
            <Campo id="nuevo-contenido" label="Contenido" hint="Opcional">
              <div className="flex gap-2">
                <input
                  id="nuevo-contenido"
                  inputMode="decimal"
                  placeholder="1"
                  value={nuevo.contenido}
                  onChange={(event) => setNuevo((prev) => ({ ...prev, contenido: event.target.value.replace(/[^\d.,]/g, "") }))}
                  className={cn(inputClass, "w-24 flex-none")}
                />
                <div role="radiogroup" aria-label="Unidad" className="flex flex-1 flex-wrap gap-1">
                  {UNIDADES.map((unidad) => (
                    <button
                      key={unidad}
                      type="button"
                      role="radio"
                      aria-checked={nuevo.unidad === unidad}
                      onClick={() => setNuevo((prev) => ({ ...prev, unidad: prev.unidad === unidad ? "" : unidad }))}
                      className={cn(
                        "h-11 min-w-10 rounded-md border px-2 text-sm font-semibold",
                        nuevo.unidad === unidad ? "border-foreground bg-foreground text-background" : "border-border",
                      )}
                    >
                      {unidad}
                    </button>
                  ))}
                </div>
              </div>
            </Campo>
            <div className="grid grid-cols-2 gap-2">
              <Campo id="nuevo-formato" label="Formato" hint="Opcional">
                <input
                  id="nuevo-formato"
                  maxLength={100}
                  placeholder="Caja, botella..."
                  value={nuevo.formato}
                  onChange={(event) => setNuevo((prev) => ({ ...prev, formato: event.target.value }))}
                  className={inputClass}
                />
              </Campo>
              <Campo id="nuevo-codigo" label="Codigo" hint="Opcional">
                <input
                  id="nuevo-codigo"
                  inputMode="numeric"
                  maxLength={64}
                  placeholder="780..."
                  value={nuevo.codigo}
                  onChange={(event) => setNuevo((prev) => ({ ...prev, codigo: event.target.value }))}
                  className={inputClass}
                />
              </Campo>
            </div>

            {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="h-11" onClick={() => { setError(null); setPaso("buscar") }}>
                <ArrowLeft className="size-4" aria-hidden />
                Volver
              </Button>
              <Button type="submit" className="h-11 flex-1" disabled={guardando}>
                {guardando ? "Creando..." : "Crear y usar"}
              </Button>
            </div>
          </form>
        ) : null}

        {paso === "detalle" && elegido ? (
          <form onSubmit={agregar} noValidate className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 rounded-md bg-[color:var(--surface-low)] px-3 py-2.5">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{elegido.nombre_producto}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[elegido.nombre_marca, detalleProducto(elegido)].filter(Boolean).join(" · ") || "Sin detalle"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setPaso("buscar")}
                className="shrink-0 text-sm font-semibold underline underline-offset-4"
              >
                Cambiar
              </button>
            </div>

            <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
              <Campo id="item-cantidad" label="Cantidad">
                <input
                  id="item-cantidad"
                  inputMode="decimal"
                  value={cantidad}
                  onChange={(event) => setCantidad(event.target.value.replace(/[^\d.,]/g, ""))}
                  className={cn(inputClass, "tabular-nums")}
                />
              </Campo>
              <Campo id="item-precio" label="Precio total" hint={unitario ? `${formatCLP(Math.round(unitario))} c/u` : "Opcional"}>
                <div className="flex h-11 items-center gap-1 rounded-md border border-border px-3 focus-within:border-foreground">
                  <span aria-hidden className="text-sm text-muted-foreground">$</span>
                  <input
                    id="item-precio"
                    autoFocus
                    inputMode="numeric"
                    placeholder="0"
                    value={precio ? milesFormatter.format(Number(precio)) : ""}
                    onChange={(event) => setPrecio(event.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 11))}
                    className="h-full w-full min-w-0 bg-transparent text-sm tabular-nums outline-none"
                  />
                </div>
              </Campo>
            </div>
            {restante > 0 && !precio ? (
              <button
                type="button"
                onClick={() => setPrecio(String(restante))}
                className="-mt-2 self-start text-xs font-semibold underline underline-offset-4"
              >
                Usar lo que falta por detallar ({formatCLP(restante)})
              </button>
            ) : null}

            {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}

            <Button type="submit" size="lg" className="h-11" disabled={guardando}>
              <Plus className="size-4" aria-hidden />
              {guardando ? "Agregando..." : "Agregar al gasto"}
            </Button>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span
      className="shrink-0 rounded-sm bg-[color:var(--surface-low)] px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted-foreground"
      title={estado === "rechazado" ? "Solo tu lo ves" : "Solo tu lo ves hasta que un administrador lo revise"}
    >
      {estado === "rechazado" ? "Solo tuyo" : "En revision"}
    </span>
  )
}

function Campo({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>
        {hint ? <span className="truncate text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  )
}
