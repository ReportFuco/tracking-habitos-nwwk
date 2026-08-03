"use client"

import { Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EditorialInput, FormPanel } from "@/components/forms/editorial-form"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { queryKeys } from "@/lib/query-keys"
import { ComprasAPI } from "@/modules/compras/api/compras.api"
import { cadenasQueryOptions } from "@/modules/compras/queries"

export function CadenasManager() {
  const queryClient = useQueryClient()
  const [formValue, setFormValue] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const isEditing = editingId !== null

  const cadenasQuery = useQuery(cadenasQueryOptions())

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.compras.cadenas }),
      queryClient.invalidateQueries({ queryKey: queryKeys.compras.locales }),
    ])

  const createMutation = useMutation({
    mutationFn: ComprasAPI.createCadena,
    onSuccess: () => invalidate(),
  })
  const updateMutation = useMutation({
    mutationFn: ({ idCadena, nombre }: { idCadena: number; nombre: string }) =>
      ComprasAPI.updateCadena(idCadena, { nombre_cadena: nombre }),
    onSuccess: () => invalidate(),
  })
  const deleteMutation = useMutation({
    mutationFn: ComprasAPI.deleteCadena,
    onSuccess: () => invalidate(),
  })

  const cadenas = cadenasQuery.data ?? []
  const loading = cadenasQuery.isLoading
  const submitting =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  const handleSubmit = async () => {
    const nombre = formValue.trim()
    if (!nombre) {
      toast.error("Nombre requerido")
      return
    }
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ idCadena: editingId!, nombre })
        toast.success("Cadena actualizada")
      } else {
        await createMutation.mutateAsync({ nombre_cadena: nombre })
        toast.success("Cadena creada")
      }
      setFormValue("")
      setEditingId(null)
    } catch {
      toast.error("No se pudo guardar la cadena")
    }
  }

  const handleDelete = async (idCadena: number) => {
    try {
      await deleteMutation.mutateAsync(idCadena)
      toast.success("Cadena eliminada")
    } catch {
      toast.error("No se pudo eliminar la cadena")
    }
  }

  return (
    <FormPanel eyebrow="Compras maestras">
      <div className="space-y-5">
        <div className="flex gap-2">
          <EditorialInput
            placeholder={isEditing ? "Nuevo nombre de la cadena" : "Nombre de la cadena"}
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
        ) : cadenas.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay cadenas registradas.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cadena</TableHead>
                <TableHead className="w-20 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cadenas.map((cadena) => (
                <TableRow key={cadena.id_cadena}>
                  <TableCell className="font-medium">{cadena.nombre_cadena}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon" variant="ghost"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        onClick={() => { setEditingId(cadena.id_cadena); setFormValue(cadena.nombre_cadena) }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(cadena.id_cadena)}
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
