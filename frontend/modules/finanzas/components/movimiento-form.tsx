"use client"

import { FormEvent, useCallback, useMemo, useRef, useState } from "react"
import { ArrowDownLeft, ArrowUpRight, CalendarClock, Check, HandCoins, LoaderCircle, MapPin, Plus, Repeat, ShoppingBasket, X } from "lucide-react"
import { toast } from "sonner"
import { ChipSelect, type ChipOption } from "@/components/forms/chip-select"
import { Button } from "@/components/ui/button"
import { formatCLP } from "@/lib/format"
import { getGeolocationErrorMessage, obtenerUbicacion, type UbicacionUsuario } from "@/lib/geolocation"
import { cn } from "@/lib/utils"
import { useDeudas, useFinanzas } from "@/modules/finanzas/hooks/useFinanzas"
import { movimientoCreateSchema } from "@/modules/finanzas/schemas/finanzas.schema"
import type { TipoGasto, TipoMovimiento } from "@/modules/finanzas/types/finanzas"
import { MovimientoRegistrado, type MovimientoRegistradoInfo } from "./movimiento-registrado"
import { aItemsCreate, ProductosNuevoGasto, type ProductoPorGuardar } from "./productos-nuevo-gasto"
import { randomUUID } from "@/lib/uuid"

type Campo = "monto" | "id_categoria" | "id_cuenta" | "created_at" | "id_deuda"

const initialForm = {
  id_categoria: "",
  /** "" = usar la cuenta por defecto (la del ultimo movimiento). */
  id_cuenta: "",
  tipo_movimiento: "gasto" as TipoMovimiento,
  tipo_gasto: "variable" as TipoGasto,
  /** Solo digitos; se muestra con separador de miles. */
  monto: "",
  descripcion: "",
  created_at: "",
  en_lugar_compra: false,
}

const MAX_DIGITS = 11
const milesFormatter = new Intl.NumberFormat("es-CL")

const TIPOS: { value: TipoMovimiento; label: string; icon: typeof ArrowUpRight }[] = [
  { value: "gasto", label: "Gasto", icon: ArrowUpRight },
  { value: "ingreso", label: "Ingreso", icon: ArrowDownLeft },
]

/** Cuenta de ocurrencias por nombre para ordenar las opciones por uso. */
function contarPorNombre(nombres: (string | null | undefined)[]) {
  const conteo = new Map<string, number>()
  for (const nombre of nombres) {
    if (!nombre) continue
    const key = nombre.toLocaleLowerCase("es")
    conteo.set(key, (conteo.get(key) ?? 0) + 1)
  }
  return conteo
}

