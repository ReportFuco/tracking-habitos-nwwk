"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import { CloudOff, LoaderCircle, Plus, Repeat } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EjercicioAnimacion } from "@/modules/entrenamientos/components/ejercicio-media"
import {
  CampoNumerico,
  SelectorTipoSerie,
  describirGrupoEjercicio,
  formatearPeso,
} from "@/modules/entrenamientos/components/activo/shared"
import { isSeriePendiente } from "@/modules/entrenamientos/offline/entrenamientos-offline"
import type {
  EjercicioResponse,
  SerieFuerzaCreate,
  SerieFuerzaResponse,
} from "@/modules/entrenamientos/types/entrenamientos"

export type SugerenciaSerie = {
  cantidad_peso: string
  repeticiones: string
  es_calentamiento: boolean
}

/**
 * Registro de series de un ejercicio.
 *
 * La animacion preside el panel: es la referencia de como se ejecuta el movimiento y estar
 * mirandola mientras se carga la serie es justo lo que se pedia de esta pantalla.
 *
 * Tras guardar, el peso y las repeticiones se mantienen. Una rutina son varias series
 * iguales seguidas, asi que dejar los campos cargados convierte la segunda y la tercera en
 * un solo toque; cuando cambia la carga, los botones de mas y menos la ajustan.
 *
 * El componente se monta por ejercicio (`key`), asi que su estado nace del ultimo valor
 * conocido de ese ejercicio y no arrastra el del anterior.
 */
export function RegistroSerie({
  ejercicio,
  series,
  sugerencia,
  submitting,
  onAgregar,
  onCambiarEjercicio,
}: {
  ejercicio: EjercicioResponse
  /** Series de este ejercicio ya registradas en la sesion, en orden. */
  series: SerieFuerzaResponse[]
  sugerencia: SugerenciaSerie
  submitting: boolean
  onAgregar: (payload: SerieFuerzaCreate) => Promise<boolean>
  onCambiarEjercicio: () => void
}) {
  const [peso, setPeso] = useState(sugerencia.cantidad_peso)
  const [repeticiones, setRepeticiones] = useState(sugerencia.repeticiones)
  const [esCalentamiento, setEsCalentamiento] = useState(sugerencia.es_calentamiento)
  const tituloRef = useRef<HTMLHeadingElement | null>(null)

  useEffect(() => {
    tituloRef.current?.focus()
  }, [])

  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()

    await onAgregar({
      id_ejercicio: ejercicio.id_ejercicio,
      es_calentamiento: esCalentamiento,
      cantidad_peso: Number(peso),
      repeticiones: Number(repeticiones),
    })
  }

  const grupo = describirGrupoEjercicio(ejercicio)
  const puedeGuardar = peso !== "" && repeticiones !== "" && Number(repeticiones) > 0

  return (
    <section className="overflow-hidden rounded-[1.5rem] bg-surface-lowest shadow-(--shadow-airy-lg) sm:rounded-[1.75rem]">
      <form onSubmit={enviar} className="space-y-4 p-4 sm:space-y-5 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <EjercicioAnimacion
            imagen={ejercicio.url_imagen}
            animacion={ejercicio.url_animacion}
            alt={ejercicio.nombre}
            className="size-24 shrink-0 rounded-[1.25rem] sm:size-32"
            priority
          />

          <div className="min-w-0 flex-1 sm:pt-1">
            <div className="flex items-center gap-2">
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-tertiary-foreground"
                style={{ background: "var(--module-entrenamientos)" }}
                aria-hidden
              >
                2
              </span>
              <p className="font-label text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Registra tu serie
              </p>
            </div>
            <h2
              ref={tituloRef}
              tabIndex={-1}
              className="mt-2 line-clamp-2 text-base leading-tight font-semibold tracking-[-0.01em] text-foreground outline-none sm:text-xl"
            >
              {ejercicio.nombre}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {grupo ? (
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium text-tertiary-foreground"
                  style={{ background: "var(--module-entrenamientos)" }}
                >
                  {grupo}
                </span>
              ) : null}
              {ejercicio.equipamiento ? (
                <span className="rounded-full bg-surface-low px-2.5 py-1 text-[11px] text-muted-foreground">
                  {ejercicio.equipamiento}
                </span>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCambiarEjercicio}
              className="mt-1 min-h-11 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
            >
              <Repeat className="size-3.5" aria-hidden />
              Cambiar ejercicio
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <CampoNumerico
            etiqueta="Peso"
            sufijo="kg"
            valor={peso}
            paso={2.5}
            decimales
            onChange={setPeso}
            disabled={submitting}
          />
          <CampoNumerico
            etiqueta="Repeticiones"
            valor={repeticiones}
            paso={1}
            minimo={1}
            onChange={setRepeticiones}
            disabled={submitting}
          />
        </div>

        <SelectorTipoSerie
          esCalentamiento={esCalentamiento}
          onChange={setEsCalentamiento}
          disabled={submitting}
        />

        <div className="rounded-[1.25rem] bg-surface-low p-2">
          <Button
            type="submit"
            disabled={submitting || !puedeGuardar}
            className="min-h-14 w-full rounded-[1rem] bg-[color:var(--module-entrenamientos)] text-base text-[color:var(--tertiary-foreground)] shadow-(--shadow-airy) transition hover:bg-[color:var(--module-entrenamientos)]/90 motion-reduce:transition-none"
          >
            {submitting ? (
              <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <Plus className="size-5" aria-hidden />
            )}
            {submitting ? "Guardando serie..." : `Guardar serie ${series.length + 1}`}
          </Button>
        </div>

        {series.length > 0 ? (
          <div className="space-y-2" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">Series de este ejercicio</p>
              <span className="text-xs text-muted-foreground">
                {series.length} {series.length === 1 ? "guardada" : "guardadas"}
              </span>
            </div>
            {/* Solo lectura: editar y borrar viven en el resumen de la sesion, para que no
                haya dos caminos distintos que hagan lo mismo. */}
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
              {series.map((serie, indice) => (
                <span
                  key={serie.id_fuerza_detalle}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-[0.9rem] px-3 py-1.5 text-xs ${
                    serie.es_calentamiento
                      ? "bg-surface-low text-muted-foreground"
                      : "bg-foreground/5 text-foreground"
                  }`}
                >
                  <span className="flex size-5 items-center justify-center rounded-full bg-surface-lowest font-label text-[10px] text-muted-foreground">
                    {indice + 1}
                  </span>
                  {formatearPeso(serie.cantidad_peso)} kg × {serie.repeticiones}
                  {isSeriePendiente(serie) ? (
                    <CloudOff
                      className="size-3 text-muted-foreground"
                      aria-label="Pendiente de enviar"
                    />
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </form>
    </section>
  )
}
