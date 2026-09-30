"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ChevronRight, LoaderCircle, Minus, PackagePlus, Plus, Search, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { formatCLP } from "@/lib/format"
import { isAppOffline, OFFLINE_ACTION_MESSAGE } from "@/lib/online-only"
import { queryKeys } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import { useProfile } from "@/modules/auth/hooks/useProfile"
import { CatalogoAPI } from "@/modules/catalogo/api/catalogo.api"
import type { MarcaResponse, ProductoResponse } from "@/modules/catalogo/types/catalogo"
import type { MovimientoItemCreate } from "@/modules/finanzas/types/finanzas"

type Paso = "buscar" | "crear" | "detalle"

const UNIDADES = ["g", "kg", "ml", "L", "un"] as const
const milesFormatter = new Intl.NumberFormat("es-CL")
const cantidadFormatter = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 })

const inputClass =
  "h-12 w-full min-w-0 rounded-md border border-border bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground focus:border-foreground"
const labelClass = "text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
const footerClass = "shrink-0 border-t border-border px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-6 sm:pb-4"

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

/** Sin tildes ni mayusculas, para filtrar en el cliente igual que busca el backend. */
function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
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
 * Buscar un producto del catalogo y agregarlo al gasto con cantidad y precio. Solo un
 * administrador puede crear productos nuevos desde aqui. En movil es una hoja inferior
 * con los botones siempre visibles; queda abierta despues de agregar, porque una boleta
 * suele traer varios productos seguidos.
 */
