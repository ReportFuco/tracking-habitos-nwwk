"use client"

import { Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EditorialInput, FormPanel } from "@/components/forms/editorial-form"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useFinanzas } from "@/modules/finanzas/hooks/useFinanzas"

export function BancosManager() {
  const { bancos, crearBanco, editarBanco, eliminarBanco } = useFinanzas()
  const [submitting, setSubmitting] = useState(false)
  const [formValue, setFormValue] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const isEditing = editingId !== null

  const handleSubmit = async () => {
    if (!formValue.trim()) { toast.error("Nombre requerido"); return }
    setSubmitting(true)
    const result = isEditing
      ? await editarBanco(editingId!, { nombre_banco: formValue.trim() })
      : await crearBanco({ nombre_banco: formValue.trim() })
    setSubmitting(false)
    if (result.ok) {
      toast.success(isEditing ? "Banco actualizado" : "Banco creado")
      setFormValue("")
      setEditingId(null)
      return
    }
    toast.error("No se pudo guardar el banco", { description: result.message })
  }

  const handleDelete = async (idBanco: number) => {
    setSubmitting(true)
    const result = await eliminarBanco(idBanco)
    setSubmitting(false)
    if (result.ok) { toast.success("Banco eliminado"); return }
    toast.error("No se pudo eliminar el banco", { description: result.message })
  }

  return (
    <FormPanel eyebrow="Finanzas maestras">
      <div className="space-y-5">
        <div className="flex gap-2">
          <EditorialInput
            placeholder={isEditing ? "Nuevo nombre del banco" : "Nombre del banco"}
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

        {bancos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay bancos registrados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Banco</TableHead>
                <TableHead className="w-20 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {bancos.map((banco) => (
                <TableRow key={banco.id_banco}>
                  <TableCell className="font-medium">{banco.nombre_banco}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon" variant="ghost"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        onClick={() => { setEditingId(banco.id_banco); setFormValue(banco.nombre_banco) }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(banco.id_banco)}
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
