"use client"

import { ChevronRight } from "lucide-react"
import { EjercicioMedia } from "@/modules/entrenamientos/components/ejercicio-media"
import type { EjercicioResponse } from "@/modules/entrenamientos/types/entrenamientos"

export const describirGrupo = (ejercicio: EjercicioResponse) => {
  const musculo = ejercicio.musculo_nombre ?? ejercicio.tipo ?? "Sin musculo"
  const subcategoria = ejercicio.subcategoria_nombre

  if (!subcategoria || subcategoria.toLowerCase() === "general") {
    return musculo
  }

  return `${musculo} · ${subcategoria}`
}

/**
 * Fila del catalogo.
 *
 * Es un unico boton en vez de una fila con acciones sueltas: en el telefono un icono de
 * 32px es imposible de acertar, asi que editar y borrar viven dentro del detalle y aqui
 * toda la tarjeta -- 80px de alto -- es el area tactil.
 */
export function EjercicioCard({
  ejercicio,
  onSelect,
  priority = false,
}: {
  ejercicio: EjercicioResponse
  onSelect: (ejercicio: EjercicioResponse) => void
  priority?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(ejercicio)}
      className="group flex min-h-20 w-full touch-manipulation items-center gap-3 rounded-[1.25rem] bg-surface-lowest p-3 text-left shadow-(--shadow-airy) transition duration-200 hover:shadow-(--shadow-airy-lg) focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none active:scale-[0.99] sm:gap-4 sm:p-3.5"
    >
      <EjercicioMedia src={ejercicio.url_imagen} alt="" size={64} priority={priority} />

      <div className="min-w-0 flex-1 space-y-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground sm:text-[0.95rem]">
          {ejercicio.nombre}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            title={describirGrupo(ejercicio)}
          >
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: "var(--module-entrenamientos)" }}
            />
            {describirGrupo(ejercicio)}
          </span>
          {ejercicio.equipamiento ? (
            <span className="rounded-full bg-surface-low px-2 py-0.5 text-[0.7rem] text-muted-foreground">
              {ejercicio.equipamiento}
            </span>
          ) : null}
        </div>
      </div>

      <ChevronRight
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground"
      />
    </button>
  )
}
