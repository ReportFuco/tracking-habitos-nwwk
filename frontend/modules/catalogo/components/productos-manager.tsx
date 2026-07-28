"use client"

import { Pencil, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EditorialInput, FieldGroup, FormPanel, FormSubmitBar } from "@/components/forms/editorial-form"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SearchableCombobox } from "@/components/forms/searchable-combobox"
import { queryKeys } from "@/lib/query-keys"
import { CatalogoAPI } from "@/modules/catalogo/api/catalogo.api"
import type { ProductoResponse } from "@/modules/catalogo/types/catalogo"

type FormState = {
  nombre_producto: string
  id_marca: string
  codigo_barra: string
  sabor: string
  formato: string
  contenido_neto: string
  unidad_contenido: string
}

const emptyForm: FormState = {
  nombre_producto: "",
  id_marca: "",
  codigo_barra: "",
  sabor: "",
  formato: "",
  contenido_neto: "",
  unidad_contenido: "",
}

const toPayload = (f: FormState) => ({
  nombre_producto: f.nombre_producto.trim(),
  id_marca: f.id_marca ? Number(f.id_marca) : null,
  codigo_barra: f.codigo_barra.trim() || null,
  sabor: f.sabor.trim() || null,
  formato: f.formato.trim() || null,
  contenido_neto: f.contenido_neto ? Number(f.contenido_neto) : null,
  unidad_contenido: f.unidad_contenido.trim() || null,
})

const toFormState = (p: ProductoResponse): FormState => ({
  nombre_producto: p.nombre_producto,
  id_marca: p.id_marca != null ? String(p.id_marca) : "",
  codigo_barra: p.codigo_barra ?? "",
  sabor: p.sabor ?? "",
  formato: p.formato ?? "",
  contenido_neto: p.contenido_neto != null ? String(p.contenido_neto) : "",
  unidad_contenido: p.unidad_contenido ?? "",
})

export function ProductosManager() {
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const isEditing = editingId !== null

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 250)
    return () => clearTimeout(timer)
  }, [searchInput])

  const productosParams = debouncedSearch ? { q: debouncedSearch } : undefined

  const productosQuery = useQuery({
    queryKey: queryKeys.catalogo.productos(productosParams),
    queryFn: () => CatalogoAPI.getProductos(productosParams),
  })
  const marcasQuery = useQuery({
    queryKey: queryKeys.catalogo.marcas,
    queryFn: CatalogoAPI.getMarcas,
  })

  const invalidateProductos = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.catalogo.productosRoot }),
      // Tablas nutricionales muestran nombre_producto denormalizado.
      queryClient.invalidateQueries({ queryKey: queryKeys.nutricion.tablas }),
    ])

  const createMutation = useMutation({
    mutationFn: CatalogoAPI.createProducto,
    onSuccess: () => invalidateProductos(),
  })
  const updateMutation = useMutation({
    mutationFn: ({ idProducto, payload }: { idProducto: number; payload: ReturnType<typeof toPayload> }) =>
      CatalogoAPI.updateProducto(idProducto, payload),
    onSuccess: () => invalidateProductos(),
  })
  const deleteMutation = useMutation({
    mutationFn: CatalogoAPI.deleteProducto,
    onSuccess: () => invalidateProductos(),
  })

  const productos = productosQuery.data ?? []
  const loading = productosQuery.isLoading
  const submitting =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  const marcaOptions = useMemo(
    () => (marcasQuery.data ?? []).map((m) => ({ value: String(m.id_marca), label: m.nombre_marca })),
    [marcasQuery.data],
  )

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm) }
  const set = (patch: Partial<FormState>) => setForm((p) => ({ ...p, ...patch }))

  const handleSubmit = async () => {
    if (!form.nombre_producto.trim()) { toast.error("Nombre requerido"); return }
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ idProducto: editingId!, payload: toPayload(form) })
        toast.success("Producto actualizado")
        cancelEdit()
      } else {
        await createMutation.mutateAsync(toPayload(form))
        toast.success("Producto creado")
        setForm(emptyForm)
      }
    } catch {
      toast.error("No se pudo guardar el producto")
    }
  }

  const handleDelete = async (idProducto: number) => {
    try {
      await deleteMutation.mutateAsync(idProducto)
      toast.success("Producto eliminado")
    } catch {
      toast.error("No se pudo eliminar el producto")
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
      <FormPanel eyebrow={isEditing ? "Editando producto" : "Nuevo producto"}>
        <div className="space-y-4 sm:space-y-5">
          <FieldGroup label="Nombre">
            <EditorialInput placeholder="Ej: Yogurt protein" value={form.nombre_producto} onChange={(e) => set({ nombre_producto: e.target.value })} />
          </FieldGroup>
          <FieldGroup label="Marca" hint="Opcional">
            <SearchableCombobox
              value={form.id_marca}
              onChange={(v) => set({ id_marca: v })}
              options={marcaOptions}
              placeholder="Sin marca"
              searchPlaceholder="Buscar marca..."
            />
          </FieldGroup>
          <FieldGroup label="Codigo de barra" hint="Opcional">
            <EditorialInput placeholder="7801234567890" value={form.codigo_barra} onChange={(e) => set({ codigo_barra: e.target.value })} />
          </FieldGroup>
          <FieldGroup label="Sabor / Formato" hint="Opcional">
            <div className="grid grid-cols-2 gap-2">
              <EditorialInput placeholder="Sabor" value={form.sabor} onChange={(e) => set({ sabor: e.target.value })} />
              <EditorialInput placeholder="Formato" value={form.formato} onChange={(e) => set({ formato: e.target.value })} />
            </div>
          </FieldGroup>
          <FieldGroup label="Contenido neto" hint="Opcional">
            <div className="grid grid-cols-2 gap-2">
              <EditorialInput type="number" placeholder="350" value={form.contenido_neto} onChange={(e) => set({ contenido_neto: e.target.value })} />
              <EditorialInput placeholder="ml, g, kg..." value={form.unidad_contenido} onChange={(e) => set({ unidad_contenido: e.target.value })} />
            </div>
          </FieldGroup>
          <FormSubmitBar>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto">
                {submitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear producto"}
              </Button>
              {isEditing ? <Button variant="ghost" onClick={cancelEdit}>Cancelar</Button> : null}
            </div>
          </FormSubmitBar>
        </div>
      </FormPanel>

      <FormPanel eyebrow="Catalogo">
        <div className="space-y-4">
          <EditorialInput
            placeholder="Buscar producto..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />

          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : productos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin resultados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Contenido</TableHead>
                  <TableHead className="w-20 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {productos.map((prod) => (
                  <TableRow key={prod.id_producto}>
                    <TableCell>
                      <div className="font-medium">{prod.nombre_producto}</div>
                      <div className="text-xs text-muted-foreground">
                        {[prod.nombre_marca, prod.codigo_barra].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {prod.contenido_neto != null ? `${prod.contenido_neto} ${prod.unidad_contenido ?? ""}`.trim() : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon" variant="ghost"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          onClick={() => { setEditingId(prod.id_producto); setForm(toFormState(prod)) }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(prod.id_producto)}
                          disabled={submitting}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </FormPanel>
    </section>
  )
}
