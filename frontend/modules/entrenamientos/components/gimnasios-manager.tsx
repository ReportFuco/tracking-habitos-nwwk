"use client"

import { Pencil, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EditorialInput, FieldGroup, FormPanel, FormSubmitBar } from "@/components/forms/editorial-form"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useEntrenamientos } from "@/modules/entrenamientos/hooks/useEntrenamientos"
import { gimnasioCreateSchema, gimnasioEditSchema } from "@/modules/entrenamientos/schemas/entrenamientos.schema"
import type { GimnasioResponse } from "@/modules/entrenamientos/types/entrenamientos"

type FormState = {
  nombre_gimnasio: string
  nombre_cadena: string
  direccion: string
  comuna: string
  latitud: string
  longitud: string
}

const emptyForm: FormState = {
  nombre_gimnasio: "",
  nombre_cadena: "",
  direccion: "",
  comuna: "",
  latitud: "",
  longitud: "",
}

const toPayload = (f: FormState) => ({
  nombre_gimnasio: f.nombre_gimnasio,
  nombre_cadena: f.nombre_cadena || null,
  direccion: f.direccion,
  comuna: f.comuna || null,
  latitud: Number(f.latitud),
  longitud: Number(f.longitud),
})

const toFormState = (g: GimnasioResponse): FormState => ({
  nombre_gimnasio: g.nombre_gimnasio,
  nombre_cadena: g.nombre_cadena ?? "",
  direccion: g.direccion,
  comuna: g.comuna ?? "",
  latitud: String(g.latitud),
  longitud: String(g.longitud),
})

export function GimnasiosManager() {
  const { gimnasios, loading, fetchGimnasios, crearGimnasio, editarGimnasio, eliminarGimnasio } =
    useEntrenamientos()
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState("")
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const isEditing = editingId !== null

  const cancelEdit = useCallback(() => { setEditingId(null); setForm(emptyForm) }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchGimnasios(search.trim() || undefined)
    }, 250)
    return () => clearTimeout(timer)
  }, [fetchGimnasios, search])

  const handleSubmit = async () => {
    const payload = toPayload(form)
    setSubmitting(true)
    try {
      if (isEditing) {
        const parsed = gimnasioEditSchema.safeParse(payload)
        if (!parsed.success) {
          toast.error("Revisa los datos", { description: parsed.error.issues[0]?.message })
          return
        }
        const result = await editarGimnasio(editingId!, parsed.data)
        if (result.ok) { toast.success("Gimnasio actualizado"); cancelEdit(); return }
        toast.error("No se pudo actualizar el gimnasio", { description: result.message })
      } else {
        const parsed = gimnasioCreateSchema.safeParse(payload)
        if (!parsed.success) {
          toast.error("Revisa los datos", { description: parsed.error.issues[0]?.message })
          return
        }
        const result = await crearGimnasio({
          ...parsed.data,
          nombre_cadena: parsed.data.nombre_cadena ?? null,
          comuna: parsed.data.comuna ?? null,
        })
        if (result.ok) { toast.success("Gimnasio creado"); setForm(emptyForm); return }
        toast.error("No se pudo crear el gimnasio", { description: result.message })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (idGimnasio: number) => {
    setSubmitting(true)
    const result = await eliminarGimnasio(idGimnasio)
    setSubmitting(false)
    if (result.ok) { toast.success("Gimnasio eliminado"); return }
    toast.error("No se pudo eliminar el gimnasio", { description: result.message })
  }

  const f = form
  const set = (patch: Partial<FormState>) => setForm((p) => ({ ...p, ...patch }))

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
      <FormPanel eyebrow={isEditing ? "Editando gimnasio" : "Nuevo gimnasio"}>
        <div className="space-y-4 sm:space-y-5">
          <FieldGroup label="Nombre">
            <EditorialInput placeholder="Ej: Smart Fit Oeste" value={f.nombre_gimnasio} onChange={(e) => set({ nombre_gimnasio: e.target.value })} />
          </FieldGroup>
          <FieldGroup label="Cadena o marca" hint="Opcional">
            <EditorialInput placeholder="Ej: Smart Fit" value={f.nombre_cadena} onChange={(e) => set({ nombre_cadena: e.target.value })} />
          </FieldGroup>
          <FieldGroup label="Direccion">
            <EditorialInput placeholder="Av. Ejemplo 123" value={f.direccion} onChange={(e) => set({ direccion: e.target.value })} />
          </FieldGroup>
          <FieldGroup label="Comuna" hint="Opcional">
            <EditorialInput placeholder="Nunoa" value={f.comuna} onChange={(e) => set({ comuna: e.target.value })} />
          </FieldGroup>
          <FieldGroup label="Coordenadas">
            <div className="grid grid-cols-2 gap-2">
              <EditorialInput inputMode="decimal" placeholder="Latitud" value={f.latitud} onChange={(e) => set({ latitud: e.target.value })} />
              <EditorialInput inputMode="decimal" placeholder="Longitud" value={f.longitud} onChange={(e) => set({ longitud: e.target.value })} />
            </div>
          </FieldGroup>
          <FormSubmitBar>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto">
                {submitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear gimnasio"}
              </Button>
              {isEditing ? (
                <Button variant="ghost" onClick={cancelEdit}>Cancelar</Button>
              ) : null}
            </div>
          </FormSubmitBar>
        </div>
      </FormPanel>

      <FormPanel eyebrow="Catalogo">
        <div className="space-y-4">
          <EditorialInput
            placeholder="Buscar por nombre o comuna..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : gimnasios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin resultados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gimnasio</TableHead>
                  <TableHead>Ubicacion</TableHead>
                  <TableHead className="w-20 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {gimnasios.map((g) => (
                  <TableRow key={g.id_gimnasio}>
                    <TableCell>
                      <span className="font-medium">{g.nombre_gimnasio}</span>
                      {g.nombre_cadena ? (
                        <span className="ml-1.5 text-xs text-muted-foreground">{g.nombre_cadena}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[g.comuna, g.direccion].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon" variant="ghost"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          onClick={() => { setEditingId(g.id_gimnasio); setForm(toFormState(g)) }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(g.id_gimnasio)}
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
