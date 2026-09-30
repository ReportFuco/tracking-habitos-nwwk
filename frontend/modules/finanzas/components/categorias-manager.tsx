"use client"

import { ArchiveRestore, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EditorialInput, FormPanel } from "@/components/forms/editorial-form"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCategoriasTodas, useFinanzas } from "@/modules/finanzas/hooks/useFinanzas"

/**
 * Administracion de las categorias por defecto (las que ven todos los usuarios). Las
 * propias de cada usuario no aparecen aca: cada uno las gestiona en Finanzas > Categorias.
 */
export function CategoriasManager() {
  const { crearCategoria, editarCategoria, eliminarCategoria } = useFinanzas()
  const todasQuery = useCategoriasTodas()
  const [submitting, setSubmitting] = useState(false)
  const [formValue, setFormValue] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const isEditing = editingId !== null

  const porDefecto = (todasQuery.data ?? []).filter((categoria) => !categoria.es_propia)

  const handleSubmit = async () => {
    if (!formValue.trim()) { toast.error("Nombre requerido"); return }
    setSubmitting(true)
    const result = isEditing
      ? await editarCategoria(editingId!, { nombre: formValue.trim() })
      : await crearCategoria({ nombre: formValue.trim(), por_defecto: true })
    setSubmitting(false)
    if (result.ok) {
      toast.success(isEditing ? "Categoria actualizada" : "Categoria creada")
      setFormValue("")
      setEditingId(null)
      return
    }
    toast.error("No se pudo guardar la categoria", { description: result.message })
  }

  const handleDelete = async (idCategoria: number) => {
    setSubmitting(true)
    const result = await eliminarCategoria(idCategoria)
    if (!result.ok) {
      setSubmitting(false)
      toast.error("No se pudo eliminar la categoria", { description: result.message })
      return
    }
    const { data = [] } = await todasQuery.refetch()
    setSubmitting(false)
    toast.success(
      data.some((categoria) => categoria.id_categoria === idCategoria)
        ? "Categoria archivada: tiene movimientos"
        : "Categoria eliminada",
    )
  }

  const handleRestore = async (idCategoria: number) => {
    const result = await editarCategoria(idCategoria, { activo: true })
    if (!result.ok) toast.error("No se pudo restaurar la categoria", { description: result.message })
  }

  return (
    <FormPanel eyebrow="Categorias por defecto">
      <div className="space-y-5">
        <div className="flex gap-2">
          <EditorialInput
            placeholder={isEditing ? "Nuevo nombre de categoria" : "Nombre de la categoria"}
            value={formValue}
            onChange={(e) => setFormValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleSubmit()}
            autoFocus={isEditing}
          />
          <Button onClick={handleSubmit} disabled={submitting} className="shrink-0">
            {isEditing ? "Guardar" : "Crear"}
          </Button>
          {isEditing ? (
            <Button variant="ghost" className="shrink-0" onClick={() => { setEditingId(null); setFormValue("") }}>
              Cancelar
            </Button>
          ) : null}
        </div>

        {porDefecto.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {todasQuery.isLoading ? "Cargando..." : "No hay categorias registradas."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="w-20 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {porDefecto.map((cat) => (
                <TableRow key={cat.id_categoria}>
                  <TableCell className="font-medium capitalize">
                    <span className={cat.activo ? undefined : "text-muted-foreground line-through"}>{cat.nombre}</span>
                    {cat.activo ? null : <span className="ml-2 text-xs font-normal normal-case text-muted-foreground">Archivada</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {cat.activo ? (
                        <>
                          <Button
                            size="icon" variant="ghost"
                            aria-label={`Renombrar ${cat.nombre}`}
                            className="size-8 text-muted-foreground hover:text-foreground"
                            onClick={() => { setEditingId(cat.id_categoria); setFormValue(cat.nombre) }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost"
                            aria-label={`Eliminar ${cat.nombre}`}
                            title="Se elimina si nadie la usa; si tiene movimientos, se archiva"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(cat.id_categoria)}
                            disabled={submitting}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="icon" variant="ghost"
                          aria-label={`Restaurar ${cat.nombre}`}
                          className="size-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleRestore(cat.id_categoria)}
                        >
                          <ArchiveRestore className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </FormPanel>
  )
}
