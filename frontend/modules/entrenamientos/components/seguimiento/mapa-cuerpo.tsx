"use client"

import { useId, type CSSProperties, type KeyboardEvent } from "react"
import { cn } from "@/lib/utils"
import {
  CABEZA,
  ESPALDA,
  FRENTE,
  SILUETA_MEDIA,
} from "@/modules/entrenamientos/components/seguimiento/mapa-cuerpo-formas"
import type { NivelCarga, ZonaCarga } from "@/modules/entrenamientos/schemas/seguimiento.schema"

/**
 * Cuerpo de frente y de espalda con la musculatura dibujada: cada zona de carga reune los
 * musculos que la forman (el cuadriceps son sus tres haces, el abdomen sus bloques y el
 * oblicuo) y se pinta con la rampa de carga (--carga-1..4). "Alto" ademas lleva rayado,
 * para que la sobrecarga no dependa solo del color.
 *
 * Los trazos viven en mapa-cuerpo-formas.ts: solo la mitad izquierda, que aqui se espeja.
 */

// Refleja sobre el eje x = 60 del lienzo de 120 de ancho.
const ESPEJO = "matrix(-1 0 0 1 120 0)"

// Grises derivados del texto y no de las superficies: en oscuro las superficies quedan
// casi iguales al fondo y la silueta desaparecia.
const SILUETA = "color-mix(in oklch, var(--foreground) 6%, var(--surface-lowest))"

export const RELLENO_NIVEL: Record<NivelCarga, string> = {
  sin_trabajo: "color-mix(in oklch, var(--foreground) 14%, var(--surface-lowest))",
  bajo: "var(--carga-1)",
  moderado: "var(--carga-2)",
  optimo: "var(--carga-3)",
  alto: "var(--carga-4)",
}

export const ETIQUETA_NIVEL: Record<NivelCarga, string> = {
  sin_trabajo: "Sin trabajo",
  bajo: "Bajo",
  moderado: "Moderado",
  optimo: "Óptimo",
  alto: "Alto",
}

export const formatearSeries = (series: number) =>
  Number.isInteger(series) ? String(series) : series.toFixed(1).replace(".", ",")

function Figura({
  titulo,
  formas,
  zonas,
  seleccionada,
  onSeleccionar,
  patron,
}: {
  titulo: string
  formas: Record<string, string[]>
  zonas: Map<string, ZonaCarga>
  seleccionada: string | null
  onSeleccionar: (codigo: string) => void
  patron: string
}) {
  return (
    <figure className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <svg viewBox="0 0 120 206" className="h-auto w-full max-w-[13rem]" role="group" aria-label={titulo}>
        <path d={CABEZA} style={{ fill: SILUETA }} />
        <path d={SILUETA_MEDIA} style={{ fill: SILUETA }} />
        <path d={SILUETA_MEDIA} transform={ESPEJO} style={{ fill: SILUETA }} />
        {Object.entries(formas).map(([codigo, trazos]) => {
          const zona = zonas.get(codigo)
          const nivel = zona?.nivel ?? "sin_trabajo"
          const activa = seleccionada === codigo
          const etiqueta = zona
            ? `${zona.nombre}: ${formatearSeries(zona.series)} series, ${ETIQUETA_NIVEL[nivel].toLowerCase()}`
            : codigo
          const estilo = (espejado: boolean): CSSProperties => ({
            // El lado espejado usa el rayado girado al reves: el espejo lo vuelve a dejar a
            // 45 grados, y las dos mitades del cuerpo quedan con las franjas paralelas.
            fill:
              nivel === "alto"
                ? `url(#${espejado ? `${patron}-espejo` : patron})`
                : RELLENO_NIVEL[nivel],
            stroke: activa ? "var(--foreground)" : "none",
            strokeWidth: activa ? 1 : 0,
            strokeLinejoin: "round",
          })
          const seleccionar = () => onSeleccionar(codigo)
          const onKeyDown = (evento: KeyboardEvent<SVGGElement>) => {
            if (evento.key === "Enter" || evento.key === " ") {
              evento.preventDefault()
              seleccionar()
            }
          }

          return (
            <g
              key={codigo}
              role="button"
              tabIndex={0}
              aria-label={etiqueta}
              aria-pressed={activa}
              onClick={seleccionar}
              onKeyDown={onKeyDown}
              className="cursor-pointer outline-none transition-opacity hover:opacity-80 focus-visible:opacity-80 motion-reduce:transition-none"
            >
              <title>{etiqueta}</title>
              {trazos.map((d, indice) => (
                <path key={indice} d={d} style={estilo(false)} />
              ))}
              <g transform={ESPEJO}>
                {trazos.map((d, indice) => (
                  <path key={indice} d={d} style={estilo(true)} />
                ))}
              </g>
            </g>
          )
        })}
      </svg>
      <figcaption className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
        {titulo}
      </figcaption>
    </figure>
  )
}

export function MapaCuerpo({
  zonas,
  seleccionada,
  onSeleccionar,
  className,
}: {
  zonas: ZonaCarga[]
  seleccionada: string | null
  onSeleccionar: (codigo: string) => void
  className?: string
}) {
  const patron = `carga-alto-${useId().replace(/:/g, "")}`
  const porCodigo = new Map(zonas.map((zona) => [zona.codigo, zona]))

  return (
    <div className={cn("relative", className)}>
      {/* Rayado de "alto": el tono mas oscuro de la rampa con franjas del color de la
          superficie, a 45 grados. */}
      <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
        <defs>
          {[
            { id: patron, giro: 45 },
            { id: `${patron}-espejo`, giro: -45 },
          ].map(({ id, giro }) => (
            <pattern
              key={id}
              id={id}
              patternUnits="userSpaceOnUse"
              width="3"
              height="3"
              patternTransform={`rotate(${giro})`}
            >
              <rect width="3" height="3" style={{ fill: "var(--carga-4)" }} />
              <rect width="1" height="3" style={{ fill: "var(--surface-lowest)" }} />
            </pattern>
          ))}
        </defs>
      </svg>
      <div className="flex items-start justify-center gap-3 sm:gap-6">
        <Figura
          titulo="Frente"
          formas={FRENTE}
          zonas={porCodigo}
          seleccionada={seleccionada}
          onSeleccionar={onSeleccionar}
          patron={patron}
        />
        <Figura
          titulo="Espalda"
          formas={ESPALDA}
          zonas={porCodigo}
          seleccionada={seleccionada}
          onSeleccionar={onSeleccionar}
          patron={patron}
        />
      </div>
    </div>
  )
}

export function MuestraNivel({ nivel, className }: { nivel: NivelCarga; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-3 shrink-0 rounded-sm", className)}
      style={
        nivel === "alto"
          ? {
              background:
                "repeating-linear-gradient(45deg, var(--carga-4) 0 2.5px, var(--surface-lowest) 2.5px 3.6px)",
            }
          : { background: RELLENO_NIVEL[nivel] }
      }
    />
  )
}
