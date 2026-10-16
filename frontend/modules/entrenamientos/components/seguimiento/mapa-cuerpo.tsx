"use client"

import { useId, type CSSProperties, type KeyboardEvent } from "react"
import { cn } from "@/lib/utils"
import type { NivelCarga, ZonaCarga } from "@/modules/entrenamientos/schemas/seguimiento.schema"

/**
 * Cuerpo de frente y de espalda, en bloques como el resto de la marca: cada zona muscular
 * es una forma solida pintada con la rampa de carga (--carga-1..4). "Alto" ademas lleva
 * rayado, para que la sobrecarga no dependa solo del color.
 *
 * Coordenadas en un lienzo de 120 x 206 por figura, con el eje en x = 60. Las formas del
 * lado izquierdo se espejan para el derecho.
 */

type Rect = { r: [x: number, y: number, w: number, h: number, rx: number] }
type Poly = { p: number[] }
type Forma = Rect | Poly
type Pieza = { zona: string | null; formas: Forma[]; espejo?: boolean }

const ANCHO = 120

const espejar = (forma: Forma): Forma => {
  if ("r" in forma) {
    const [x, y, w, h, rx] = forma.r
    return { r: [ANCHO - x - w, y, w, h, rx] }
  }
  return { p: forma.p.map((valor, indice) => (indice % 2 === 0 ? ANCHO - valor : valor)) }
}

// Partes sin zona (cabeza aparte): se pintan neutras para que la silueta se lea completa.
const NEUTRAS_FRENTE: Pieza[] = [
  { zona: null, formas: [{ r: [27, 102.5, 10, 11, 4] }], espejo: true },
  { zona: null, formas: [{ r: [45, 95, 30, 9, 3] }] },
  { zona: null, formas: [{ r: [45.5, 150, 10, 7, 3] }], espejo: true },
  { zona: null, formas: [{ r: [44, 194, 12, 6, 2.5] }], espejo: true },
]

const FRENTE: Pieza[] = [
  ...NEUTRAS_FRENTE,
  { zona: "cuello", formas: [{ r: [54, 29, 12, 8, 2] }] },
  { zona: "trapecio", formas: [{ p: [55, 31.5, 44, 38.5, 55, 38.5] }], espejo: true },
  { zona: "hombro", formas: [{ r: [31, 38, 13, 15, 6] }], espejo: true },
  { zona: "pecho", formas: [{ r: [45.5, 39.5, 14, 17, 3] }], espejo: true },
  { zona: "serrato", formas: [{ r: [44.5, 58, 5, 9, 2] }], espejo: true },
  { zona: "abdomen", formas: [{ r: [51, 58.5, 18, 35, 3] }] },
  { zona: "abdomen", formas: [{ r: [44.5, 69, 5, 21, 2] }], espejo: true },
  { zona: "bicep", formas: [{ r: [30.5, 55, 11.5, 19, 5.5] }], espejo: true },
  { zona: "antebrazo", formas: [{ r: [28, 76.5, 11, 24, 5] }], espejo: true },
  { zona: "abductor", formas: [{ r: [38.5, 98, 5.5, 20, 2.5] }], espejo: true },
  { zona: "cuadricep", formas: [{ r: [44.5, 105, 11.5, 43, 5.5] }], espejo: true },
  { zona: "aductor", formas: [{ r: [56.8, 106, 3, 27, 1.5] }], espejo: true },
  { zona: "pantorrilla", formas: [{ r: [45.5, 159, 10, 33, 4.5] }], espejo: true },
]

