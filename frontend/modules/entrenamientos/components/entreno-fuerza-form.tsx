"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Flame } from "lucide-react"
import { toast } from "sonner"
import { SearchableCombobox } from "@/components/forms/searchable-combobox"
import { Button } from "@/components/ui/button"
import { FieldGroup, FormNote, FormPanel, FormSubmitBar } from "@/components/forms/editorial-form"
import { entrenoFuerzaCreateSchema } from "@/modules/entrenamientos/schemas/entrenamientos.schema"
import { useEntrenamientos } from "@/modules/entrenamientos/hooks/useEntrenamientos"
import { TrainingNotificationSettings } from "@/components/pwa/training-notification-settings"
import { randomUUID } from "@/lib/uuid"

const initialForm = {
  id_gimnasio: "",
  observacion: "",
}

const textareaClassName =
  "min-h-20 w-full rounded-lg border-0 bg-[color:var(--surface-variant)] px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-b-2 focus:border-[color:var(--module-entrenamientos)] sm:min-h-32"

const steps = [
  {
    index: "01",
    title: "Elige el gimnasio",
    description: "Selecciona el lugar donde vas a entrenar hoy.",
  },
  {
    index: "02",
    title: "Abre la sesion",
    description: "El entrenamiento queda activo y listo para empezar.",
  },
  {
    index: "03",
    title: "Registra tus series",
    description: "Continua en entrenamiento activo mientras avanzas.",
  },
]

export function EntrenoFuerzaFormCard() {
  const { gimnasios, entrenamientoActivo, submitting, iniciarEntrenoFuerza } = useEntrenamientos()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialGymId = searchParams.get("id_gimnasio") ?? ""
  const [form, setForm] = useState(() => ({
    ...initialForm,
    id_gimnasio: initialGymId,
  }))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const parsed = entrenoFuerzaCreateSchema.safeParse({
      id_gimnasio: Number(form.id_gimnasio),
      observacion: form.observacion || null,
    })

    if (!parsed.success) {
      toast.error("Revisa el formulario", {
        description: parsed.error.issues[0]?.message ?? "Selecciona un gimnasio valido.",
      })
      return
    }

    const result = await iniciarEntrenoFuerza({
      ...parsed.data,
      client_request_id: randomUUID(),
    })

    if (result.ok) {
      setForm(initialForm)
      toast.success(result.queued ? "Entrenamiento guardado sin conexion" : "Entrenamiento activo", {
        description: result.queued
          ? "Ya podes registrar series; se sincronizara solo al recuperar internet."
          : "La sesion ya quedo abierta para registrar series.",
      })
      router.push("/app/entrenamientos/activo")
      return
    }

    toast.error("No pudimos abrir el entrenamiento", {
      description: result.message,
    })
  }

  const availableGimnasios = gimnasios.filter((gimnasio) => gimnasio.activo)
  const gimnasioOptions = availableGimnasios.map((gimnasio) => ({
    value: String(gimnasio.id_gimnasio),
    label: gimnasio.nombre_gimnasio,
    description: gimnasio.comuna || undefined,
  }))

  return (
    <section className="grid gap-4 sm:gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <FormPanel accent="tertiary">
        <div className="space-y-5 sm:space-y-6">
          {entrenamientoActivo ? (
            <div className="rounded-xl bg-[color:var(--surface-low)] p-4 sm:rounded-2xl sm:p-5">
              <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-[0.72rem] sm:tracking-[0.24em]">
                Sesion activa
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground sm:mt-3 sm:text-2xl">
                Ya tienes un entrenamiento en curso.
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground sm:mt-3">
                Tu sesion actual ya esta asociada a {entrenamientoActivo.nombre_gimnasio ?? "un gimnasio"}.
                Desde aqui te llevamos al espacio donde se registran las series.
              </p>
              <Button
                asChild
                className="mt-4 bg-[color:var(--module-entrenamientos)] text-[color:var(--module-entrenamientos-foreground)] hover:bg-[color:var(--module-entrenamientos)]/90 sm:mt-5"
              >
                <Link href="/app/entrenamientos/activo">
                  Ir a entrenamiento activo
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <FieldGroup
                label="Gimnasio"
                hint={availableGimnasios.length ? "Contexto de la sesion" : "Sin opciones activas"}
              >
                <SearchableCombobox
                  value={form.id_gimnasio}
                  onChange={(value) => setForm((prev) => ({ ...prev, id_gimnasio: value }))}
                  options={gimnasioOptions}
                  disabled={submitting || availableGimnasios.length === 0}
                  disabledMessage="Sin gimnasios activos"
                  placeholder="Selecciona un gimnasio"
                  searchPlaceholder="Buscar gimnasio..."
                  emptyMessage="No hay gimnasios disponibles"
                />
              </FieldGroup>

              <FieldGroup label="Observacion" hint="Opcional">
                <textarea
                  className={textareaClassName}
                  placeholder="Ej: enfasis en torso, energia media, tecnica limpia..."
                  value={form.observacion}
                  onChange={(event) => setForm((prev) => ({ ...prev, observacion: event.target.value }))}
                />
              </FieldGroup>

              <FormSubmitBar>
                <Button
                  type="submit"
                  disabled={submitting || availableGimnasios.length === 0}
                  className="w-full bg-[color:var(--module-entrenamientos)] text-[color:var(--module-entrenamientos-foreground)] hover:bg-[color:var(--module-entrenamientos)]/90 sm:w-auto"
                >
                  {submitting ? "Abriendo sesion..." : "Registrar entrenamiento"}
                </Button>
              </FormSubmitBar>
            </form>
          )}

          {availableGimnasios.length === 0 ? (
            <FormNote>
              Aun no hay gimnasios disponibles para elegir. Cuando aparezcan, podras volver y abrir tu siguiente sesion.
            </FormNote>
          ) : null}
        </div>
      </FormPanel>

      <section className="space-y-4">
        <TrainingNotificationSettings />

        <article className="hidden rounded-3xl bg-[color:var(--surface-lowest)] p-6 shadow-[var(--shadow-airy)] xl:block">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Flame className="size-4 text-[color:var(--module-entrenamientos)]" />
            Paso a paso
          </p>
          <div className="mt-4 space-y-3">
            {steps.map((step) => (
              <div key={step.index} className="rounded-xl bg-[color:var(--surface-low)] p-4">
                <p className="font-label text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
                  {step.index[0] === "0" ? `${Number(step.index)}. ${step.title}` : step.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </article>

      </section>
    </section>
  )
}