export function AgregarProductoDialog({ open, onOpenChange, restante, onAgregar }: Props) {
  const queryClient = useQueryClient()
  const { data: perfil } = useProfile()
  const esAdmin = Boolean(perfil?.is_superuser)

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
    const timer = setTimeout(() => setBusquedaDebounced(busqueda.trim()), 200)
    return () => clearTimeout(timer)
  }, [busqueda])

  const buscando = busquedaDebounced.length > 0
  const resultadosQuery = useQuery({
    queryKey: queryKeys.catalogo.productos({ q: busquedaDebounced }),
    queryFn: () => CatalogoAPI.getProductos({ q: busquedaDebounced, limit: 20 }),
    enabled: open && buscando,
    staleTime: 60_000,
    // Mientras llega la siguiente busqueda se mantiene la lista anterior: sin parpadeo.
    placeholderData: keepPreviousData,
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

  const lista = (buscando ? resultadosQuery.data : frecuentesQuery.data) ?? []
  const cargandoLista = buscando ? resultadosQuery.isPending : frecuentesQuery.isLoading
  const actualizandoLista = (buscando && resultadosQuery.isFetching) || busqueda.trim() !== busquedaDebounced

  const reiniciar = () => {
    setPaso("buscar")
    setBusqueda("")
    setBusquedaDebounced("")
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

  const volverABuscar = () => {
    setError(null)
    setPaso("buscar")
    window.requestAnimationFrame(() => buscarRef.current?.focus())
  }

  const crearMarca = async (nombre: string): Promise<MarcaResponse | null> => {
    if (isAppOffline()) {
      setError(OFFLINE_ACTION_MESSAGE)
      return null
    }
    try {
      const marca = await CatalogoAPI.createMarca({ nombre_marca: nombre })
      queryClient.setQueryData<MarcaResponse[]>(queryKeys.catalogo.marcas, (prev) => [...(prev ?? []), marca])
      setError(null)
      return marca
    } catch (err) {
      setError(getFriendlyErrorMessage(err))
      return null
    }
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
    const result = await onAgregar(
      {
        id_producto: elegido.id_producto,
        cantidad: valorCantidad,
        precio_total: precio ? Number(precio) : null,
      },
      elegido,
    )
    setGuardando(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    toast.success(`${elegido.nombre_producto} agregado`)
    reiniciar()
    window.requestAnimationFrame(() => buscarRef.current?.focus())
  }

  const cambiarCantidad = (delta: number) => {
    const actual = parseCantidad(cantidad)
    const base = actual > 0 ? actual : 1
    const siguiente = Math.max(1, Math.round((base + delta) * 1000) / 1000)
    setCantidad(String(siguiente).replace(".", ","))
  }

  const valorCantidad = parseCantidad(cantidad)
  const unitario = precio && valorCantidad > 0 && valorCantidad !== 1 ? Number(precio) / valorCantidad : null

  const titulo = paso === "crear" ? "Producto nuevo" : paso === "detalle" ? "Cantidad y precio" : "Agregar producto"
  const descripcion =
    paso === "crear"
      ? "Queda en el catalogo para todos los usuarios."
      : paso === "detalle"
        ? "El precio es opcional, pero sirve para ver como cambia en el tiempo."
        : "Busca por nombre, marca, formato o codigo de barra."

  return (
    <Dialog open={open} onOpenChange={cambiarApertura}>
      <DialogContent
        className={cn(
          // Movil: hoja inferior de alto fijo, asi el buscador no salta al cambiar los resultados.
          "top-auto bottom-0 left-0 flex h-[90dvh] max-w-full translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-2xl rounded-b-none border-x-0 border-b-0 p-0",
          "sm:top-[50%] sm:bottom-auto sm:left-[50%] sm:h-[min(40rem,calc(100dvh-4rem))] sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:border",
        )}
      >
        <DialogHeader className="shrink-0 gap-1 border-b border-border px-4 pt-5 pr-12 pb-4 text-left sm:px-6">
          <DialogTitle className="text-lg">{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>

        {paso === "buscar" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 px-4 pt-4 sm:px-6">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input
                  ref={buscarRef}
                  autoFocus
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  aria-label="Buscar producto"
                  placeholder="Ej: leche, monster, 780..."
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  className={cn(inputClass, "pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden")}
                />
                {actualizandoLista ? (
                  <LoaderCircle className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
                ) : busqueda ? (
                  <button
                    type="button"
                    aria-label="Limpiar busqueda"
                    onClick={() => {
                      setBusqueda("")
                      buscarRef.current?.focus()
                    }}
                    className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
              <p className={cn(labelClass, "mt-4 mb-1")} aria-live="polite">
                {buscando
                  ? cargandoLista
                    ? "Buscando..."
                    : `${lista.length} ${lista.length === 1 ? "resultado" : "resultados"}`
                  : "Los que mas compras"}
              </p>
            </div>

            <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 sm:px-4">
              {cargandoLista ? (
                [0, 1, 2].map((fila) => (
                  <li key={fila} className="flex h-16 items-center px-2" aria-hidden>
                    <span className="h-4 w-2/3 animate-pulse rounded-sm bg-[color:var(--surface-low)]" />
                  </li>
                ))
              ) : lista.length === 0 ? (
                <li className="px-2 py-6 text-sm text-muted-foreground">
                  {buscando ? (
                    <>
                      No encontramos «{busquedaDebounced}».{" "}
                      {esAdmin ? "Puedes crearlo abajo." : "Pidele a un administrador que lo agregue al catalogo."}
                    </>
                  ) : (
                    "Aun no detallas productos. Busca uno para empezar."
                  )}
                </li>
              ) : (
                lista.map((producto) => {
                  const detalle = [producto.nombre_marca, detalleProducto(producto)].filter(Boolean).join(" · ")
                  return (
                    <li key={producto.id_producto}>
                      <button
                        type="button"
                        onClick={() => elegir(producto)}
                        className="flex min-h-16 w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-[color:var(--surface-low)] focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-base font-semibold">{producto.nombre_producto}</span>
                            {producto.estado !== "aprobado" ? <EstadoBadge estado={producto.estado} /> : null}
                          </span>
                          <span className="block truncate text-sm text-muted-foreground">{detalle || "Sin detalle"}</span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      </button>
                    </li>
                  )
                })
              )}
            </ul>

            {esAdmin ? (
              <div className={footerClass}>
                <Button type="button" variant="outline" className="h-12 w-full" onClick={irACrear}>
                  <PackagePlus className="size-4" aria-hidden />
                  <span className="truncate">{busqueda.trim() ? `Crear «${busqueda.trim()}»` : "Crear producto nuevo"}</span>
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {paso === "crear" ? (
          <form onSubmit={crearProducto} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4 sm:px-6">
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

              <Campo id="nuevo-marca" label="Marca" opcional>
                <MarcaPicker
                  id="nuevo-marca"
                  marcas={marcasQuery.data ?? []}
                  cargando={marcasQuery.isLoading}
                  value={nuevo.id_marca}
                  onChange={(id) => setNuevo((prev) => ({ ...prev, id_marca: id }))}
                  onCrear={crearMarca}
                />
              </Campo>

              <Campo id="nuevo-contenido" label="Contenido" opcional>
                <div className="flex gap-2">
                  <input
                    id="nuevo-contenido"
                    inputMode="decimal"
                    placeholder="1"
                    value={nuevo.contenido}
                    onChange={(event) => setNuevo((prev) => ({ ...prev, contenido: event.target.value.replace(/[^\d.,]/g, "") }))}
                    className={cn(inputClass, "w-24 flex-none tabular-nums")}
                  />
                  <div role="radiogroup" aria-label="Unidad" className="grid h-12 flex-1 grid-cols-5 overflow-hidden rounded-md border border-border">
                    {UNIDADES.map((unidad) => {
                      const activa = nuevo.unidad === unidad
                      return (
                        <button
                          key={unidad}
                          type="button"
                          role="radio"
                          aria-checked={activa}
                          onClick={() => setNuevo((prev) => ({ ...prev, unidad: prev.unidad === unidad ? "" : unidad }))}
                          className={cn(
                            "border-l border-border text-sm font-semibold transition-colors first:border-l-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                            activa ? "bg-foreground text-background" : "hover:bg-[color:var(--surface-low)]",
                          )}
                        >
                          {unidad}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </Campo>

              <div className="grid grid-cols-2 gap-3">
                <Campo id="nuevo-formato" label="Formato" opcional>
                  <input
                    id="nuevo-formato"
                    maxLength={100}
                    placeholder="Caja, lata..."
                    value={nuevo.formato}
                    onChange={(event) => setNuevo((prev) => ({ ...prev, formato: event.target.value }))}
                    className={inputClass}
                  />
                </Campo>
                <Campo id="nuevo-codigo" label="Codigo" opcional>
                  <input
                    id="nuevo-codigo"
                    inputMode="numeric"
                    maxLength={64}
                    placeholder="780..."
                    value={nuevo.codigo}
                    onChange={(event) => setNuevo((prev) => ({ ...prev, codigo: event.target.value }))}
                    className={cn(inputClass, "tabular-nums")}
                  />
                </Campo>
              </div>

              {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
            </div>

            <div className={cn(footerClass, "flex gap-2")}>
              <Button type="button" variant="outline" className="h-12" onClick={volverABuscar}>
                <ArrowLeft className="size-4" aria-hidden />
                Volver
              </Button>
              <Button type="submit" className="h-12 flex-1" disabled={guardando}>
                {guardando ? "Creando..." : "Crear y usar"}
              </Button>
            </div>
          </form>
        ) : null}

        {paso === "detalle" && elegido ? (
          <form onSubmit={agregar} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="flex items-center gap-3 rounded-md bg-[color:var(--surface-low)] px-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold">{elegido.nombre_producto}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {[elegido.nombre_marca, detalleProducto(elegido)].filter(Boolean).join(" · ") || "Sin detalle"}
                  </span>
                </span>
                <button type="button" onClick={volverABuscar} className="shrink-0 text-sm font-semibold underline underline-offset-4">
                  Cambiar
                </button>
              </div>

              <Campo id="item-precio" label="Precio total" opcional>
                <div className="flex items-baseline gap-2 border-b-2 border-border pb-2 focus-within:border-foreground">
                  <span aria-hidden className="font-display text-2xl text-muted-foreground">$</span>
                  <input
                    id="item-precio"
                    autoFocus
                    inputMode="numeric"
                    enterKeyHint="done"
                    placeholder="0"
                    value={precio ? milesFormatter.format(Number(precio)) : ""}
                    onChange={(event) => setPrecio(event.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 11))}
                    className="w-full min-w-0 bg-transparent font-display text-3xl leading-none tabular-nums outline-none placeholder:text-muted-foreground/40"
                  />
                </div>
                <div className="flex min-h-5 items-center justify-between gap-3 text-xs">
                  {restante > 0 && !precio ? (
                    <button type="button" onClick={() => setPrecio(String(restante))} className="font-semibold underline underline-offset-4">
                      Usar lo que falta ({formatCLP(restante)})
                    </button>
                  ) : (
                    <span />
                  )}
                  {unitario ? <span className="text-muted-foreground">{formatCLP(Math.round(unitario))} c/u</span> : null}
                </div>
              </Campo>

              <Campo id="item-cantidad" label="Cantidad">
                <div className="flex h-12 items-stretch overflow-hidden rounded-md border border-border focus-within:border-foreground">
                  <button
                    type="button"
                    aria-label="Restar uno"
                    disabled={!(valorCantidad > 1)}
                    onClick={() => cambiarCantidad(-1)}
                    className="flex w-12 items-center justify-center border-r border-border disabled:text-muted-foreground/40"
                  >
                    <Minus className="size-4" />
                  </button>
                  <input
                    id="item-cantidad"
                    inputMode="decimal"
                    value={cantidad}
                    onChange={(event) => setCantidad(event.target.value.replace(/[^\d.,]/g, ""))}
                    className="min-w-0 flex-1 bg-transparent text-center text-base font-semibold tabular-nums outline-none"
                  />
                  <button
                    type="button"
                    aria-label="Sumar uno"
                    onClick={() => cambiarCantidad(1)}
                    className="flex w-12 items-center justify-center border-l border-border"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">A granel, escribe kilos o litros (ej. 0,75).</p>
              </Campo>

              {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
            </div>

            <div className={footerClass}>
              <Button type="submit" className="h-12 w-full text-base" disabled={guardando}>
                <Plus className="size-4" aria-hidden />
                {guardando ? "Agregando..." : `Agregar al gasto${precio ? ` · ${formatCLP(Number(precio))}` : ""}`}
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Elegir marca con sugerencias en linea (sin abrir otro popover encima de la hoja) y
 * crearla si no existe.
 */
function MarcaPicker({
  id,
  marcas,
  cargando,
  value,
  onChange,
  onCrear,
}: {
  id: string
  marcas: MarcaResponse[]
  cargando: boolean
  value: string
  onChange: (id: string) => void
  onCrear: (nombre: string) => Promise<MarcaResponse | null>
}) {
  const [texto, setTexto] = useState("")
  const [creando, setCreando] = useState(false)
  const seleccionada = marcas.find((marca) => String(marca.id_marca) === value)

  const consulta = normalizar(texto)
  const sugerencias = useMemo(() => {
    const filtradas = marcas.filter((marca) => normalizar(marca.nombre_marca).includes(consulta))
    return filtradas.sort((a, b) => a.nombre_marca.localeCompare(b.nombre_marca, "es")).slice(0, 5)
  }, [marcas, consulta])
  const existeExacta = marcas.some((marca) => normalizar(marca.nombre_marca) === consulta)

  if (seleccionada) {
    return (
      <div className="flex h-12 items-center justify-between gap-2 rounded-md border border-foreground px-3">
        <span className="truncate text-base font-semibold">{seleccionada.nombre_marca}</span>
        <button
          type="button"
          aria-label={`Quitar marca ${seleccionada.nombre_marca}`}
          onClick={() => {
            onChange("")
            setTexto("")
          }}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    )
  }

  const crear = async () => {
    const nombre = texto.trim()
    if (!nombre) return
    setCreando(true)
    const marca = await onCrear(nombre)
    setCreando(false)
    if (marca) onChange(String(marca.id_marca))
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        id={id}
        autoComplete="off"
        placeholder="Buscar marca (o dejar sin marca)"
        value={texto}
        onChange={(event) => setTexto(event.target.value)}
        onKeyDown={(event) => {
          // Enter elige la primera sugerencia en vez de enviar el formulario.
          if (event.key === "Enter" && texto.trim()) {
            event.preventDefault()
            if (sugerencias[0]) onChange(String(sugerencias[0].id_marca))
            else void crear()
          }
        }}
        className={inputClass}
      />
      {consulta ? (
        <ul className="flex flex-col overflow-hidden rounded-md border border-border">
          {cargando ? (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">Cargando marcas...</li>
          ) : (
            sugerencias.map((marca) => (
              <li key={marca.id_marca} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => onChange(String(marca.id_marca))}
                  className="w-full px-3 py-2.5 text-left text-base hover:bg-[color:var(--surface-low)]"
                >
                  {marca.nombre_marca}
                </button>
              </li>
            ))
          )}
          {!cargando && !existeExacta ? (
            <li className="border-t border-border first:border-t-0">
              <button
                type="button"
                disabled={creando}
                onClick={() => void crear()}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold hover:bg-[color:var(--surface-low)]"
              >
                <Plus className="size-4" aria-hidden />
                {creando ? "Creando marca..." : `Crear marca «${texto.trim()}»`}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
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

function Campo({ id, label, opcional, children }: { id: string; label: string; opcional?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className={labelClass}>
        {label}
        {opcional ? <span className="ml-1.5 font-normal tracking-normal normal-case">· opcional</span> : null}
      </label>
      {children}
    </div>
  )
}