const ESPALDA: Pieza[] = [
  { zona: null, formas: [{ r: [27, 102.5, 10, 11, 4] }], espejo: true },
  { zona: null, formas: [{ r: [45.5, 150, 10, 7, 3] }], espejo: true },
  { zona: null, formas: [{ r: [44, 192, 12, 7, 2.5] }], espejo: true },
  { zona: "cuello", formas: [{ r: [54, 29, 12, 6, 2] }] },
  { zona: "trapecio", formas: [{ p: [60, 31, 77, 40, 66, 46, 60, 64, 54, 46, 43, 40] }] },
  { zona: "hombro", formas: [{ r: [31, 38, 13, 15, 6] }], espejo: true },
  { zona: "dorsal", formas: [{ p: [44.5, 45, 53, 47.5, 58.5, 65.5, 57, 82, 47, 78, 44, 58] }], espejo: true },
  { zona: "lumbar", formas: [{ r: [53, 85, 14, 10, 3] }] },
  { zona: "tricep", formas: [{ r: [30.5, 55, 11.5, 19, 5.5] }], espejo: true },
  { zona: "antebrazo", formas: [{ r: [28, 76.5, 11, 24, 5] }], espejo: true },
  { zona: "abductor", formas: [{ r: [38.5, 94, 6, 14, 2.5] }], espejo: true },
  { zona: "gluteo", formas: [{ r: [45, 96, 14.5, 18, 6] }], espejo: true },
  { zona: "femoral", formas: [{ r: [45, 116, 13, 32, 5.5] }], espejo: true },
  { zona: "pantorrilla", formas: [{ r: [45, 159, 11, 30, 5.5] }], espejo: true },
]

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

function FormaSvg({ forma, style }: { forma: Forma; style: CSSProperties }) {
  if ("r" in forma) {
    const [x, y, width, height, rx] = forma.r
    return <rect x={x} y={y} width={width} height={height} rx={rx} style={style} />
  }
  return <polygon points={forma.p.join(" ")} style={style} />
}

function Figura({
  titulo,
  piezas,
  zonas,
  seleccionada,
  onSeleccionar,
  patron,
}: {
  titulo: string
  piezas: Pieza[]
  zonas: Map<string, ZonaCarga>
  seleccionada: string | null
  onSeleccionar: (codigo: string) => void
  patron: string
}) {
  // Agrupa las formas por zona: una zona es un solo boton aunque tenga lado izquierdo,
  // derecho y partes sueltas (el abdomen y los oblicuos).
  const porZona = new Map<string, Forma[]>()
  const neutras: Forma[] = []
  for (const pieza of piezas) {
    const formas = pieza.espejo ? [...pieza.formas, ...pieza.formas.map(espejar)] : pieza.formas
    if (pieza.zona === null) {
      neutras.push(...formas)
    } else {
      porZona.set(pieza.zona, [...(porZona.get(pieza.zona) ?? []), ...formas])
    }
  }

  return (
    <figure className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <svg viewBox="0 0 120 206" className="h-auto w-full max-w-[13rem]" role="group" aria-label={titulo}>
        <circle cx={60} cy={17} r={11} style={{ fill: SILUETA }} />
        {neutras.map((forma, indice) => (
          <FormaSvg key={indice} forma={forma} style={{ fill: SILUETA }} />
        ))}
        {Array.from(porZona.entries()).map(([codigo, formas]) => {
          const zona = zonas.get(codigo)
          const nivel = zona?.nivel ?? "sin_trabajo"
          const activa = seleccionada === codigo
          const etiqueta = zona
            ? `${zona.nombre}: ${formatearSeries(zona.series)} series, ${ETIQUETA_NIVEL[nivel].toLowerCase()}`
            : codigo
          const estilo: CSSProperties = {
            fill: nivel === "alto" ? `url(#${patron})` : RELLENO_NIVEL[nivel],
            stroke: activa ? "var(--foreground)" : "none",
            strokeWidth: activa ? 1.4 : 0,
          }
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
              {formas.map((forma, indice) => (
                <FormaSvg key={indice} forma={forma} style={estilo} />
              ))}
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
          <pattern id={patron} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)">
            <rect width="4" height="4" style={{ fill: "var(--carga-4)" }} />
            <rect width="1.3" height="4" style={{ fill: "var(--surface-lowest)" }} />
          </pattern>
        </defs>
      </svg>
      <div className="flex items-start justify-center gap-3 sm:gap-6">
        <Figura
          titulo="Frente"
          piezas={FRENTE}
          zonas={porCodigo}
          seleccionada={seleccionada}
          onSeleccionar={onSeleccionar}
          patron={patron}
        />
        <Figura
          titulo="Espalda"
          piezas={ESPALDA}
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
