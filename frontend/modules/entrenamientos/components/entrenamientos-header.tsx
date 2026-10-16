"use client"

import { Dumbbell } from "lucide-react"
import { ModuleHeader } from "@/components/shell/module-header"
import { useEntrenamientos } from "@/modules/entrenamientos/hooks/useEntrenamientos"

interface EntrenamientosHeaderProps {
  title: string
  description?: string
  /** Oculta el boton de registrar, por ejemplo ya estando en el formulario. */
  sinAccion?: boolean
}

/**
 * Encabezado de las secciones de entrenamientos. El boton cambia segun haya sesion
 * abierta: "Entrenar" abre una nueva y "En curso" vuelve a la activa.
 */
export function EntrenamientosHeader({ title, description, sinAccion = false }: EntrenamientosHeaderProps) {
  const { entrenamientoActivo } = useEntrenamientos()

  return (
    <ModuleHeader
      back={{ href: "/app/entrenamientos", label: "Entrenamientos" }}
      title={title}
      description={description}
      action={
        sinAccion
          ? null
          : entrenamientoActivo
            ? { href: "/app/entrenamientos/activo", label: "En curso", live: true }
            : { href: "/app/entrenamientos/registrar", label: "Entrenar", icon: Dumbbell }
      }
    />
  )
}
