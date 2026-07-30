"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { EditorialInput, FieldGroup } from "@/components/forms/editorial-form"
import { SearchableCombobox } from "@/components/forms/searchable-combobox"
import type { EjercicioResponse, Musculo } from "@/modules/entrenamientos/types/entrenamientos"

export type EjercicioFormState = {
  nombre: string
  id_musculo: string
  id_subcategoria_musculo: string
  url_video: string
}

const vacio: EjercicioFormState = {
  nombre: "",
  id_musculo: "",
  id_subcategoria_musculo: "",
  url_video: "",
}

const desdeEjercicio = (ejercicio: EjercicioResponse): EjercicioFormState => ({
  nombre: ejercicio.nombre,
  id_musculo: ejercicio.id_musculo ? String(ejercicio.id_musculo) : "",
  id_subcategoria_musculo: ejercicio.id_subcategoria_musculo
    ? String(ejercicio.id_subcategoria_musculo)
    : "",
  url_video: ejercicio.url_video ?? "",
})

/**
 * Alta y edicion del catalogo.
 *
 * Antes era un panel fijo al lado de la lista, que en el telefono obligaba a recorrer el
 * formulario entero para llegar a los ejercicios. Ahora se abre bajo demanda y deja la
 * pantalla completa para el catalogo, que es lo que se consulta a diario.
 */
export function EjercicioFormDialog({
  ejercicio,
  musculos,
  guardando,
  onGuardar,
  onCerrar,
}: {
  ejercicio: EjercicioResponse | null
  musculos: Musculo[]
  guardando: boolean
  onGuardar: (valores: EjercicioFormState) => void
  onCerrar: () => void
}) {
  // Se monta al abrir y se desmonta al cerrar, asi que el formulario parte del ejercicio
  // que toca sin necesidad de sincronizarlo despues.
  const [form, setForm] = useState<EjercicioFormState>(() =>
    ejercicio ? desdeEjercicio(ejercicio) : vacio,
  )
  const editando = ejercicio !== null

  const musculoOptions = musculos
    .filter((musculo) => musculo.activo)
    .map((musculo) => ({ value: String(musculo.id_musculo), label: musculo.nombre }))

  const subcategoriaOptions =
    musculos
      .find((musculo) => String(musculo.id_musculo) === form.id_musculo)
      ?.subcategorias.filter((subcategoria) => subcategoria.activo)
      .map((subcategoria) => ({
        value: String(subcategoria.id_subcategoria_musculo),
        label: subcategoria.nombre,
      })) ?? []

  return (
    <Dialog open onOpenChange={(valor) => (valor ? null : onCerrar())}>
      <DialogContent className="top-auto bottom-0 left-0 max-h-[92dvh] max-w-full translate-x-0 translate-y-0 overflow-y-auto rounded-t-[1.75rem] rounded-b-none border-0 bg-surface-lowest p-0 shadow-(--shadow-airy-lg) sm:top-[50%] sm:left-[50%] sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[1.75rem]">
        <div className="space-y-5 px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:px-7 sm:pb-7">
          <div className="space-y-1.5">
            <DialogTitle className="text-lg font-semibold tracking-[-0.01em] sm:text-xl">
              {editando ? "Editar ejercicio" : "Nuevo ejercicio"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {editando
                ? "Los cambios se aplican solo a este ejercicio del catalogo."
                : "Se agrega al catalogo y queda disponible al registrar series."}
            </DialogDescription>
          </div>

          <FieldGroup label="Nombre">
            <EditorialInput
              autoFocus={!editando}
              placeholder="Ej: Press banca plano"
              value={form.nombre}
              onChange={(evento) =>
                setForm((previo) => ({ ...previo, nombre: evento.target.value }))
              }
            />
          </FieldGroup>

          <FieldGroup label="Musculo">
            <SearchableCombobox
              value={form.id_musculo}
              onChange={(valor) =>
                setForm((previo) => ({
                  ...previo,
                  id_musculo: valor,
                  id_subcategoria_musculo: "",
                }))
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
              onChange={(valor) =>
                setForm((previo) => ({ ...previo, id_subcategoria_musculo: valor }))
              }
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
              inputMode="url"
              placeholder="https://youtube.com/..."
              value={form.url_video}
              onChange={(evento) =>
                setForm((previo) => ({ ...previo, url_video: evento.target.value }))
              }
            />
          </FieldGroup>

          <div className="flex gap-2 pt-1">
            <Button
              className="min-h-12 flex-1"
              disabled={guardando}
              onClick={() => onGuardar(form)}
            >
              {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Crear ejercicio"}
            </Button>
            <Button variant="ghost" className="min-h-12" onClick={onCerrar}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
