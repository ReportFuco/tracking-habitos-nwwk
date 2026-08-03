"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useEntrenamientos } from "@/modules/entrenamientos/hooks/useEntrenamientos"
import {
  EjercicioPicker,
} from "@/modules/entrenamientos/components/activo/ejercicio-picker"
import {
  RegistroSerie,
  type SugerenciaSerie,
} from "@/modules/entrenamientos/components/activo/registro-serie"
import { SeriesSesion } from "@/modules/entrenamientos/components/activo/series-sesion"
import {
  ejercicioDeSerie,
  normalizarTexto,
} from "@/modules/entrenamientos/components/activo/shared"
import {
  serieFuerzaCreateSchema,
  serieFuerzaPatchSchema,
} from "@/modules/entrenamientos/schemas/entrenamientos.schema"
import type {
  EjercicioResponse,
  SerieFuerzaCreate,
  SerieFuerzaPatch,
  SerieFuerzaResponse,
} from "@/modules/entrenamientos/types/entrenamientos"

const ULTIMA_SERIE_LS_KEY = "ut_series_cache"

type CachedSerie = {
  cantidad_peso: string
  repeticiones: string
  es_calentamiento: boolean
}

/**
 * Ultimos valores por ejercicio, fuera del cache de peticiones.
 *
 * Sobreviven al cierre de la sesion a proposito: la carga con la que se trabaja un
 * ejercicio se mantiene entre entrenamientos, asi que la semana siguiente el formulario ya
 * viene con el peso de la vez anterior.
 */
function guardarUltimaSerieLocal(idEjercicio: number, data: CachedSerie) {
  try {
    const raw = localStorage.getItem(ULTIMA_SERIE_LS_KEY)
    const cache: Record<number, CachedSerie> = raw
      ? (JSON.parse(raw) as Record<number, CachedSerie>)
      : {}
    cache[idEjercicio] = data
    localStorage.setItem(ULTIMA_SERIE_LS_KEY, JSON.stringify(cache))
  } catch {}
}

function leerUltimaSerieLocal(idEjercicio: number): CachedSerie | null {
  try {
    const raw = localStorage.getItem(ULTIMA_SERIE_LS_KEY)

    if (!raw) {
      return null
    }

    const cache = JSON.parse(raw) as Record<number, CachedSerie>
    return cache[idEjercicio] ?? null
  } catch {
    return null
  }
}

/**
 * Que ocupa el panel de trabajo.
 *
 * `reasignar` guarda a donde volver porque se entra desde el resumen, que puede estar
 * abierto tanto mientras se busca un ejercicio como mientras se registra otro.
 */
type Modo =
  | { tipo: "picker" }
  | { tipo: "registro"; idEjercicio: number }
  | { tipo: "reasignar"; idSerie: number; anterior: Modo }

/** Las series de un ejercicio, en el orden en que se registraron. */
const seriesDelEjercicio = (
  series: SerieFuerzaResponse[],
  ejercicio: EjercicioResponse,
) =>
  series.filter((serie) =>
    serie.id_ejercicio != null
      ? serie.id_ejercicio === ejercicio.id_ejercicio
      : normalizarTexto(serie.nombre_ejercicio) === normalizarTexto(ejercicio.nombre),
  )

