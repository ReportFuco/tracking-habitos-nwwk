"use client"

import { FormEvent, useMemo, useRef, useState } from "react"
import { Building2, Landmark, Package } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { FormNote, FormPanel, FieldGroup, FormSubmitBar } from "@/components/forms/editorial-form"
import { SearchableCombobox } from "@/components/forms/searchable-combobox"
import { Input } from "@/components/ui/input"
import { useFinanzas } from "@/modules/finanzas/hooks/useFinanzas"
import { cuentaCreateSchema } from "@/modules/finanzas/schemas/finanzas.schema"
import { ProductoFinancieroResponse } from "@/modules/finanzas/types/finanzas"

const initialCuentaForm = {
  id_banco: "",
  id_producto_financiero: "",
  nombre_cuenta: "",
}

export function CuentaFormCard() {
  const { bancos, loadingCatalogos, submittingCuenta, crearCuenta, getProductosByBanco } =
    useFinanzas()
  const [form, setForm] = useState(initialCuentaForm)
  const [productos, setProductos] = useState<ProductoFinancieroResponse[]>([])
  const [loadingProductos, setLoadingProductos] = useState(false)
  const productosRequestRef = useRef(0)

  const bancoOptions = useMemo(
    () =>
      bancos.map((banco) => ({
        value: String(banco.id_banco),
        label: banco.nombre_banco,
      })),
    [bancos]
  )

  const productoOptions = useMemo(
    () =>
      productos.map((producto) => ({
        value: String(producto.id_producto_financiero),
        label: producto.nombre_producto,
        description: producto.descripcion ?? undefined,
      })),
    [productos]
  )

  const bancoSeleccionado = bancos.find(
    (banco) => String(banco.id_banco) === form.id_banco
  )

  const handleBancoChange = (value: string) => {
    const requestId = productosRequestRef.current + 1
    productosRequestRef.current = requestId

    setProductos([])
    setForm((prev) => ({
      ...prev,
      id_banco: value,
      id_producto_financiero: "",
    }))

    if (!value) {
      setLoadingProductos(false)
      return
    }

    setLoadingProductos(true)

    void getProductosByBanco(Number(value))
      .then((result) => {
        if (productosRequestRef.current !== requestId) return
        setProductos(result)
      })
      .finally(() => {
        if (productosRequestRef.current === requestId) {
          setLoadingProductos(false)
        }
      })
  }

  const handleProductoChange = (value: string) => {
    setForm((prev) => ({ ...prev, id_producto_financiero: value }))
  }

  const handleCreateCuenta = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const parsed = cuentaCreateSchema.safeParse({
      id_producto_financiero: Number(form.id_producto_financiero),
      nombre_cuenta: form.nombre_cuenta,
    })

    if (!parsed.success) {
      toast.error("Revisa el formulario", {
        description: parsed.error.issues[0]?.message ?? "Completa los datos de la cuenta.",
      })
      return
    }

    const result = await crearCuenta(parsed.data)

    if (result.ok) {
      setForm(initialCuentaForm)
      setProductos([])
      toast.success("Cuenta creada", {
        description: "La cuenta bancaria fue creada correctamente.",
      })
      return
    }

    toast.error("No pudimos crear la cuenta", {
      description: result.message,
    })
  }

  const productoDisabled = !form.id_banco || loadingProductos
  const productoDisabledMessage = !form.id_banco
    ? "Primero selecciona un banco"
    : productos.length === 0 && !loadingProductos
      ? "Este banco aun no tiene productos"
      : undefined

  return (
    <FormPanel
      eyebrow="Nueva cuenta"
      aside={
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary">
              <Landmark className="size-4" />
            </span>
            <p className="text-sm leading-6 text-foreground/80">
              Cada banco tiene sus propios productos, como CuentaRUT, CMR o Cuenta Corriente.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/12 text-primary">
              <Building2 className="size-4" />
            </span>
            <p className="text-sm leading-6 text-foreground/80">
              Un nombre claro en la cuenta ayuda a reconocerla despues en cada movimiento.
            </p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleCreateCuenta} className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <FieldGroup label="Banco" hint="Requerido">
            <SearchableCombobox
              value={form.id_banco}
              onChange={handleBancoChange}
              options={bancoOptions}
              placeholder="Selecciona un banco"
              searchPlaceholder="Buscar banco..."
              emptyMessage="No encontramos bancos"
              loading={loadingCatalogos && bancoOptions.length === 0}
              loadingMessage="Cargando bancos..."
              leadingIcon={<Landmark className="size-4" />}
              compactOnMobile
              required
            />
          </FieldGroup>

          <FieldGroup
            label="Producto financiero"
            hint={bancoSeleccionado ? `Productos de ${bancoSeleccionado.nombre_banco}` : "Depende del banco"}
          >
            <SearchableCombobox
              value={form.id_producto_financiero}
              onChange={handleProductoChange}
              options={productoOptions}
              placeholder="Selecciona un producto"
              searchPlaceholder="Buscar producto..."
              emptyMessage="Este banco no tiene productos disponibles"
              disabled={productoDisabled}
              disabledMessage={productoDisabledMessage}
              loading={loadingProductos}
              loadingMessage="Cargando productos..."
              leadingIcon={<Package className="size-4" />}
              compactOnMobile
              required
            />
          </FieldGroup>
        </div>

        <FieldGroup label="Nombre de la cuenta" hint="Visible en tus movimientos">
          <Input
            placeholder="Ej: Cuenta principal"
            value={form.nombre_cuenta}
            onChange={(event) => setForm((prev) => ({ ...prev, nombre_cuenta: event.target.value }))}
            className="h-13 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
          />
        </FieldGroup>

        <FormNote>
          El producto financiero define el banco y el tipo comercial real de la cuenta
          (CuentaRUT, Cuenta Corriente, CMR, etc). Si no ves el producto que buscas, pide que
          un administrador lo cargue en el catalogo.
        </FormNote>

        <FormSubmitBar>
          <Button
            type="submit"
            size="lg"
            className="h-12 w-full rounded-xl sm:w-auto"
            disabled={submittingCuenta || loadingCatalogos}
          >
            {submittingCuenta ? "Guardando..." : "Crear cuenta bancaria"}
          </Button>
        </FormSubmitBar>
      </form>
    </FormPanel>
  )
}
