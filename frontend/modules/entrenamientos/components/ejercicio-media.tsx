"use client"

import Image from "next/image"
import { Dumbbell } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Imagen de un ejercicio del catalogo.
 *
 * Las imagenes ya vienen en WebP a 180x180 -- la unica resolucion que permite la licencia
 * del material -- asi que se sirven sin pasar por el optimizador: reprocesarlas solo
 * agregaria latencia sin ahorrar bytes.
 *
 * El contenedor reserva el espacio antes de que la imagen cargue para que la lista no
 * salte mientras aparecen las miniaturas.
 */
export function EjercicioMedia({
  src,
  alt,
  size,
  className,
  priority = false,
}: {
  src: string | null
  alt: string
  size: number
  className?: string
  priority?: boolean
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-[0.9rem] bg-surface-low",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={180}
          height={180}
          unoptimized
          loading={priority ? "eager" : "lazy"}
          priority={priority}
          className="size-full object-cover"
        />
      ) : (
        // Los ejercicios creados a mano no tienen imagen: el hueco se llena con el icono
        // del modulo en vez de dejar un cuadro vacio que parece un error de carga.
        <div className="flex size-full items-center justify-center text-muted-foreground/50">
          <Dumbbell className="size-1/3" aria-hidden />
        </div>
      )}
    </div>
  )
}
