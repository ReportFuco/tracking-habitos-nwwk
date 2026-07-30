"use client"

import { useMemo, useState } from "react"
import { ChevronDown, CloudOff, PencilLine, Plus, Repeat, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EjercicioMedia } from "@/modules/entrenamientos/components/ejercicio-media"
import {
  CampoNumerico,
  SelectorTipoSerie,
  ejercicioDeSerie,
  formatearPeso,
  mediaDeSerie,
  musculoDeSerie,
  normalizarTexto,
} from "@/modules/entrenamientos/components/activo/shared"
import { isSeriePendiente } from "@/modules/entrenamientos/offline/entrenamientos-offline"
import type {
  EjercicioResponse,
  SerieFuerzaPatch,
  SerieFuerzaResponse,
} from "@/modules/entrenamientos/types/entrenamientos"

type GrupoEjercicio = {
  clave: string
  nombre: string
  imagen: string | null
  ejercicio: EjercicioResponse | null
  series: SerieFuerzaResponse[]
}

type GrupoMusculo = {
  musculo: string
  ejercicios: GrupoEjercicio[]
  total: number
}

/**
 * Agrupa las series en dos niveles: musculo y, dentro, ejercicio.
 *
 * El orden lo marca la aparicion, no el alfabeto: la sesion se lee como la cronica de lo
 * que se hizo, y ver el pecho primero porque se empezo por ahi es mas util que verlo
 * primero porque empieza con P.
 */
const agrupar = (
  series: SerieFuerzaResponse[],
  ejercicios: EjercicioResponse[],
): GrupoMusculo[] => {
  const musculos = new Map<string, GrupoMusculo>()
  const porEjercicio = new Map<string, GrupoEjercicio>()

  for (const serie of series) {
    const nombreMusculo = musculoDeSerie(serie)
    const nombreEjercicio = serie.nombre_ejercicio ?? "Ejercicio sin nombre"
    // La clave sale del ejercicio ya resuelto contra el catalogo, no del id crudo de la
    // serie: si una sesion mezcla series con id y series cacheadas antes de que existiera,
    // ambas tienen que caer en el mismo grupo y no partirse en dos tarjetas iguales.
    const ejercicio = ejercicioDeSerie(serie, ejercicios)
    const claveEjercicio = `${nombreMusculo}|${
      ejercicio ? ejercicio.id_ejercicio : normalizarTexto(nombreEjercicio)
    }`

    let grupoMusculo = musculos.get(nombreMusculo)

    if (!grupoMusculo) {
      grupoMusculo = { musculo: nombreMusculo, ejercicios: [], total: 0 }
      musculos.set(nombreMusculo, grupoMusculo)
    }

    let grupoEjercicio = porEjercicio.get(claveEjercicio)

    if (!grupoEjercicio) {
      grupoEjercicio = {
        clave: claveEjercicio,
        nombre: nombreEjercicio,
        imagen: mediaDeSerie(serie, ejercicios).imagen,
        ejercicio,
        series: [],
      }
      porEjercicio.set(claveEjercicio, grupoEjercicio)
      grupoMusculo.ejercicios.push(grupoEjercicio)
    }

    grupoEjercicio.series.push(serie)
    grupoMusculo.total += 1
  }

  return Array.from(musculos.values())
}

const initialEdicion = { cantidad_peso: "", repeticiones: "", es_calentamiento: false }

