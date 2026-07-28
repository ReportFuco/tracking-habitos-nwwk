"use client"

import { Pencil, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EditorialInput, FormPanel } from "@/components/forms/editorial-form"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CatalogoAPI } from "@/modules/catalogo/api/catalogo.api"
import type { MarcaResponse } from "@/modules/catalogo/types/catalogo"

export function MarcasManager() {
  const [marcas, setMarcas] = useState<MarcaResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formValue, setFormValue] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const isEditing = editingId !== null

  useEffect(() => {
    void CatalogoAPI.getMarcas()
      .then(setMarcas)
      .catch(() => toast.error("Error al cargar marcas"))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async () => {
    if (!formValue.trim()) { toast.error("Nombre requerido"); return }
    setSubmitting(true)
    try {
      if (isEditing) {
        const updated = await CatalogoAPI.updateMarca(editingId!, { nombre_marca: formValue.trim() })
        setMarcas((prev) => prev.map((m) => (m.id_marca === editingId ? updated : m)))
        toast.success("Marca actualizada")
      } else {
        const nueva = await CatalogoAPI.createMarca({ nombre_marca: formValue.trim() })
        setMarcas((prev) => [...prev, nueva])
        toast.success("Marca creada")
      }
      setFormValue("")
      setEditingId(null)
    } catch {
      toast.error("No se pudo guardar la marca")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (idMarca: number) => {
    setSubmitting(true)
    try {
      await CatalogoAPI.deleteMarca(idMarca)
      setMarcas((prev) => prev.filter((m) => m.id_marca !== idMarca))
      toast.success("Marca eliminada")
    } catch {
      toast.error("No se pudo eliminar la marca")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormPanel eyebrow="Catalogo">
      <div className="space-y-5">
        <div className="flex gap-2">
          <EditorialInput
            placeholder={isEditing ? "Nuevo nombre de la marca" : "Nombre de la marca"}
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

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : marcas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay marcas registradas.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marca</TableHead>
                <TableHead className="w-20 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {marcas.map((marca) => (
                <TableRow key={marca.id_marca}>
                  <TableCell className="font-medium">{marca.nombre_marca}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon" variant="ghost"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        onClick={() => { setEditingId(marca.id_marca); setFormValue(marca.nombre_marca) }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(marca.id_marca)}
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