export function EntrenamientoActivoCard() {
  const {
    entrenamientoActivo,
    ejercicios,
    musculos,
    loading,
    submitting,
    fetchEjercicios,
    fetchMusculos,
    agregarSerieFuerza,
    editarSerieFuerza,
    eliminarSerieFuerza,
    cerrarEntrenoFuerzaActivo,
  } = useEntrenamientos()
  const router = useRouter()

  const [modo, setModo] = useState<Modo>({ tipo: "picker" })
  const [dialogoCierre, setDialogoCierre] = useState(false)

  useEffect(() => {
    if (ejercicios.length === 0) {
      void fetchEjercicios()
    }

    if (musculos.length === 0) {
      void fetchMusculos()
    }
  }, [ejercicios.length, fetchEjercicios, fetchMusculos, musculos.length])

  const series = useMemo(
    () => entrenamientoActivo?.series ?? [],
    [entrenamientoActivo?.series],
  )

  // Ejercicios ya usados en la sesion, del mas reciente al mas antiguo y sin repetir: es
  // el acceso directo del selector.
  const recientes = useMemo(() => {
    const vistos = new Map<number, EjercicioResponse>()

    for (const serie of [...series].reverse()) {
      const ejercicio = ejercicioDeSerie(serie, ejercicios)

      if (ejercicio && !vistos.has(ejercicio.id_ejercicio)) {
        vistos.set(ejercicio.id_ejercicio, ejercicio)
      }
    }

    return Array.from(vistos.values())
  }, [series, ejercicios])

  const ejercicioEnRegistro =
    modo.tipo === "registro"
      ? (ejercicios.find((item) => item.id_ejercicio === modo.idEjercicio) ?? null)
      : null

  const sugerencia = useMemo((): SugerenciaSerie => {
    if (!ejercicioEnRegistro) {
      return { cantidad_peso: "", repeticiones: "", es_calentamiento: false }
    }

    const ultima = seriesDelEjercicio(series, ejercicioEnRegistro).at(-1)

    if (ultima) {
      return {
        cantidad_peso: String(ultima.cantidad_peso),
        repeticiones: String(ultima.repeticiones),
        es_calentamiento: ultima.es_calentamiento,
      }
    }

    return (
      leerUltimaSerieLocal(ejercicioEnRegistro.id_ejercicio) ?? {
        cantidad_peso: "",
        repeticiones: "",
        es_calentamiento: false,
      }
    )
    // Solo interesa el valor con el que se monta el panel de ese ejercicio: recalcularlo
    // en cada serie no aportaria nada porque `RegistroSerie` ya conserva lo que se cargo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ejercicioEnRegistro?.id_ejercicio])

  const agregar = useCallback(
    async (payload: SerieFuerzaCreate) => {
      const validado = serieFuerzaCreateSchema.safeParse(payload)

      if (!validado.success) {
        toast.error("Revisa la serie", {
          description: validado.error.issues[0]?.message ?? "Completa los datos requeridos.",
        })
        return false
      }

      const resultado = await agregarSerieFuerza({
        ...validado.data,
        client_request_id: crypto.randomUUID(),
      })

      if (!resultado.ok) {
        toast.error("No pudimos guardar la serie", { description: resultado.message })
        return false
      }

      guardarUltimaSerieLocal(validado.data.id_ejercicio, {
        cantidad_peso: String(validado.data.cantidad_peso),
        repeticiones: String(validado.data.repeticiones),
        es_calentamiento: validado.data.es_calentamiento,
      })

      // Sin toast de exito: la serie aparece al instante en la lista del ejercicio y en el
      // resumen, y en una rutina se guarda una serie cada minuto.
      return true
    },
    [agregarSerieFuerza],
  )

  const guardarEdicion = useCallback(
    async (idFuerzaDetalle: number, payload: SerieFuerzaPatch) => {
      const validado = serieFuerzaPatchSchema.safeParse(payload)

      if (!validado.success) {
        toast.error("Revisa la serie", {
          description:
            validado.error.issues[0]?.message ?? "Ajusta los datos antes de guardar.",
        })
        return false
      }

      const resultado = await editarSerieFuerza(idFuerzaDetalle, validado.data)

      if (!resultado.ok) {
        toast.error("No pudimos actualizar la serie", { description: resultado.message })
        return false
      }

      toast.success("Serie actualizada")
      return true
    },
    [editarSerieFuerza],
  )

  const eliminar = useCallback(
    async (idFuerzaDetalle: number) => {
      const resultado = await eliminarSerieFuerza(idFuerzaDetalle)

      if (resultado.ok) {
        toast.success("Serie eliminada")
        return
      }

      toast.error("No pudimos eliminar la serie", { description: resultado.message })
    },
    [eliminarSerieFuerza],
  )

  const seleccionarEjercicio = useCallback(
    async (ejercicio: EjercicioResponse) => {
      if (modo.tipo !== "reasignar") {
        setModo({ tipo: "registro", idEjercicio: ejercicio.id_ejercicio })
        return
      }

      const guardado = await guardarEdicion(modo.idSerie, {
        id_ejercicio: ejercicio.id_ejercicio,
      })

      if (guardado) {
        setModo(modo.anterior)
      }
    },
    [modo, guardarEdicion],
  )

  const cerrar = async () => {
    const resultado = await cerrarEntrenoFuerzaActivo()

    if (resultado.ok) {
      toast.success(resultado.queued ? "Sesion guardada sin conexion" : "Sesion cerrada", {
        description: resultado.queued
          ? "Ya no aparece como activa; se terminara de cerrar al recuperar la conexion."
          : "Tu entrenamiento ya paso al historico.",
      })
      router.push("/app/entrenamientos")
      return
    }

    toast.error("No pudimos cerrar la sesion", { description: resultado.message })
  }

  if (!entrenamientoActivo) {
    return (
      <section className="rounded-[1.5rem] bg-surface-low p-4 sm:rounded-[1.75rem] sm:p-6">
        <div className="rounded-4xl p-5 shadow-(--shadow-airy) sm:rounded-[1.5rem] sm:p-6">
          <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-[0.72rem] sm:tracking-[0.24em]">
            Sin sesion activa
          </p>
          <h2 className="mt-2 text-xl leading-tight font-semibold tracking-[-0.02em] text-foreground sm:mt-3 sm:text-3xl sm:tracking-[-0.03em]">
            Todavia no hay un entrenamiento en curso.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Primero abre tu entrenamiento y luego vuelve aqui para empezar a registrar tus
            series.
          </p>
          <Button
            asChild
            className="mt-5 bg-[color:var(--module-entrenamientos)] text-[color:var(--tertiary-foreground)] hover:bg-[color:var(--module-entrenamientos)]/90"
          >
            <Link href="/app/entrenamientos/registrar">
              Registrar entrenamiento
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    )
  }

  const total = series.length
  const trabajo = series.filter((serie) => !serie.es_calentamiento).length
  const calentamiento = total - trabajo

  return (
    <div className="space-y-4 sm:space-y-6">
      <header className="rounded-[1.5rem] bg-surface-low p-4 sm:rounded-[1.75rem] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-label text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-[0.68rem]">
              Sesion en curso
            </p>
            <p className="mt-1 truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {entrenamientoActivo.nombre_gimnasio ?? "Entrenamiento actual"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em]"
              style={{
                background:
                  "color-mix(in oklch, var(--module-entrenamientos) 10%, transparent)",
                color: "var(--module-entrenamientos)",
              }}
            >
              {total} {total === 1 ? "serie" : "series"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialogoCierre(true)}
              disabled={submitting}
              className="min-h-10 text-foreground hover:text-primary"
            >
              Cerrar
            </Button>
          </div>
        </div>

        {total > 0 ? (
          <div className="mt-3 space-y-1.5">
            <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-variant">
              {trabajo > 0 ? (
                <div
                  className="h-full"
                  style={{
                    width: `${(trabajo / total) * 100}%`,
                    background: "var(--module-entrenamientos)",
                  }}
                />
              ) : null}
              {calentamiento > 0 ? (
                <div
                  className="h-full"
                  style={{
                    width: `${(calentamiento / total) * 100}%`,
                    background:
                      "color-mix(in oklch, var(--module-entrenamientos) 35%, transparent)",
                  }}
                />
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {trabajo} de trabajo · {calentamiento} de calentamiento
            </p>
          </div>
        ) : null}
      </header>

      <div className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] xl:items-start">
        <div className="min-w-0">
          {modo.tipo === "registro" && ejercicioEnRegistro ? (
            <RegistroSerie
              // Cada ejercicio parte con su propio estado en vez de heredar el anterior.
              key={ejercicioEnRegistro.id_ejercicio}
              ejercicio={ejercicioEnRegistro}
              series={seriesDelEjercicio(series, ejercicioEnRegistro)}
              sugerencia={sugerencia}
              submitting={submitting}
              onAgregar={agregar}
              onCambiarEjercicio={() => setModo({ tipo: "picker" })}
            />
          ) : (
            <EjercicioPicker
              ejercicios={ejercicios}
              musculos={musculos}
              cargando={loading}
              recientes={recientes}
              onSeleccionar={seleccionarEjercicio}
              titulo={modo.tipo === "reasignar" ? "Cambiar ejercicio" : "Nueva serie"}
              descripcion={
                modo.tipo === "reasignar"
                  ? "Elige a que ejercicio corresponde la serie que estas corrigiendo."
                  : "Elige el grupo muscular y toca el ejercicio que vas a registrar."
              }
              onCancelar={
                modo.tipo === "reasignar" ? () => setModo(modo.anterior) : undefined
              }
            />
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <p className="px-1 font-label text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-[0.68rem]">
            Lo que llevas hoy
          </p>
          <SeriesSesion
            series={series}
            ejercicios={ejercicios}
            submitting={submitting}
            onContinuar={(ejercicio) =>
              setModo({ tipo: "registro", idEjercicio: ejercicio.id_ejercicio })
            }
            onGuardar={guardarEdicion}
            onEliminar={eliminar}
            onReasignar={(idSerie) =>
              setModo((previo) => ({
                tipo: "reasignar",
                idSerie,
                anterior: previo.tipo === "reasignar" ? previo.anterior : previo,
              }))
            }
          />
        </div>
      </div>

      <Dialog open={dialogoCierre} onOpenChange={setDialogoCierre}>
        <DialogContent className="rounded-[1.5rem] border-0 bg-surface-lowest p-0 shadow-(--shadow-airy-lg) sm:max-w-xl sm:rounded-[1.75rem]">
          <div className="bg-[linear-gradient(135deg,color-mix(in_oklch,var(--primary)_14%,white),transparent_70%)] px-5 py-5 sm:px-7 sm:py-6">
            <DialogHeader className="text-left">
              <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-[0.72rem] sm:tracking-[0.24em]">
                Confirmacion
              </p>
              <DialogTitle className="mt-2 text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-2xl sm:tracking-[-0.03em]">
                Estas seguro de cerrar el entrenamiento?
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground sm:mt-3">
                Si cierras la sesion ahora, este entrenamiento pasara al historico y dejaras
                de registrar series en curso.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-5 pb-5 sm:px-7 sm:pb-6">
            <div className="rounded-[1.25rem] bg-surface-low p-4 sm:rounded-[1.5rem] sm:p-5">
              <p className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                {entrenamientoActivo.nombre_gimnasio ?? "Entrenamiento actual"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {total} serie{total === 1 ? "" : "s"} registradas en esta sesion.
              </p>
            </div>

            <DialogFooter className="mt-4 sm:mt-5">
              <Button variant="ghost" onClick={() => setDialogoCierre(false)}>
                Seguir entrenando
              </Button>
              <Button
                onClick={async () => {
                  await cerrar()
                  setDialogoCierre(false)
                }}
                disabled={submitting}
                className="bg-primary text-[color:var(--primary-foreground)] hover:bg-primary/90"
              >
                {submitting ? "Cerrando..." : "Si, cerrar entrenamiento"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