export function SeriesSesion({
  series,
  ejercicios,
  submitting,
  onContinuar,
  onGuardar,
  onEliminar,
  onReasignar,
}: {
  series: SerieFuerzaResponse[]
  ejercicios: EjercicioResponse[]
  submitting: boolean
  /** Volver a registrar el mismo ejercicio, sin pasar por el buscador. */
  onContinuar: (ejercicio: EjercicioResponse) => void
  onGuardar: (idFuerzaDetalle: number, payload: SerieFuerzaPatch) => Promise<boolean>
  onEliminar: (idFuerzaDetalle: number) => void
  onReasignar: (idFuerzaDetalle: number) => void
}) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [edicion, setEdicion] = useState(initialEdicion)

  const grupos = useMemo(() => agrupar(series, ejercicios), [series, ejercicios])

  const alternar = (clave: string) =>
    setExpandidos((previo) => {
      const siguiente = new Set(previo)

      if (siguiente.has(clave)) {
        siguiente.delete(clave)
      } else {
        siguiente.add(clave)
      }

      return siguiente
    })

  const abrirEdicion = (serie: SerieFuerzaResponse) => {
    setEditandoId(serie.id_fuerza_detalle)
    setEdicion({
      cantidad_peso: String(serie.cantidad_peso),
      repeticiones: String(serie.repeticiones),
      es_calentamiento: serie.es_calentamiento,
    })
  }

  const cerrarEdicion = () => {
    setEditandoId(null)
    setEdicion(initialEdicion)
  }

  const guardar = async (idFuerzaDetalle: number) => {
    const guardado = await onGuardar(idFuerzaDetalle, {
      es_calentamiento: edicion.es_calentamiento,
      cantidad_peso: Number(edicion.cantidad_peso),
      repeticiones: Number(edicion.repeticiones),
    })

    if (guardado) {
      cerrarEdicion()
    }
  }

  if (grupos.length === 0) {
    return (
      <div className="rounded-[1.25rem] bg-surface-lowest p-5 text-sm leading-6 text-muted-foreground shadow-(--shadow-airy) sm:rounded-[1.5rem] sm:p-6">
        Aun no registras series en esta sesion. Elige un ejercicio y la primera aparecera
        aqui al instante.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {grupos.map((grupo) => (
        <section key={grupo.musculo} className="space-y-2">
          <div className="flex items-baseline justify-between gap-3 px-1">
            <h3 className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-foreground sm:text-[0.7rem]">
              {grupo.musculo}
            </h3>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {grupo.total} {grupo.total === 1 ? "serie" : "series"}
            </span>
          </div>

          {grupo.ejercicios.map((item) => {
            const abierto =
              expandidos.has(item.clave) ||
              item.series.some((serie) => serie.id_fuerza_detalle === editandoId)
            const trabajo = item.series.filter((serie) => !serie.es_calentamiento).length
            const calentamiento = item.series.length - trabajo
            // Solo se puede seguir con el ejercicio si se encontro en el catalogo, que es
            // de donde sale la animacion que necesita el panel de registro.
            const ejercicioCatalogo = item.ejercicio

            return (
              <article
                key={item.clave}
                className="overflow-hidden rounded-[1.25rem] bg-surface-lowest shadow-(--shadow-airy) sm:rounded-[1.5rem]"
              >
                <div className="flex items-center gap-2 pr-2.5">
                  <button
                    type="button"
                    onClick={() => alternar(item.clave)}
                    aria-expanded={abierto}
                    className="flex min-w-0 flex-1 touch-manipulation items-center gap-3 p-2.5 text-left sm:p-3"
                  >
                    <EjercicioMedia src={item.imagen} alt="" size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.nombre}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {trabajo > 0 ? `${trabajo} de trabajo` : null}
                        {trabajo > 0 && calentamiento > 0 ? " · " : null}
                        {calentamiento > 0 ? `${calentamiento} de calentamiento` : null}
                      </p>
                    </div>
                    <ChevronDown
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground transition-transform duration-300"
                      style={{ transform: abierto ? "rotate(180deg)" : "rotate(0deg)" }}
                    />
                  </button>

                  {/* Seguir con el mismo ejercicio es el atajo que mas se usa entre series,
                      asi que sale del acordeon y vive como su propio boton. */}
                  {ejercicioCatalogo ? (
                    <button
                      type="button"
                      onClick={() => onContinuar(ejercicioCatalogo)}
                      aria-label={`Agregar otra serie de ${item.nombre}`}
                      className="flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-full text-[color:var(--module-entrenamientos)] transition hover:bg-surface-low focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-95"
                      style={{
                        background:
                          "color-mix(in oklch, var(--module-entrenamientos) 10%, transparent)",
                      }}
                    >
                      <Plus className="size-4" aria-hidden />
                    </button>
                  ) : null}
                </div>

                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                  style={{ gridTemplateRows: abierto ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-2 border-t border-(--border)/20 px-2.5 py-3 sm:px-3">
                      {item.series.map((serie, indice) =>
                        editandoId === serie.id_fuerza_detalle ? (
                          <div
                            key={serie.id_fuerza_detalle}
                            className="space-y-4 rounded-[1rem] bg-surface-low p-3 sm:p-4"
                          >
                            <div className="grid gap-3 sm:grid-cols-2">
                              <CampoNumerico
                                etiqueta="Peso"
                                sufijo="kg"
                                valor={edicion.cantidad_peso}
                                paso={2.5}
                                decimales
                                disabled={submitting}
                                onChange={(valor) =>
                                  setEdicion((previo) => ({ ...previo, cantidad_peso: valor }))
                                }
                              />
                              <CampoNumerico
                                etiqueta="Repeticiones"
                                valor={edicion.repeticiones}
                                paso={1}
                                minimo={1}
                                disabled={submitting}
                                onChange={(valor) =>
                                  setEdicion((previo) => ({ ...previo, repeticiones: valor }))
                                }
                              />
                            </div>

                            <SelectorTipoSerie
                              esCalentamiento={edicion.es_calentamiento}
                              disabled={submitting}
                              onChange={(valor) =>
                                setEdicion((previo) => ({ ...previo, es_calentamiento: valor }))
                              }
                            />

                            <div className="flex flex-wrap gap-2">
                              <Button
                                onClick={() => guardar(serie.id_fuerza_detalle)}
                                disabled={submitting}
                                className="min-h-11 bg-primary text-[color:var(--primary-foreground)] hover:bg-primary/90"
                              >
                                Guardar
                              </Button>
                              <Button
                                variant="ghost"
                                className="min-h-11"
                                onClick={cerrarEdicion}
                              >
                                Cancelar
                              </Button>
                              <Button
                                variant="ghost"
                                className="min-h-11 text-muted-foreground hover:text-foreground"
                                onClick={() => onReasignar(serie.id_fuerza_detalle)}
                              >
                                <Repeat className="size-3.5" aria-hidden />
                                Otro ejercicio
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            key={serie.id_fuerza_detalle}
                            className="flex min-w-0 items-center gap-2 rounded-[0.875rem] bg-surface-low px-3 py-2"
                          >
                            <span className="w-4 shrink-0 font-label text-[10px] text-muted-foreground">
                              {indice + 1}
                            </span>
                            <span
                              className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${
                                serie.es_calentamiento
                                  ? "bg-primary/10 text-primary"
                                  : "bg-foreground/5 text-foreground"
                              }`}
                              title={serie.es_calentamiento ? "Calentamiento" : "Trabajo"}
                            >
                              {serie.es_calentamiento ? "C" : "T"}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                              <span className="font-semibold">
                                {formatearPeso(serie.cantidad_peso)}
                              </span>
                              <span className="text-xs text-muted-foreground"> kg</span>
                              <span className="text-xs text-muted-foreground">
                                {" "}
                                × {serie.repeticiones} reps
                              </span>
                            </span>

                            {isSeriePendiente(serie) ? (
                              // Serie encolada sin conexion: todavia no tiene id del
                              // backend, asi que editarla o borrarla apuntaria a un id
                              // inexistente. Se muestra el estado y nada mas.
                              <span
                                title="Se enviara al recuperar la conexion"
                                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                              >
                                <CloudOff className="size-3" aria-hidden />
                                Pendiente
                              </span>
                            ) : (
                              <div className="flex shrink-0 gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label="Editar serie"
                                  onClick={() => abrirEdicion(serie)}
                                  className="size-9 p-0 text-muted-foreground hover:text-primary"
                                >
                                  <PencilLine className="size-3.5" aria-hidden />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label="Eliminar serie"
                                  onClick={() => onEliminar(serie.id_fuerza_detalle)}
                                  className="size-9 p-0 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="size-3.5" aria-hidden />
                                </Button>
                              </div>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      ))}
    </div>
  )
}
