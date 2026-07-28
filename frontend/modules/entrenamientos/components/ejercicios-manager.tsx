"use client"

import { AxiosError } from "axios"
import { Pencil, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EditorialInput, FieldGroup, FormPanel, FormSubmitBar } from "@/components/forms/editorial-form"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SearchableCombobox } from "@/components/forms/searchable-combobox"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { EntrenamientosAPI } from "@/modules/entrenamientos/api/entrenamientos.api"
import { ejercicioCreateSchema, ejercicioEditSchema } from "@/modules/entrenamientos/schemas/entrenamientos.schema"
import type { EjercicioResponse, Musculo } from "@/modules/entrenamientos/types/entrenamientos"

type FormState = { nombre: string; id_musculo: string; id_subcategoria_musculo: string; url_video: string }
const emptyForm: FormState = { nombre: "", id_musculo: "", id_subcategoria_musculo: "", url_video: "" }

const toFormState = (e: EjercicioResponse): FormState => ({
  nombre: e.nombre,
  id_musculo: e.id_musculo ? String(e.id_musculo) : "",
  id_subcategoria_musculo: e.id_subcategoria_musculo ? String(e.id_subcategoria_musculo) : "",
  url_video: e.url_video ?? "",
})

const formatEjercicioGrupo = (ejercicio: EjercicioResponse) => {
  const musculo = ejercicio.musculo_nombre ?? ejercicio.tipo ?? "Sin musculo"
  const subcategoria = ejercicio.subcategoria_nombre

  if (!subcategoria || subcategoria.toLowerCase() === "general") {
    return musculo
  }

  return `${musculo} / ${subcategoria}`
}

