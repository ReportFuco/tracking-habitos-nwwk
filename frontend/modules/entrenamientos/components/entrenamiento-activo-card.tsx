"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight, ListChecks, Plus, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
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
  const [vistaMovil, setVistaMovil] = useState<"registro" | "resumen">("registro")

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
        setVistaMovil("registro")
        return
      }

      const guardado = await guardarEdicion(modo.idSerie, {
        id_ejercicio: ejercicio.id_ejercicio,
      })

      if (guardado) {
        setModo(modo.anterior)
        setVistaMovil("resumen")
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
      {entrenamientoActivo.sync_error ? (
        <div className="flex items-start gap-3 rounded-[1.25rem] bg-destructive/10 p-4 text-sm leading-6 text-destructive sm:rounded-[1.5rem] sm:p-5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">No pudimos sincronizar este entrenamiento</p>
            <p className="mt-1 text-destructive/80">
              {entrenamientoActivo.sync_error} Tus series quedaron guardadas en este
              dispositivo; revisa si abriste otra sesion desde otro lugar antes de seguir.
            </p>
          </div>
        </div>
      ) : null}

      <header className="rounded-[1.5rem] bg-surface-lowest p-4 shadow-(--shadow-airy) sm:rounded-[1.75rem] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-label text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <span
                className="size-2 rounded-full"
                style={{ background: "var(--module-entrenamientos)" }}
                aria-hidden
              />
              Sesion en curso
            </p>
            <p className="mt-1 truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {entrenamientoActivo.nombre_gimnasio ?? "Entrenamiento actual"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="inline-flex min-h-8 items-center rounded-full px-3 text-xs font-medium"
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
              className="min-h-11 rounded-full px-4 text-foreground hover:text-primary"
            >
              Cerrar
            </Button>
          </div>
        </div>

        {total > 0 ? (
          <div className="mt-3 space-y-1.5">
            <div
              className="flex h-2 overflow-hidden rounded-full bg-surface-variant"
              aria-hidden
            >
              {trabajo > 0 ? (
                <div
                  className="h-full transition-[width] duration-300 motion-reduce:transition-none"
                  style={{
                    width: `${(trabajo / total) * 100}%`,
                    background: "var(--module-entrenamientos)",
                  }}
                />
              ) : null}
              {calentamiento > 0 ? (
                <div
                  className="h-full transition-[width] duration-300 motion-reduce:transition-none"
                  style={{
                    width: `${(calentamiento / total) * 100}%`,
                    background:
                      "color-mix(in oklch, var(--module-entrenamientos) 35%, transparent)",
                  }}
                />
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{trabajo} de trabajo</span>
              <span>{calentamiento} de calentamiento</span>
            </div>
          </div>
        ) : null}
      </header>

      <div
        role="group"
        aria-label="Mostrar en el entrenamiento activo"
        className="grid grid-cols-2 gap-1 rounded-[1.2rem] bg-surface-low p-1 xl:hidden"
      >
        <button
          type="button"
          aria-pressed={vistaMovil === "registro"}
          onClick={() => setVistaMovil("registro")}
          className={cn(
            "flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-[0.95rem] px-3 text-sm transition motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            vistaMovil === "registro"
              ? "bg-surface-lowest font-medium text-foreground shadow-(--shadow-airy)"
              : "text-muted-foreground",
          )}
        >
          <Plus className="size-4" aria-hidden />
          Registrar
        </button>
        <button
          type="button"
          aria-pressed={vistaMovil === "resumen"}
          onClick={() => setVistaMovil("resumen")}
          className={cn(
            "flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-[0.95rem] px-3 text-sm transition motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            vistaMovil === "resumen"
              ? "bg-surface-lowest font-medium text-foreground shadow-(--shadow-airy)"
              : "text-muted-foreground",
          )}
        >
          <ListChecks className="size-4" aria-hidden />
          Resumen
          {total > 0 ? (
            <span className="flex min-w-5 items-center justify-center rounded-full bg-foreground/8 px-1.5 text-[11px]">
              {total}
            </span>
          ) : null}
        </button>
      </div>

      <div className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] xl:items-start">
        <div
          className={cn("min-w-0", vistaMovil === "registro" ? "block" : "hidden", "xl:block")}
        >
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
                modo.tipo === "reasignar"
                  ? () => {
                      setModo(modo.anterior)
                      setVistaMovil("resumen")
                    }
                  : undefined
              }
            />
          )}
        </div>

        <div
          className={cn(
            "min-w-0 space-y-3",
            vistaMovil === "resumen" ? "block" : "hidden",
            "xl:block",
          )}
        >
          <div className="flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-sm font-semibold text-foreground">Lo que llevas hoy</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Edita o repite desde aqui.</p>
            </div>
            <span className="text-xs text-muted-foreground">
              {total} {total === 1 ? "serie" : "series"}
            </span>
          </div>
          <SeriesSesion
            series={series}
            ejercicios={ejercicios}
            submitting={submitting}
            onContinuar={(ejercicio) => {
              setModo({ tipo: "registro", idEjercicio: ejercicio.id_ejercicio })
              setVistaMovil("registro")
            }}
            onGuardar={guardarEdicion}
            onEliminar={eliminar}
            onReasignar={(idSerie) => {
              setModo((previo) => ({
                tipo: "reasignar",
                idSerie,
                anterior: previo.tipo === "reasignar" ? previo.anterior : previo,
              }))
              setVistaMovil("registro")
            }}
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
