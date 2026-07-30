"use client"

import { FormEvent, useMemo, useState } from "react"
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Check,
  Folder,
  LoaderCircle,
  MapPin,
  ReceiptText,
  Repeat,
  Wallet,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { FieldGroup, FormPanel, FormSubmitBar } from "@/components/forms/editorial-form"
import { SearchableCombobox } from "@/components/forms/searchable-combobox"
import { Input } from "@/components/ui/input"
import {
  getGeolocationErrorMessage,
  obtenerUbicacion,
  type UbicacionUsuario,
} from "@/lib/geolocation"
import { cn } from "@/lib/utils"
import { useFinanzas } from "@/modules/finanzas/hooks/useFinanzas"
import { movimientoCreateSchema } from "@/modules/finanzas/schemas/finanzas.schema"
import { TipoGasto, TipoMovimiento } from "@/modules/finanzas/types/finanzas"

const initialMovimientoForm = {
  id_categoria: "",
  id_cuenta: "",
  tipo_movimiento: "gasto" as TipoMovimiento,
  tipo_gasto: "variable" as TipoGasto,
  monto: "",
  descripcion: "",
  created_at: "",
  en_lugar_compra: false,
}

const tipoMovimientoOpts: {
  value: TipoMovimiento
  label: string
  icon: typeof ArrowDownLeft
  tone: string
}[] = [
  { value: "gasto", label: "Gasto", icon: ArrowUpRight, tone: "tertiary" },
  { value: "ingreso", label: "Ingreso", icon: ArrowDownLeft, tone: "secondary" },
]

const tipoGastoOpts: { value: TipoGasto; label: string; icon: typeof Zap }[] = [
  { value: "variable", label: "Variable", icon: Zap },
  { value: "fijo", label: "Fijo", icon: Repeat },
]