export function EjerciciosManager() {
  const [ejercicios, setEjercicios] = useState<EjercicioResponse[]>([])
  const [musculos, setMusculos] = useState<Musculo[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState("")
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const isEditing = editingId !== null

  useEffect(() => {
    void EntrenamientosAPI.getMusculos().then(setMusculos).catch(() => null)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void EntrenamientosAPI.getEjercicios(search.trim() ? { q: search.trim() } : undefined)
        .then(setEjercicios)
        .catch(() => toast.error("Error al cargar ejercicios"))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  const musculoOptions = useMemo(
    () => musculos.filter((musculo) => musculo.activo).map((musculo) => ({
      value: String(musculo.id_musculo),
      label: musculo.nombre,
    })),
    [musculos],
  )

  const subcategoriaOptions = useMemo(
    () =>
      musculos
        .find((musculo) => String(musculo.id_musculo) === form.id_musculo)
        ?.subcategorias.filter((subcategoria) => subcategoria.activo)
        .map((subcategoria) => ({
          value: String(subcategoria.id_subcategoria_musculo),
          label: subcategoria.nombre,
        })) ?? [],
    [form.id_musculo, musculos],
  )

  const cancelEdit = () => { setEditingId(null); setForm(emptyForm) }

  const handleSubmit = async () => {
    const basePayload = {
      nombre: form.nombre.trim(),
      id_subcategoria_musculo: Number(form.id_subcategoria_musculo),
      url_video: form.url_video.trim() || "",
    }

    const parsed = isEditing
      ? ejercicioEditSchema.safeParse({
          ...basePayload,
          url_video: basePayload.url_video || null,
        })
      : ejercicioCreateSchema.safeParse(basePayload)

    if (!parsed.success) {
      toast.error("Revisa los datos", { description: parsed.error.issues[0]?.message })
      return
    }

    setSubmitting(true)
    try {
      if (isEditing) {
        const updated = await EntrenamientosAPI.updateEjercicio(editingId!, {
          nombre: parsed.data.nombre?.trim() || null,
          id_subcategoria_musculo: parsed.data.id_subcategoria_musculo ?? null,
          url_video: parsed.data.url_video ? parsed.data.url_video.trim() : null,
        })
        setEjercicios((prev) => prev.map((e) => (e.id_ejercicio === editingId ? updated : e)))
        toast.success("Ejercicio actualizado")
        cancelEdit()
      } else {
        const nuevo = await EntrenamientosAPI.createEjercicio({
          nombre: basePayload.nombre,
          id_subcategoria_musculo: basePayload.id_subcategoria_musculo,
          ...(basePayload.url_video ? { url_video: basePayload.url_video } : {}),
        })
        setEjercicios((prev) => [...prev, nuevo])
        toast.success("Ejercicio creado")
        setForm(emptyForm)
      }
    } catch (error) {
      const description = getFriendlyErrorMessage(error)

      if (error instanceof AxiosError) {
        console.error("Error guardando ejercicio", error.response?.data)
      }

      toast.error(isEditing ? "No se pudo actualizar el ejercicio" : "No se pudo crear el ejercicio", {
        description,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (idEjercicio: number) => {
    setSubmitting(true)
    try {
      await EntrenamientosAPI.deleteEjercicio(idEjercicio)
      setEjercicios((prev) => prev.filter((e) => e.id_ejercicio !== idEjercicio))
      toast.success("Ejercicio eliminado")
    } catch {
      toast.error("No se pudo eliminar. Puede tener series asociadas.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_1.9fr]">
      <FormPanel eyebrow={isEditing ? "Editando ejercicio" : "Nuevo ejercicio"}>
        <div className="space-y-4 sm:space-y-5">
          <FieldGroup label="Nombre">
            <EditorialInput
              placeholder="Ej: Press banca plano"
              value={form.nombre}
              onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
            />
          </FieldGroup>
          <FieldGroup label="Musculo">
            <SearchableCombobox
              value={form.id_musculo}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, id_musculo: value, id_subcategoria_musculo: "" }))
              }
              options={musculoOptions}
              placeholder="Selecciona musculo"
              searchPlaceholder="Buscar..."
              allowClear={false}
            />
          </FieldGroup>
          <FieldGroup label="Subcategoria">
            <SearchableCombobox
              value={form.id_subcategoria_musculo}
              onChange={(value) => setForm((prev) => ({ ...prev, id_subcategoria_musculo: value }))}
              options={subcategoriaOptions}
              placeholder={form.id_musculo ? "Selecciona zona" : "Primero elige musculo"}
              searchPlaceholder="Buscar..."
              disabled={!form.id_musculo}
              disabledMessage="Primero elige musculo"
              allowClear={false}
            />
          </FieldGroup>
          <FieldGroup label="URL video" hint="Opcional">
            <EditorialInput
              type="url"
              placeholder="https://youtube.com/..."
              value={form.url_video}
              onChange={(e) => setForm((p) => ({ ...p, url_video: e.target.value }))}
            />
          </FieldGroup>
          <FormSubmitBar>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto">
                {submitting ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear ejercicio"}
              </Button>
              {isEditing ? (
                <Button variant="ghost" onClick={cancelEdit}>
                  Cancelar
                </Button>
              ) : null}
            </div>
          </FormSubmitBar>
        </div>
      </FormPanel>

      <FormPanel eyebrow="Catalogo">
        <div className="space-y-4">
          <EditorialInput
            placeholder="Buscar ejercicio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : ejercicios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin resultados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ejercicio</TableHead>
                  <TableHead>Musculo</TableHead>
                  <TableHead className="w-20 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ejercicios.map((ej) => (
                  <TableRow key={ej.id_ejercicio}>
                    <TableCell>
                      <span className="font-medium">{ej.nombre}</span>
                      {ej.url_video ? (
                        <a
                          href={ej.url_video}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-xs text-primary underline"
                        >
                          video
                        </a>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatEjercicioGrupo(ej)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon" variant="ghost"
                          className="size-8 text-muted-foreground hover:text-foreground"
                          onClick={() => { setEditingId(ej.id_ejercicio); setForm(toFormState(ej)) }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(ej.id_ejercicio)}
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
