"use client"

import { Pencil, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EditorialInput, FieldGroup, FormPanel, FormSubmitBar } from "@/components/forms/editorial-form"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SearchableCombobox } from "@/components/forms/searchable-combobox"
import { ComprasAPI } from "@/modules/compras/api/compras.api"
import type { LocalResponse, CadenaResponse } from "@/modules/compras/types/compras"

type FormState = {
  nombre_local: string
  id_cadena: string
  direccion: string
  latitud: string
  longitud: string
}

const emptyForm: FormState = { nombre_local: "", id_cadena: "", direccion: "", latitud: "", longitud: "" }

const toPayload = (f: FormState) => ({
  nombre_local: f.nombre_local.trim(),
  id_cadena: f.id_cadena ? Number(f.id_cadena) : null,
  direccion: f.direccion.trim() || null,
  latitud: f.latitud ? Number(f.latitud) : null,
  longitud: f.longitud ? Number(f.longitud) : null,
})

const toFormState = (l: LocalResponse): FormState => ({
  nombre_local: l.nombre_local,
  id_cadena: l.id_cadena != null ? String(l.id_cadena) : "",
  direccion: l.direccion ?? "",
  latitud: l.latitud != null ? String(l.latitud) : "",
  longitud: l.longitud != null ? String(l.longitud) : "",
})

export function LocalesManager() {
  const [locales, setLocales] = useState<LocalResponse[]>([])
  const [cadenas, setCadenas] = useState<CadenaResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const isEditing = editingId !== null

  useEffect(() => {
    void Promise.all([ComprasAPI.getLocales(), ComprasAPI.getCadenas()])
      .then(([ls, cs]) => { setLocales(ls); setCadenas(cs) })
      .catch(() => toast.error("Error al cargar datos"))
      .finally(() => setLoading(false))
  }, [])

  const cadenaOptions = useMemo(
    () => cadenas.map((c) => ({ value: String(c.id_cadena), label: c.nombre_cadena })),
    [cadenas],
  )

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm) }
  const set = (patch: Partial<FormState>) => setForm((p) => ({ ...p, ...patch }))

  const handleSubmit = async () => {
    if (!form.nombre_local.trim()) { toast.error("Nombre requerido"); return }
    setSubmitting(true)
    try {
      if (isEditing) {
        const updated = await ComprasAPI.updateLocal(editingId!, toPayload(form))
        setLocales((prev) => prev.map((l) => (l.id_local === editingId ? updated : l)))
        toast.success("Local actualizado")
        cancelEdit()
      } else {
        const nuevo = await ComprasAPI.createLocal(toPayload(form))
        setLocales((prev) => [...prev, nuevo])
        toast.success("Local creado")
        setForm(emptyForm)
      }
    } catch {
      toast.error("No se pudo guardar el local")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (idLocal: number) => {
    setSubmitting(true)
    try {
      await ComprasAPI.deleteLocal(idLocal)
      setLocales((prev) => prev.filter((l) => l.id_local !== idLocal))
      toast.success("Local eliminado")
    } catch {
      toast.error("No se pudo eliminar el local")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
      <FormPanel eyebrow={isEditing ? "Editando local" : "Nuevo local"}>
        <div className="space-y-4 sm:space-y-5">
          <FieldGroup label="Nombre">
            <EditorialInput placeholder="Ej: Lider Nunoa" value={form.nombre_local} onChange={(e) => set({ nombre_local: e.target.value })} />
          </FieldGroup>
          <FieldGroup label="Cadena" hint="Opcional">
            <SearchableCombobox
              value={form.id_cadena}
              onChange={(v) => set({ id_cadena: v })}
              options={cadenaOptions}
              placeholder="Sin cadena"
              searchPlaceholder="Buscar cadena..."
            />
          </FieldGroup>
          <FieldGroup label="Direccion" hint="Opcional">
            <EditorialInput placeholder="Av. Ejemplo 123" value={form.direccion} onChange={(e) => set({ direccion: e.target.value })} />
          </FieldGroup>
          <FieldGroup label="Coordenadas" hint="Opcional">
            <div className="grid grid-cols-2 gap-2">
              <EditorialInput type="number" placeholder="Latitud" value={form.latitud} onChange={(e) => set({ latitud: e.target.value })} />
              <EditorialInput type="number" placeholder="Longitud" value={form.longitud} onChange={(e) => set({ longitud: e.target.value })} />
            </div>
          </FieldGroup>
          <FormSubmitBar>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto">
                {submitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear local"}
              </Button>
              {isEditing ? <Button variant="ghost" onClick={cancelEdit}>Cancelar</Button> : null}
            </div>
          </FormSubmitBar>
        </div>
      </FormPanel>

      <FormPanel eyebrow="Catalogo">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : locales.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay locales registrados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Local</TableHead>
                <TableHead>Cadena</TableHead>
                <TableHead className="w-20 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {locales.map((local) => (
                <TableRow key={local.id_local}>
                  <TableCell>
                    <div className="font-medium">{local.nombre_local}</div>
                    {local.direccion ? <div className="text-xs text-muted-foreground">{local.direccion}</div> : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {local.nombre_cadena ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon" variant="ghost"
                        className="size-8 text-muted-foreground hover:text-foreground"
                        onClick={() => { setEditingId(local.id_local); setForm(toFormState(local)) }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(local.id_local)}
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
