"use client"

import { Pencil, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EditorialInput, FieldGroup, FormPanel, FormSubmitBar } from "@/components/forms/editorial-form"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SearchableCombobox } from "@/components/forms/searchable-combobox"
import { InvalidNumericInputError, parseOptionalNumber, parseRequiredNumber } from "@/lib/parse-numeric"
import { queryKeys } from "@/lib/query-keys"
import { NutricionAPI } from "@/modules/nutricion/api/nutricion.api"
import { tablasQueryOptions } from "@/modules/nutricion/queries"
import { CatalogoAPI } from "@/modules/catalogo/api/catalogo.api"
import type { TablaNutricionalResponse } from "@/modules/nutricion/types/nutricion"

type FormState = {
  id_producto: string
  porcion_cantidad: string
  porcion_unidad: string
  calorias: string
  proteinas: string
  carbohidratos: string
  grasas: string
  azucares: string
  sodio: string
  fibra: string
}

const emptyForm: FormState = {
  id_producto: "",
  porcion_cantidad: "",
  porcion_unidad: "g",
  calorias: "",
  proteinas: "",
  carbohidratos: "",
  grasas: "",
  azucares: "",
  sodio: "",
  fibra: "",
}

const toCreatePayload = (f: FormState) => ({
  id_producto: parseRequiredNumber(f.id_producto),
  porcion_cantidad: parseRequiredNumber(f.porcion_cantidad),
  porcion_unidad: f.porcion_unidad.trim(),
  calorias: parseRequiredNumber(f.calorias),
  proteinas: parseRequiredNumber(f.proteinas),
  carbohidratos: parseRequiredNumber(f.carbohidratos),
  grasas: parseRequiredNumber(f.grasas),
  azucares: parseOptionalNumber(f.azucares),
  sodio: parseOptionalNumber(f.sodio),
  fibra: parseOptionalNumber(f.fibra),
})

const toPatchPayload = (f: FormState) => ({
  porcion_cantidad: parseOptionalNumber(f.porcion_cantidad),
  porcion_unidad: f.porcion_unidad.trim() || null,
  calorias: parseOptionalNumber(f.calorias),
  proteinas: parseOptionalNumber(f.proteinas),
  carbohidratos: parseOptionalNumber(f.carbohidratos),
  grasas: parseOptionalNumber(f.grasas),
  azucares: parseOptionalNumber(f.azucares),
  sodio: parseOptionalNumber(f.sodio),
  fibra: parseOptionalNumber(f.fibra),
})

const toFormState = (t: TablaNutricionalResponse): FormState => ({
  id_producto: String(t.id_producto),
  porcion_cantidad: t.porcion_cantidad != null ? String(t.porcion_cantidad) : "",
  porcion_unidad: t.porcion_unidad ?? "",
  calorias: t.calorias != null ? String(t.calorias) : "",
  proteinas: t.proteinas != null ? String(t.proteinas) : "",
  carbohidratos: t.carbohidratos != null ? String(t.carbohidratos) : "",
  grasas: t.grasas != null ? String(t.grasas) : "",
  azucares: t.azucares != null ? String(t.azucares) : "",
  sodio: t.sodio != null ? String(t.sodio) : "",
  fibra: t.fibra != null ? String(t.fibra) : "",
})

