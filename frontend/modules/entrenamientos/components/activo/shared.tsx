"use client"

import { useId } from "react"
import { Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  EjercicioResponse,
  SerieFuerzaResponse,
} from "@/modules/entrenamientos/types/entrenamientos"

export const SIN_GRUPO = "Sin grupo"

/** Misma normalizacion que la busqueda del backend: sin tildes y en minusculas. */
export const normalizarTexto = (valor: string | null | undefined) =>
  (valor ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()

export const describirGrupoEjercicio = (ejercicio: {
  musculo_nombre?: string | null
  subcategoria_nombre?: string | null
  tipo?: string | null
}) => {
  const musculo = ejercicio.musculo_nombre ?? ejercicio.tipo ?? ""
  const subcategoria = ejercicio.subcategoria_nombre

  if (!subcategoria || normalizarTexto(subcategoria) === "general") {
    return musculo
  }

  return musculo ? `${musculo} · ${subcategoria}` : subcategoria
}

/**
 * Ejercicio del catalogo al que corresponde una serie.
 *
 * Se busca por id, que es lo que manda el backend, y se cae al nombre para las series
 * cacheadas antes de que la respuesta incluyera el id. Puede no encontrarse: el catalogo
 * se carga aparte y sin conexion puede no estar todavia en memoria.
 */
export const ejercicioDeSerie = (
  serie: SerieFuerzaResponse,
  ejercicios: EjercicioResponse[],
): EjercicioResponse | null => {
  if (serie.id_ejercicio != null) {
    const porId = ejercicios.find((item) => item.id_ejercicio === serie.id_ejercicio)
    if (porId) {
      return porId
    }
  }

  const nombre = normalizarTexto(serie.nombre_ejercicio)

  if (!nombre) {
    return null
  }

  return ejercicios.find((item) => normalizarTexto(item.nombre) === nombre) ?? null
}

/**
 * Miniatura y animacion de una serie. La serie ya las trae aplanadas; el catalogo solo
 * entra a completar cuando la sesion viene de un cache anterior a ese cambio.
 */
export const mediaDeSerie = (
  serie: SerieFuerzaResponse,
  ejercicios: EjercicioResponse[],
) => {
  if (serie.url_imagen || serie.url_animacion) {
    return { imagen: serie.url_imagen ?? null, animacion: serie.url_animacion ?? null }
  }

  const ejercicio = ejercicioDeSerie(serie, ejercicios)

  return {
    imagen: ejercicio?.url_imagen ?? null,
    animacion: ejercicio?.url_animacion ?? null,
  }
}

export const musculoDeSerie = (serie: SerieFuerzaResponse) =>
  serie.tipo_ejercicio?.trim() || SIN_GRUPO

/** Formatea 62.5 como "62,5" y 60 como "60": el peso se lee de un vistazo entre series. */
export const formatearPeso = (valor: number) =>
  Number.isInteger(valor) ? String(valor) : valor.toFixed(1).replace(".", ",")

export function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 rounded-full px-4 text-sm whitespace-nowrap transition duration-200 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        activo
          ? "font-medium text-tertiary-foreground shadow-(--shadow-airy)"
          : "bg-surface-lowest text-muted-foreground hover:text-foreground",
      )}
      style={activo ? { background: "var(--module-entrenamientos)" } : undefined}
    >
      {children}
    </button>
  )
}

/**
 * Campo numerico con incremento a los lados.
 *
 * En el gimnasio se registra de pie, con una mano y a veces con guantes: teclear en el
 * teclado numerico del telefono es el gesto mas caro de toda la pantalla. Los botones son
 * de 44px, el minimo tactil, y el campo sigue estando para saltar a un valor lejano.
 */
export function CampoNumerico({
  etiqueta,
  sufijo,
  valor,
  paso,
  minimo = 0,
  decimales = false,
  onChange,
  disabled,
}: {
  etiqueta: string
  sufijo?: string
  valor: string
  paso: number
  minimo?: number
  decimales?: boolean
  onChange: (valor: string) => void
  disabled?: boolean
}) {
  const inputId = useId()

  const ajustar = (delta: number) => {
    const actual = Number(valor)
    const base = Number.isFinite(actual) && valor !== "" ? actual : 0
    const siguiente = Math.max(minimo, Math.round((base + delta) * 100) / 100)
    onChange(String(siguiente))
  }

  const claseBoton =
    "flex size-12 shrink-0 touch-manipulation items-center justify-center rounded-[1rem] bg-surface-lowest text-foreground shadow-(--shadow-airy) transition hover:bg-surface-variant focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-40"

  return (
    <div className="space-y-2 rounded-[1.25rem] bg-surface-low p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={inputId}
          className="font-label text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
        >
          {etiqueta}
        </label>
        {sufijo ? <span className="text-[11px] text-muted-foreground">{sufijo}</span> : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={claseBoton}
          onClick={() => ajustar(-paso)}
          disabled={disabled}
          aria-label={`Bajar ${etiqueta.toLowerCase()}`}
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <input
          id={inputId}
          type="number"
          inputMode={decimales ? "decimal" : "numeric"}
          min={minimo}
          step={paso}
          value={valor}
          disabled={disabled}
          onChange={(evento) => onChange(evento.target.value)}
          className="h-14 min-w-0 flex-1 rounded-[1rem] border-0 bg-surface-lowest px-2 text-center text-2xl font-semibold tracking-tight text-foreground shadow-(--shadow-airy) outline-none transition motion-reduce:transition-none placeholder:font-normal placeholder:text-muted-foreground focus:ring-2 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          placeholder="0"
        />
        <button
          type="button"
          className={claseBoton}
          onClick={() => ajustar(paso)}
          disabled={disabled}
          aria-label={`Subir ${etiqueta.toLowerCase()}`}
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

/** Trabajo o calentamiento como dos opciones visibles, no un checkbox que hay que leer. */
export function SelectorTipoSerie({
  esCalentamiento,
  onChange,
  disabled,
}: {
  esCalentamiento: boolean
  onChange: (esCalentamiento: boolean) => void
  disabled?: boolean
}) {
  const opciones = [
    { valor: false, etiqueta: "Trabajo" },
    { valor: true, etiqueta: "Calentamiento" },
  ]

  return (
    <div
      role="group"
      aria-label="Tipo de serie"
      className="grid grid-cols-2 gap-1 rounded-[1.1rem] bg-surface-low p-1"
    >
      {opciones.map((opcion) => {
        const activo = opcion.valor === esCalentamiento

        return (
          <button
            key={opcion.etiqueta}
            type="button"
            disabled={disabled}
            aria-pressed={activo}
            onClick={() => onChange(opcion.valor)}
            className={cn(
              "min-h-11 touch-manipulation rounded-[0.9rem] text-sm transition motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              activo
                ? "bg-surface-lowest font-medium text-foreground shadow-(--shadow-airy)"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opcion.etiqueta}
          </button>
        )
      })}
    </div>
  )
}