export function MovimientoFormCard({
  tipoInicial = "gasto",
  deudaInicial,
}: {
  tipoInicial?: TipoMovimiento
  /** Abre el registro como pago (o cobro) de esta deuda. */
  deudaInicial?: number
}) {
  const { categorias, cuentas, movimientos, loadingCatalogos, submittingMovimiento, crearMovimiento, crearCategoria } =
    useFinanzas()
  const deudasQuery = useDeudas()

  const [form, setForm] = useState(() => ({ ...initialForm, tipo_movimiento: tipoInicial }))
  const [nuevaCategoria, setNuevaCategoria] = useState<string | null>(null)
  const [creandoCategoria, setCreandoCategoria] = useState(false)
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({})
  const [ubicacion, setUbicacion] = useState<UbicacionUsuario | null>(null)
  const [capturandoUbicacion, setCapturandoUbicacion] = useState(false)
  const [mostrarFecha, setMostrarFecha] = useState(false)
  const [registrado, setRegistrado] = useState<MovimientoRegistradoInfo | null>(null)
  const [productos, setProductos] = useState<ProductoPorGuardar[]>([])
  const [agregandoProducto, setAgregandoProducto] = useState(false)
  // "" = no abona ninguna deuda.
  const [idDeuda, setIdDeuda] = useState(deudaInicial ? String(deudaInicial) : "")
  const [mostrarDeuda, setMostrarDeuda] = useState(Boolean(deudaInicial))
  const montoRef = useRef<HTMLInputElement>(null)

  const esIngreso = form.tipo_movimiento === "ingreso"

  // Un gasto paga lo que debo; un ingreso cobra lo que me deben.
  const deudasDisponibles = useMemo(
    () =>
      (deudasQuery.data?.items ?? []).filter(
        (deuda) => deuda.estado === "activa" && deuda.tipo === (esIngreso ? "me_deben" : "debo"),
      ),
    [deudasQuery.data, esIngreso],
  )
  const deudaOptions = useMemo<ChipOption[]>(
    () =>
      deudasDisponibles.map((deuda) => ({
        value: String(deuda.id_deuda),
        label: deuda.nombre,
        hint: `Saldo ${formatCLP(deuda.saldo)}`,
      })),
    [deudasDisponibles],
  )
  const deudaSeleccionada = mostrarDeuda ? deudasDisponibles.find((deuda) => String(deuda.id_deuda) === idDeuda) : undefined

  // Las categorias que mas usas quedan primero: la mayoria de los registros son un toque.
  const categoriaOptions = useMemo<ChipOption[]>(() => {
    const uso = contarPorNombre(movimientos.map((m) => m.categoria))
    return [...categorias]
      .sort((a, b) => {
        const diff = (uso.get(b.nombre.toLocaleLowerCase("es")) ?? 0) - (uso.get(a.nombre.toLocaleLowerCase("es")) ?? 0)
        return diff || a.nombre.localeCompare(b.nombre, "es")
      })
      .map((categoria) => ({ value: String(categoria.id_categoria), label: categoria.nombre }))
  }, [categorias, movimientos])

  const cuentaOptions = useMemo<ChipOption[]>(
    () =>
      cuentas.map((cuenta) => ({
        value: String(cuenta.id_cuenta),
        label: cuenta.nombre_cuenta,
        hint: cuenta.nombre_banco ?? undefined,
      })),
    [cuentas],
  )

  // Cuenta por defecto: la del movimiento mas reciente, o la unica que exista.
  const cuentaPorDefecto = useMemo(() => {
    if (cuentas.length === 1) return String(cuentas[0].id_cuenta)
    const ultima = movimientos[0]?.nombre_cuenta?.toLocaleLowerCase("es")
    const match = cuentas.find((cuenta) => cuenta.nombre_cuenta.toLocaleLowerCase("es") === ultima)
    return match ? String(match.id_cuenta) : ""
  }, [cuentas, movimientos])
  const cuentaSeleccionada = form.id_cuenta || cuentaPorDefecto

  const montoNumero = Number(form.monto || 0)

  const actualizar = <K extends keyof typeof initialForm>(campo: K, valor: (typeof initialForm)[K]) => {
    setForm((prev) => ({ ...prev, [campo]: valor }))
    if (campo in errores) setErrores((prev) => ({ ...prev, [campo]: undefined }))
  }

  const seleccionarTipo = (tipo: TipoMovimiento) => {
    // Las deudas de un tipo no sirven para el otro.
    if (tipo !== form.tipo_movimiento) setIdDeuda("")
    setForm((prev) => ({
      ...prev,
      tipo_movimiento: tipo,
      en_lugar_compra: tipo === "ingreso" ? false : prev.en_lugar_compra,
    }))
    if (tipo === "ingreso") setUbicacion(null)
  }

  const toggleLugarCompra = async () => {
    if (form.en_lugar_compra) {
      setForm((prev) => ({ ...prev, en_lugar_compra: false }))
      setUbicacion(null)
      return
    }
    setCapturandoUbicacion(true)
    try {
      setUbicacion(await obtenerUbicacion())
      setForm((prev) => ({ ...prev, en_lugar_compra: true }))
    } catch (error) {
      setUbicacion(null)
      toast.error("No pudimos obtener tu ubicacion", { description: getGeolocationErrorMessage(error) })
    } finally {
      setCapturandoUbicacion(false)
    }
  }

  // Crear una categoria propia sin salir del registro: queda seleccionada al instante.
  const crearCategoriaEnLinea = async () => {
    const nombre = nuevaCategoria?.trim()
    if (!nombre) return
    setCreandoCategoria(true)
    const result = await crearCategoria({ nombre })
    setCreandoCategoria(false)
    if (!result.ok) {
      toast.error("No pudimos crear la categoria", { description: result.message })
      return
    }
    actualizar("id_categoria", String(result.categoria.id_categoria))
    setNuevaCategoria(null)
  }

  const resetParaOtro = useCallback(() => {
    setRegistrado(null)
    window.requestAnimationFrame(() => montoRef.current?.focus())
  }, [])
  const cerrarConfirmacion = useCallback(() => setRegistrado(null), [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nuevosErrores: Partial<Record<Campo, string>> = {}
    if (!montoNumero) nuevosErrores.monto = "Ingresa un monto"
    if (!form.id_categoria) nuevosErrores.id_categoria = "Elige una categoria"
    if (!cuentaSeleccionada) nuevosErrores.id_cuenta = "Elige una cuenta"
    if (mostrarDeuda && !deudaSeleccionada) nuevosErrores.id_deuda = "Elige la deuda"
    else if (deudaSeleccionada && montoNumero > deudaSeleccionada.saldo) {
      nuevosErrores.id_deuda = `El saldo es ${formatCLP(deudaSeleccionada.saldo)}`
    }
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores)
      if (nuevosErrores.monto) montoRef.current?.focus()
      return
    }

    const parsed = movimientoCreateSchema.safeParse({
      id_categoria: Number(form.id_categoria),
      id_cuenta: Number(cuentaSeleccionada),
      tipo_movimiento: form.tipo_movimiento,
      tipo_gasto: form.tipo_gasto,
      monto: montoNumero,
      descripcion: form.descripcion,
      created_at: form.created_at,
      en_lugar_compra: form.en_lugar_compra,
      latitud: ubicacion?.latitud,
      longitud: ubicacion?.longitud,
      precision_ubicacion: ubicacion?.precision,
    })

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const campo = issue?.path[0]
      if (campo === "created_at") setErrores({ created_at: issue.message })
      else toast.error(issue?.message ?? "Revisa los datos del movimiento")
      return
    }

    const result = await crearMovimiento({
      ...parsed.data,
      client_request_id: randomUUID(),
      descripcion: parsed.data.descripcion || null,
      created_at: parsed.data.created_at ? ensureSeconds(parsed.data.created_at) : undefined,
      id_deuda: deudaSeleccionada?.id_deuda,
      // Los productos quedan guardados si se cambia a ingreso, pero solo viajan con un gasto.
      items: !esIngreso && productos.length > 0 ? aItemsCreate(productos) : undefined,
    })

    if (!result.ok) {
      toast.error("No pudimos registrar el movimiento", { description: result.message })
      return
    }

    setRegistrado({
      id: randomUUID(),
      idMovimiento: result.idMovimiento,
      tipo: form.tipo_movimiento,
      monto: montoNumero,
      categoria: categoriaOptions.find((option) => option.value === form.id_categoria)?.label,
      cuenta: cuentaOptions.find((option) => option.value === cuentaSeleccionada)?.label,
      queued: Boolean(result.queued),
    })
    // Se conserva el tipo (gasto/ingreso) y la cuenta: lo normal es anotar varios seguidos.
    setForm((prev) => ({
      ...initialForm,
      tipo_movimiento: prev.tipo_movimiento,
      id_cuenta: prev.id_cuenta,
    }))
    setUbicacion(null)
    setMostrarFecha(false)
    setProductos([])
    setIdDeuda("")
    setMostrarDeuda(false)
    setErrores({})
  }

  const colorTipo = esIngreso ? "var(--ingreso)" : "var(--gasto)"
  const colorTipoOn = esIngreso ? "var(--ingreso-on)" : "var(--gasto-on)"

  return (
    <>
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-5 rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-6"
      >
        {/* Gasto / Ingreso */}
        <div role="radiogroup" aria-label="Tipo de movimiento" className="grid grid-cols-2 gap-1 rounded-lg bg-[color:var(--surface-low)] p-1">
          {TIPOS.map(({ value, label, icon: Icon }) => {
            const active = form.tipo_movimiento === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => seleccionarTipo(value)}
                className={cn(
                  "flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active ? "" : "text-muted-foreground hover:text-foreground",
                )}
                style={active ? { background: value === "ingreso" ? "var(--ingreso)" : "var(--gasto)", color: value === "ingreso" ? "var(--ingreso-on)" : "var(--gasto-on)" } : undefined}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            )
          })}
        </div>

        {/* Monto: la cifra es la protagonista. */}
        <div>
          <label htmlFor="monto" className="sr-only">
            Monto
          </label>
          <div
            className={cn(
              "flex items-baseline gap-2 border-b-2 pb-2 transition-colors",
              errores.monto ? "border-destructive" : "border-border focus-within:border-foreground",
            )}
          >
            <span className="font-display text-3xl text-muted-foreground sm:text-4xl" aria-hidden>
              $
            </span>
            <input
              ref={montoRef}
              id="monto"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="done"
              placeholder="0"
              aria-invalid={Boolean(errores.monto) || undefined}
              aria-describedby={errores.monto ? "monto-error" : undefined}
              value={form.monto ? milesFormatter.format(Number(form.monto)) : ""}
              onChange={(event) => actualizar("monto", event.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_DIGITS))}
              className="w-full min-w-0 bg-transparent font-display text-[2.6rem] leading-none tabular-nums outline-none placeholder:text-muted-foreground/40 sm:text-5xl"
              style={{ color: form.monto ? colorTipo : undefined }}
            />
          </div>
          {errores.monto ? (
            <p id="monto-error" className="mt-1.5 text-xs font-medium text-destructive">
              {errores.monto}
            </p>
          ) : null}
        </div>

        <Grupo titulo="Categoria" error={errores.id_categoria} errorId="categoria-error">
          <ChipSelect
            label="Categoria"
            options={categoriaOptions}
            value={form.id_categoria}
            onChange={(value) => actualizar("id_categoria", value)}
            loading={loadingCatalogos && categoriaOptions.length === 0}
            invalid={Boolean(errores.id_categoria)}
            errorId={errores.id_categoria ? "categoria-error" : undefined}
            emptyMessage="Aun no hay categorias: crea la primera."
          />
          {nuevaCategoria === null ? (
            <button
              type="button"
              onClick={() => setNuevaCategoria("")}
              className="inline-flex items-center gap-1 self-start text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <Plus className="size-3.5" aria-hidden />
              Nueva categoria
            </button>
          ) : (
            <div className="flex gap-2">
              <label htmlFor="nueva-categoria" className="sr-only">
                Nombre de la nueva categoria
              </label>
              <input
                id="nueva-categoria"
                autoFocus
                maxLength={100}
                placeholder="Ej: Mascotas"
                value={nuevaCategoria}
                onChange={(event) => setNuevaCategoria(event.target.value)}
                onKeyDown={(event) => {
                  // Enter crea la categoria en vez de enviar el movimiento.
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void crearCategoriaEnLinea()
                  }
                  if (event.key === "Escape") setNuevaCategoria(null)
                }}
                className="h-10 min-w-0 flex-1 rounded-md border border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
              />
              <Button
                type="button"
                className="h-10"
                disabled={creandoCategoria || !nuevaCategoria.trim()}
                onClick={() => void crearCategoriaEnLinea()}
              >
                {creandoCategoria ? "Creando..." : "Crear"}
              </Button>
              <Button type="button" variant="ghost" size="icon-lg" aria-label="Cancelar" onClick={() => setNuevaCategoria(null)}>
                <X className="size-4" />
              </Button>
            </div>
          )}
        </Grupo>

        <Grupo titulo="Cuenta" error={errores.id_cuenta} errorId="cuenta-error">
          <ChipSelect
            label="Cuenta"
            options={cuentaOptions}
            value={cuentaSeleccionada}
            onChange={(value) => actualizar("id_cuenta", value)}
            loading={loadingCatalogos && cuentaOptions.length === 0}
            invalid={Boolean(errores.id_cuenta)}
            errorId={errores.id_cuenta ? "cuenta-error" : undefined}
            emptyMessage="Registra una cuenta para empezar."
          />
        </Grupo>

        {/* Opciones secundarias en una sola fila de interruptores. */}
        <div className="flex flex-wrap gap-2">
          {esIngreso ? null : (
            <>
              <Toggle
                pressed={form.tipo_gasto === "fijo"}
                onClick={() => actualizar("tipo_gasto", form.tipo_gasto === "fijo" ? "variable" : "fijo")}
                icon={<Repeat className="size-4" aria-hidden />}
                label="Fijo"
                title="Gasto que se repite cada mes (arriendo, planes, suscripciones)."
              />
              <Toggle
                pressed={form.en_lugar_compra}
                onClick={() => void toggleLugarCompra()}
                disabled={capturandoUbicacion}
                icon={
                  capturandoUbicacion ? (
                    <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  ) : form.en_lugar_compra ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    <MapPin className="size-4" aria-hidden />
                  )
                }
                label={ubicacion ? `En el local · ±${Math.round(ubicacion.precision)} m` : "En el local"}
                title="Guarda la ubicacion del local. Solo para compras presenciales."
              />
              <Toggle
                pressed={productos.length > 0}
                onClick={() => setAgregandoProducto(true)}
                icon={<ShoppingBasket className="size-4" aria-hidden />}
                label={productos.length > 0 ? `Productos · ${productos.length}` : "Productos"}
                title="Anota que compraste en este gasto (opcional)."
              />
            </>
          )}
          {deudaOptions.length > 0 || mostrarDeuda ? (
            <Toggle
              pressed={mostrarDeuda}
              onClick={() => {
                setMostrarDeuda((prev) => !prev)
                setIdDeuda("")
                setErrores((prev) => ({ ...prev, id_deuda: undefined }))
              }}
              icon={<HandCoins className="size-4" aria-hidden />}
              label={esIngreso ? "Cobro de deuda" : "Pago de deuda"}
              title={esIngreso ? "Descuenta este ingreso de lo que te deben." : "Descuenta este gasto de lo que debes."}
            />
          ) : null}
          <Toggle
            pressed={mostrarFecha || Boolean(form.created_at)}
            onClick={() => {
              if (mostrarFecha || form.created_at) {
                setMostrarFecha(false)
                actualizar("created_at", "")
              } else {
                setMostrarFecha(true)
              }
            }}
            icon={<CalendarClock className="size-4" aria-hidden />}
            label={form.created_at ? formatFechaCorta(form.created_at) : "Fecha"}
          />
        </div>

        {mostrarFecha ? (
          <div className="-mt-2">
            <label htmlFor="fecha" className="sr-only">
              Fecha del movimiento
            </label>
            <div className="flex items-center gap-2">
              <input
                id="fecha"
                type="datetime-local"
                value={form.created_at}
                onChange={(event) => actualizar("created_at", event.target.value)}
                aria-invalid={Boolean(errores.created_at) || undefined}
                className="h-11 min-w-0 flex-1 rounded-md border border-border bg-[color:var(--surface-lowest)] px-3 text-sm outline-none focus:border-foreground"
              />
              <button
                type="button"
                onClick={() => {
                  setMostrarFecha(false)
                  actualizar("created_at", "")
                }}
                aria-label="Usar fecha y hora actual"
                className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-[color:var(--surface-low)] hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            {errores.created_at ? <p className="mt-1.5 text-xs font-medium text-destructive">{errores.created_at}</p> : null}
          </div>
        ) : null}

        {mostrarDeuda ? (
          <Grupo titulo={esIngreso ? "Te lo pagó" : "Abona a"} error={errores.id_deuda} errorId="deuda-error">
            <ChipSelect
              label="Deuda"
              options={deudaOptions}
              value={idDeuda}
              onChange={(value) => {
                setIdDeuda(value)
                setErrores((prev) => ({ ...prev, id_deuda: undefined }))
              }}
              loading={deudasQuery.isLoading}
              invalid={Boolean(errores.id_deuda)}
              errorId={errores.id_deuda ? "deuda-error" : undefined}
              emptyMessage={esIngreso ? "No tienes plata por cobrar." : "No tienes deudas pendientes."}
            />
            {deudaSeleccionada && montoNumero !== deudaSeleccionada.saldo ? (
              <button
                type="button"
                onClick={() => actualizar("monto", String(deudaSeleccionada.saldo))}
                className="self-start text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {esIngreso ? "Cobrar" : "Pagar"} el saldo completo · {formatCLP(deudaSeleccionada.saldo)}
              </button>
            ) : null}
          </Grupo>
        ) : null}

        {esIngreso ? null : (
          <ProductosNuevoGasto
            items={productos}
            onChange={setProductos}
            monto={montoNumero}
            agregando={agregandoProducto}
            onAgregandoChange={setAgregandoProducto}
          />
        )}

        <div>
          <label htmlFor="nota" className="sr-only">
            Nota
          </label>
          <input
            id="nota"
            maxLength={250}
            placeholder="Nota (opcional)"
            value={form.descripcion}
            onChange={(event) => actualizar("descripcion", event.target.value)}
            className="h-11 w-full rounded-md border border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-foreground"
          />
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={submittingMovimiento || capturandoUbicacion}
          className="h-12 w-full text-base"
          style={montoNumero ? { background: colorTipo, color: colorTipoOn } : undefined}
        >
          {submittingMovimiento
            ? "Guardando..."
            : `${esIngreso ? "Registrar ingreso" : "Registrar gasto"}${montoNumero ? ` · ${formatCLP(montoNumero)}` : ""}`}
        </Button>
      </form>

      {registrado ? (
        <MovimientoRegistrado key={registrado.id} info={registrado} onClose={cerrarConfirmacion} onAnother={resetParaOtro} />
      ) : null}
    </>
  )
}

function Grupo({
  titulo,
  error,
  errorId,
  children,
}: {
  titulo: string
  error?: string
  errorId: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{titulo}</span>
        {error ? (
          <span id={errorId} className="text-xs font-medium text-destructive">
            {error}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function Toggle({
  pressed,
  onClick,
  icon,
  label,
  disabled,
  title,
}: {
  pressed: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-70",
        pressed
          ? "border-highlight bg-highlight text-highlight-foreground"
          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function ensureSeconds(value: string) {
  return value.length === 16 ? `${value}:00` : value
}

/** "24 sep, 18:30" desde el valor de un datetime-local, sin conversion de zona horaria. */
function formatFechaCorta(value: string) {
  const [fecha, hora = ""] = value.split("T")
  const [y, m, d] = fecha.split("-").map(Number)
  const dia = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace(".", "")
  return hora ? `${dia}, ${hora.slice(0, 5)}` : dia
}