export function TablasAdminManager() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const isEditing = editingId !== null

  const tablasQuery = useQuery(tablasQueryOptions())
  const productosQuery = useQuery({
    queryKey: queryKeys.catalogo.productos(),
    queryFn: () => CatalogoAPI.getProductos(),
  })

  const invalidateTablas = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.nutricion.tablas })

  const createMutation = useMutation({
    mutationFn: NutricionAPI.createTabla,
    onSuccess: () => invalidateTablas(),
  })
  const updateMutation = useMutation({
    mutationFn: ({ idTabla, payload }: { idTabla: number; payload: ReturnType<typeof toPatchPayload> }) =>
      NutricionAPI.updateTabla(idTabla, payload),
    onSuccess: () => invalidateTablas(),
  })
  const deleteMutation = useMutation({
    mutationFn: NutricionAPI.deleteTabla,
    onSuccess: () => invalidateTablas(),
  })

  const tablas = tablasQuery.data ?? []
  const loading = tablasQuery.isLoading || productosQuery.isLoading
  const submitting =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  const productoOptions = useMemo(
    () => (productosQuery.data ?? []).map((p) => ({
      value: String(p.id_producto),
      label: p.nombre_producto,
      description: p.nombre_marca ?? undefined,
    })),
    [productosQuery.data],
  )

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm) }
  const set = (patch: Partial<FormState>) => setForm((p) => ({ ...p, ...patch }))

  const isValid = (f: FormState) =>
    f.id_producto && f.porcion_cantidad && f.porcion_unidad.trim() &&
    f.calorias && f.proteinas && f.carbohidratos && f.grasas

  const handleSubmit = async () => {
    if (!isValid(form)) {
      toast.error("Producto, porcion y macros principales son requeridos")
      return
    }
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ idTabla: editingId!, payload: toPatchPayload(form) })
        toast.success("Tabla actualizada")
        cancelEdit()
      } else {
        await createMutation.mutateAsync(toCreatePayload(form))
        toast.success("Tabla nutricional creada")
        setForm(emptyForm)
      }
    } catch (err) {
      if (err instanceof InvalidNumericInputError) {
        toast.error("Revisa los valores numericos", { description: err.message })
      } else {
        toast.error("No se pudo guardar la tabla")
      }
    }
  }

  const handleDelete = async (idTabla: number) => {
    try {
      await deleteMutation.mutateAsync(idTabla)
      toast.success("Tabla eliminada")
    } catch {
      toast.error("No se pudo eliminar la tabla")
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
      <FormPanel eyebrow={isEditing ? "Editando tabla" : "Nueva tabla nutricional"}>
        <div className="space-y-4 sm:space-y-5">
          <FieldGroup label="Producto">
            <SearchableCombobox
              value={form.id_producto}
              onChange={(v) => set({ id_producto: v })}
              options={productoOptions}
              placeholder="Selecciona un producto"
              searchPlaceholder="Buscar producto..."
              allowClear={false}
              disabled={isEditing}
            />
          </FieldGroup>
          <FieldGroup label="Porcion">
            <div className="grid grid-cols-2 gap-2">
              <EditorialInput type="number" placeholder="30" value={form.porcion_cantidad} onChange={(e) => set({ porcion_cantidad: e.target.value })} />
              <EditorialInput placeholder="g, ml..." value={form.porcion_unidad} onChange={(e) => set({ porcion_unidad: e.target.value })} />
            </div>
          </FieldGroup>
          <FieldGroup label="Calorias (kcal)">
            <EditorialInput type="number" placeholder="120" value={form.calorias} onChange={(e) => set({ calorias: e.target.value })} />
          </FieldGroup>
          <FieldGroup label="Macros principales">
            <div className="grid grid-cols-3 gap-2">
              <EditorialInput type="number" placeholder="Prot. (g)" value={form.proteinas} onChange={(e) => set({ proteinas: e.target.value })} />
              <EditorialInput type="number" placeholder="Carbos (g)" value={form.carbohidratos} onChange={(e) => set({ carbohidratos: e.target.value })} />
              <EditorialInput type="number" placeholder="Grasas (g)" value={form.grasas} onChange={(e) => set({ grasas: e.target.value })} />
            </div>
          </FieldGroup>
          <FieldGroup label="Opcionales">
            <div className="grid grid-cols-3 gap-2">
              <EditorialInput type="number" placeholder="Azuc. (g)" value={form.azucares} onChange={(e) => set({ azucares: e.target.value })} />
              <EditorialInput type="number" placeholder="Sodio (mg)" value={form.sodio} onChange={(e) => set({ sodio: e.target.value })} />
              <EditorialInput type="number" placeholder="Fibra (g)" value={form.fibra} onChange={(e) => set({ fibra: e.target.value })} />
            </div>
          </FieldGroup>
          <FormSubmitBar>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto">
                {submitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear tabla"}
              </Button>
              {isEditing ? <Button variant="ghost" onClick={cancelEdit}>Cancelar</Button> : null}
            </div>
          </FormSubmitBar>
        </div>
      </FormPanel>

      <FormPanel eyebrow="Catalogo">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : tablas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay tablas registradas.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Porcion · Macros</TableHead>
                <TableHead className="w-20 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tablas.map((tabla) => (
                <TableRow key={tabla.id_tabla}>
                  <TableCell className="font-medium">
                    {tabla.nombre_producto ?? `#${tabla.id_producto}`}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div>{tabla.porcion_cantidad ?? "—"} {tabla.porcion_unidad ?? ""} · {tabla.calorias ?? "—"} kcal</div>
                    <div className="text-xs">P:{tabla.proteinas ?? "—"}g C:{tabla.carbohidratos ?? "—"}g G:{tabla.grasas ?? "—"}g</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon" variant="ghost"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        onClick={() => { setEditingId(tabla.id_tabla); setForm(toFormState(tabla)) }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(tabla.id_tabla)}
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
      </FormPanel>
    </section>
  )
}
