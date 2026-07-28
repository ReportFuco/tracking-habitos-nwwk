"use client"

import { FormEvent, useEffect, useState } from "react"
import { toast } from "sonner"
import { FieldGroup, FormNote, FormPanel } from "@/components/forms/editorial-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usuarioPerfilPatchSchema } from "@/modules/usuario/schemas/usuario.schema"
import type { Usuario, UsuarioPerfilPatch } from "@/modules/usuario/types/usuario"

interface PerfilEditFormProps {
  perfil: Usuario
  submitting: boolean
  onSubmit: (payload: UsuarioPerfilPatch) => Promise<{ ok: boolean; message?: string }>
}

type FormState = {
  username: string
  nombre: string
  apellido: string
  telefono: string
  email: string
}

const toFormState = (perfil: Usuario): FormState => ({
  username: perfil.username ?? "",
  nombre: perfil.nombre ?? "",
  apellido: perfil.apellido ?? "",
  telefono: perfil.telefono ?? "",
  email: perfil.email ?? "",
})

const diffPayload = (current: FormState, original: FormState): UsuarioPerfilPatch => {
  const payload: UsuarioPerfilPatch = {}
  if (current.username !== original.username) payload.username = current.username
  if (current.nombre !== original.nombre) payload.nombre = current.nombre
  if (current.apellido !== original.apellido) payload.apellido = current.apellido
  if (current.telefono !== original.telefono) payload.telefono = current.telefono
  if (current.email !== original.email) payload.email = current.email
  return payload
}

export function PerfilEditForm({ perfil, submitting, onSubmit }: PerfilEditFormProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(perfil))

  useEffect(() => {
    setForm(toFormState(perfil))
  }, [perfil])

  const original = toFormState(perfil)
  const payload = diffPayload(form, original)
  const hasChanges = Object.keys(payload).length > 0

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!hasChanges) {
      toast.info("No hay cambios para guardar")
      return
    }

    const parsed = usuarioPerfilPatchSchema.safeParse(payload)
    if (!parsed.success) {
      toast.error("Revisa el formulario", {
        description: parsed.error.issues[0]?.message ?? "Algun campo no es valido.",
      })
      return
    }

    const result = await onSubmit(parsed.data)
    if (result.ok) {
      toast.success("Perfil actualizado")
    } else {
      toast.error("No pudimos actualizar el perfil", { description: result.message })
    }
  }

  const handleReset = () => setForm(original)

  return (
    <FormPanel
      eyebrow="Edicion"
      title="Datos personales"
      description="Actualiza tu informacion base. Solo se envian los campos que realmente cambian."
      aside={
        <div className="space-y-4">
          <div>
            <p className="font-label text-[0.64rem] uppercase tracking-[0.2em] text-muted-foreground">
              Metodo
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground/80">
              Este formulario funciona como una ficha editorial: corrige solo lo necesario y deja el resto intacto.
            </p>
          </div>
          <div>
            <p className="font-label text-[0.64rem] uppercase tracking-[0.2em] text-muted-foreground">
              Consejo
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground/80">
              Mantener email y telefono al dia ayuda a recuperar acceso y ordenar futuras notificaciones.
            </p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          <FieldGroup label="Username" hint="Visible en tu perfil">
            <Input
              id="perfil-username"
              value={form.username}
              maxLength={20}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, username: event.target.value }))
              }
              className="h-13 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
            />
          </FieldGroup>

          <FieldGroup label="Email" hint="Canal principal">
            <Input
              id="perfil-email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
              className="h-13 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
            />
          </FieldGroup>

          <FieldGroup label="Nombre">
            <Input
              id="perfil-nombre"
              value={form.nombre}
              maxLength={20}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, nombre: event.target.value }))
              }
              className="h-13 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
            />
          </FieldGroup>

          <FieldGroup label="Apellido">
            <Input
              id="perfil-apellido"
              value={form.apellido}
              maxLength={20}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, apellido: event.target.value }))
              }
              className="h-13 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
            />
          </FieldGroup>
        </div>

        <FieldGroup label="Telefono" hint="Opcional">
          <Input
            id="perfil-telefono"
            value={form.telefono}
            maxLength={11}
            inputMode="tel"
            onChange={(event) =>
              setForm((prev) => ({ ...prev, telefono: event.target.value }))
            }
            className="h-13 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
          />
        </FieldGroup>

        <FormNote>
          {hasChanges
            ? "Hay cambios listos para guardar. Si prefieres volver a la version anterior, puedes descartarlos antes de enviar."
            : "Todavia no hay cambios pendientes. Cuando edites un campo, esta ficha preparara solo el diferencial para la API."}
        </FormNote>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            size="lg"
            className="h-12 rounded-xl px-6 text-sm font-semibold"
            disabled={submitting || !hasChanges}
          >
            {submitting ? "Guardando..." : "Guardar cambios"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-12 rounded-xl px-4 text-sm"
            onClick={handleReset}
            disabled={submitting || !hasChanges}
          >
            Descartar
          </Button>
        </div>
      </form>
    </FormPanel>
  )
}