export function MovimientoFormCard() {
  const {
    categorias,
    cuentas,
    loadingCatalogos,
    submittingMovimiento,
    crearMovimiento,
  } = useFinanzas()

  const [form, setForm] = useState(initialMovimientoForm)
  const [ubicacion, setUbicacion] = useState<UbicacionUsuario | null>(null)
  const [capturandoUbicacion, setCapturandoUbicacion] = useState(false)

  const categoriaOptions = useMemo(
    () =>
      categorias.map((categoria) => ({
        value: String(categoria.id_categoria),
        label: categoria.nombre,
      })),
    [categorias]
  )

  const cuentaOptions = useMemo(
    () =>
      cuentas.map((cuenta) => ({
        value: String(cuenta.id_cuenta),
        label: cuenta.nombre_cuenta,
        description: [cuenta.nombre_banco, cuenta.nombre_producto]
          .filter(Boolean)
          .join(" · ") || undefined,
      })),
    [cuentas]
  )

  const esIngreso = form.tipo_movimiento === "ingreso"

  const selectTipoMovimiento = (tipoMovimiento: TipoMovimiento) => {
    setForm((prev) => ({
      ...prev,
      tipo_movimiento: tipoMovimiento,
      en_lugar_compra:
        tipoMovimiento === "ingreso" ? false : prev.en_lugar_compra,
    }))

    if (tipoMovimiento === "ingreso") {
      setUbicacion(null)
    }
  }

  const toggleLugarCompra = async () => {
    if (form.en_lugar_compra) {
      setForm((prev) => ({ ...prev, en_lugar_compra: false }))
      setUbicacion(null)
      return
    }

    setCapturandoUbicacion(true)
    try {
      const current = await obtenerUbicacion()
      setUbicacion(current)
      setForm((prev) => ({ ...prev, en_lugar_compra: true }))
    } catch (error) {
      setUbicacion(null)
      setForm((prev) => ({ ...prev, en_lugar_compra: false }))
      toast.error("No pudimos obtener tu ubicacion", {
        description: getGeolocationErrorMessage(error),
      })
    } finally {
      setCapturandoUbicacion(false)
    }
  }

  const handleCreateMovimiento = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const parsed = movimientoCreateSchema.safeParse({
      id_categoria: Number(form.id_categoria),
      id_cuenta: Number(form.id_cuenta),
      tipo_movimiento: form.tipo_movimiento,
      tipo_gasto: form.tipo_gasto,
      monto: Number(form.monto),
      descripcion: form.descripcion,
      created_at: form.created_at,
      en_lugar_compra: form.en_lugar_compra,
      latitud: ubicacion?.latitud,
      longitud: ubicacion?.longitud,
      precision_ubicacion: ubicacion?.precision,
    })

    if (!parsed.success) {
      toast.error("Revisa el formulario", {
        description: parsed.error.issues[0]?.message ?? "Completa los datos del movimiento.",
      })
      return
    }

    const payload = {
      ...parsed.data,
      client_request_id: crypto.randomUUID(),
      descripcion: parsed.data.descripcion || null,
      created_at: parsed.data.created_at ? ensureSeconds(parsed.data.created_at) : undefined,
    }

    const result = await crearMovimiento(payload)

    if (result.ok) {
      setForm(initialMovimientoForm)
      setUbicacion(null)
      toast.success(result.queued ? "Movimiento guardado sin conexion" : "Movimiento creado", {
        description: result.queued
          ? "Quedo pendiente y se sincronizara automaticamente al recuperar internet."
          : "El movimiento se registro correctamente.",
      })
      return
    }

    toast.error("No pudimos registrar el movimiento", {
      description: result.message,
    })
  }

  return (
    <FormPanel
      eyebrow="Nuevo movimiento"
      aside={
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary">
              <Wallet className="size-4" />
            </span>
            <p className="text-sm leading-6 text-foreground/80">
              Elige bien la cuenta y la categoria para que despues el historial tenga sentido.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary">
              <ReceiptText className="size-4" />
            </span>
            <p className="text-sm leading-6 text-foreground/80">
              Una descripcion breve ayuda a recordar el contexto real del movimiento.
            </p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleCreateMovimiento} className="space-y-4 sm:space-y-5">
        <FieldGroup label="Tipo de movimiento">
          <div className="relative grid grid-cols-2 gap-2 rounded-[1rem] bg-[color:var(--surface-variant)] p-1">
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-[0.75rem] shadow-[var(--shadow-airy)] transition-all duration-300 ease-out",
                esIngreso
                  ? "translate-x-[calc(100%+0.5rem)] bg-[color:var(--secondary)]"
                  : "translate-x-0 bg-[color:var(--tertiary)]"
              )}
            />
            {tipoMovimientoOpts.map((opt) => {
              const Icon = opt.icon
              const active = form.tipo_movimiento === opt.value
              const activeTextClass =
                opt.tone === "secondary"
                  ? "text-[color:var(--secondary-foreground)]"
                  : "text-[color:var(--tertiary-foreground)]"

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => selectTipoMovimiento(opt.value)}
                  className={cn(
                    "relative z-10 flex h-11 items-center justify-center gap-2 rounded-[0.75rem] text-sm font-medium transition-all duration-300 ease-out",
                    active ? activeTextClass : "text-foreground/70 hover:text-foreground"
                  )}
                >
                  <Icon className={cn("size-4 transition-transform duration-300", active && "scale-105")} />
                  {opt.label}
                </button>
              )
            })}
          </div>
        </FieldGroup>

        <FieldGroup label="Monto" hint={esIngreso ? "Lo recibido" : "Lo que gastaste"}>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-base font-semibold text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="0"
              value={form.monto}
              onChange={(event) => setForm((prev) => ({ ...prev, monto: event.target.value }))}
              className="h-14 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] pl-9 pr-4 text-xl font-semibold shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0 sm:text-2xl"
            />
          </div>
        </FieldGroup>

        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
          <FieldGroup label="Categoria">
            <SearchableCombobox
              value={form.id_categoria}
              onChange={(value) => setForm((prev) => ({ ...prev, id_categoria: value }))}
              options={categoriaOptions}
              placeholder="Selecciona una categoria"
              searchPlaceholder="Buscar categoria..."
              emptyMessage="No hay categorias"
              loading={loadingCatalogos && categoriaOptions.length === 0}
              loadingMessage="Cargando..."
              leadingIcon={<Folder className="size-4" />}
              required
            />
          </FieldGroup>

          <FieldGroup label="Cuenta bancaria">
            <SearchableCombobox
              value={form.id_cuenta}
              onChange={(value) => setForm((prev) => ({ ...prev, id_cuenta: value }))}
              options={cuentaOptions}
              placeholder="Selecciona una cuenta"
              searchPlaceholder="Buscar cuenta..."
              emptyMessage="No hay cuentas registradas"
              loading={loadingCatalogos && cuentaOptions.length === 0}
              loadingMessage="Cargando..."
              leadingIcon={<Wallet className="size-4" />}
              required
            />
          </FieldGroup>
        </div>

        {esIngreso ? null : (
          <>
            <FieldGroup label="Tipo de gasto" hint="Para clasificar">
              <div className="relative grid grid-cols-2 gap-2 rounded-[1rem] bg-[color:var(--surface-variant)] p-1">
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-[0.75rem] bg-[color:var(--surface-lowest)] shadow-[var(--shadow-airy)] transition-all duration-300 ease-out",
                    form.tipo_gasto === "fijo" ? "translate-x-[calc(100%+0.5rem)]" : "translate-x-0"
                  )}
                />
                {tipoGastoOpts.map((opt) => {
                  const Icon = opt.icon
                  const active = form.tipo_gasto === opt.value

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, tipo_gasto: opt.value }))
                      }
                      className={cn(
                        "relative z-10 flex h-10 items-center justify-center gap-2 rounded-[0.75rem] text-sm font-medium transition-all duration-300 ease-out",
                        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className={cn("size-3.5 transition-transform duration-300", active && "scale-105")} />
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </FieldGroup>

            <FieldGroup label="Ubicacion de la compra" hint="Opcional">
              <button
                type="button"
                aria-pressed={form.en_lugar_compra}
                onClick={() => void toggleLugarCompra()}
                disabled={capturandoUbicacion}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[1rem] px-4 py-3 text-left transition",
                  form.en_lugar_compra
                    ? "bg-primary/12 text-foreground"
                    : "bg-[color:var(--surface-variant)] text-foreground/80",
                  capturandoUbicacion && "cursor-wait opacity-70",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full",
                    form.en_lugar_compra
                      ? "bg-primary text-primary-foreground"
                      : "bg-[color:var(--surface-lowest)] text-muted-foreground",
                  )}
                >
                  {capturandoUbicacion ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : form.en_lugar_compra ? (
                    <Check className="size-4" />
                  ) : (
                    <MapPin className="size-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    Estoy en el lugar de compra
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    {capturandoUbicacion
                      ? "Obteniendo tu ubicacion..."
                      : ubicacion
                        ? `Ubicacion capturada · precision aproximada ${Math.round(ubicacion.precision)} m`
                        : "Activalo solo para compras presenciales. Pagos automaticos y compras remotas quedan fuera."}
                  </span>
                </span>
              </button>
            </FieldGroup>
          </>
        )}

        <FieldGroup label="Descripcion" hint="Opcional">
          <Input
            placeholder="Ej: Farmacia del barrio"
            value={form.descripcion}
            onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))}
            className="h-13 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
          />
        </FieldGroup>

        <FieldGroup label="Fecha" hint="Opcional">
          <div className="relative">
            <Input
              type="datetime-local"
              value={form.created_at}
              onChange={(event) => setForm((prev) => ({ ...prev, created_at: event.target.value }))}
              className="h-13 appearance-none rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 pr-11 text-sm leading-none shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0 sm:text-base [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-4 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-date-and-time-value]:text-left [&::-webkit-datetime-edit]:leading-none"
            />
            <CalendarClock className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </FieldGroup>

        <FormSubmitBar className="lg:flex lg:justify-end lg:pr-6 lg:pb-5 lg:pt-4">
          <Button
            type="submit"
            size="lg"
            className="h-13 w-full rounded-xl text-sm font-semibold lg:h-12 lg:w-auto lg:min-w-[13rem] lg:px-6"
            disabled={submittingMovimiento || loadingCatalogos || capturandoUbicacion}
          >
            {submittingMovimiento
              ? "Guardando..."
              : esIngreso
                ? "Registrar ingreso"
                : "Registrar gasto"}
          </Button>
        </FormSubmitBar>
      </form>
    </FormPanel>
  )
}

function ensureSeconds(value: string) {
  return value.length === 16 ? `${value}:00` : value
}
