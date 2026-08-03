"use client"

import { useState } from "react"
import Image from "next/image"
import { Dumbbell, Pause, Play } from "lucide-react"
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

/**
 * Demostracion animada de un ejercicio.
 *
 * La animacion arranca sola aunque el sistema pida reducir movimiento: aca no es
 * decorativa, es la demostracion de como se ejecuta el ejercicio, o sea el contenido.
 * Lo que si exige la accesibilidad es poder detenerla, y de eso se encarga el boton de
 * pausa: un WebP animado no se puede pausar por CSS, asi que pausar es volver a la
 * miniatura fija.
 *
 * El tamano lo decide quien la usa via `className`, porque el mismo material se muestra a
 * 180px en una ficha y mas chico junto a un formulario.
 */
export function EjercicioAnimacion({
  imagen,
  animacion,
  alt,
  className,
  priority = false,
}: {
  imagen: string | null
  animacion: string | null
  alt: string
  className?: string
  priority?: boolean
}) {
  const [animando, setAnimando] = useState(true)

  const mostrandoAnimacion = animando && Boolean(animacion)
  const fuente = mostrandoAnimacion ? animacion : imagen

  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "relative size-[11.25rem] overflow-hidden rounded-[1.25rem] bg-surface-low",
          className,
        )}
      >
        {fuente ? (
          <Image
            src={fuente}
            alt={alt}
            width={180}
            height={180}
            unoptimized
            priority={priority}
            className="size-full object-cover"
          />
        ) : (
          // Los ejercicios creados a mano no tienen material: el hueco se llena con el
          // icono del modulo en vez de dejar un cuadro vacio que parece un error de carga.
          <div className="flex size-full items-center justify-center text-muted-foreground/50">
            <Dumbbell className="size-1/3" aria-hidden />
          </div>
        )}
      </div>

      {animacion ? (
        <button
          type="button"
          onClick={() => setAnimando((previo) => !previo)}
          aria-label={
            mostrandoAnimacion
              ? "Pausar la animacion del ejercicio"
              : "Reproducir la animacion del ejercicio"
          }
          className={
            mostrandoAnimacion
              ? // Con la animacion corriendo el control se corre a una esquina para no
                // tapar la demostracion. Queda siempre visible: en el telefono no hay
                // hover que lo revele.
                "absolute right-1.5 bottom-1.5 flex size-11 touch-manipulation items-center justify-center rounded-full bg-foreground/50 text-background transition hover:bg-foreground/70 focus-visible:ring-2 focus-visible:ring-background focus-visible:outline-none motion-reduce:transition-none"
              : "absolute inset-0 flex touch-manipulation items-center justify-center rounded-[1.25rem] bg-foreground/35 text-background transition hover:bg-foreground/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-background focus-visible:outline-none motion-reduce:transition-none"
          }
        >
          {mostrandoAnimacion ? (
            <Pause className="size-4" aria-hidden />
          ) : (
            <Play className="size-7" aria-hidden />
          )}
        </button>
      ) : null}
    </div>
  )
}
