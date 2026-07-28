"use client"

import { Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EditorialInput, FormPanel } from "@/components/forms/editorial-form"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useFinanzas } from "@/modules/finanzas/hooks/useFinanzas"

export function CategoriasManager() {
  const { categorias, crearCategoria, editarCategoria, eliminarCategoria } = useFinanzas()
  const [submitting, setSubmitting] = useState(false)
  const [formValue, setFormValue] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const isEditing = editingId !== null

  const handleSubmit = async () => {
    if (!formValue.trim()) { toast.error("Nombre requerido"); return }
    setSubmitting(true)
    const result = isEditing
      ? await editarCategoria(editingId!, { nombre: formValue.trim() })
      : await crearCategoria({ nombre: formValue.trim() })
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
    setSubmitting(false)
    if (result.ok) { toast.success("Categoria eliminada"); return }
    toast.error("No se pudo eliminar la categoria", { description: result.message })
  }

  return (
    <FormPanel eyebrow="Finanzas maestras">
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

        {categorias.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay categorias registradas.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="w-20 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categorias.map((cat) => (
                <TableRow key={cat.id_categoria}>
                  <TableCell className="font-medium capitalize">{cat.nombre}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon" variant="ghost"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        onClick={() => { setEditingId(cat.id_categoria); setFormValue(cat.nombre) }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(cat.id_categoria)}
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
  )
}
