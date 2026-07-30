"use client"

import { FormEvent, useState } from "react"
import { CloudOff, Plus, Repeat } from "lucide-react"
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
    <section className="rounded-[1.5rem] bg-surface-lowest shadow-(--shadow-airy-lg) sm:rounded-[1.75rem]">
      <form onSubmit={enviar} className="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <EjercicioAnimacion
            imagen={ejercicio.url_imagen}
            animacion={ejercicio.url_animacion}
            alt={ejercicio.nombre}
            className="size-[11.25rem] sm:size-32"
            priority
          />

          <div className="min-w-0 w-full flex-1 space-y-2 text-center sm:pt-1 sm:text-left">
            <p className="font-label text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">
              Registrando
            </p>
            <h2 className="text-lg leading-tight font-semibold tracking-[-0.01em] text-foreground sm:text-xl">
              {ejercicio.nombre}
            </h2>
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              {grupo ? (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-medium text-tertiary-foreground"
                  style={{ background: "var(--module-entrenamientos)" }}
                >
                  {grupo}
                </span>
              ) : null}
              {ejercicio.equipamiento ? (
                <span className="rounded-full bg-surface-low px-2.5 py-0.5 text-[11px] text-muted-foreground">
                  {ejercicio.equipamiento}
                </span>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCambiarEjercicio}
              className="min-h-10 text-muted-foreground hover:text-foreground"
            >
              <Repeat className="size-3.5" aria-hidden />
              Cambiar ejercicio
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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

        <Button
          type="submit"
          disabled={submitting || !puedeGuardar}
          className="min-h-12 w-full bg-[color:var(--module-entrenamientos)] text-[color:var(--tertiary-foreground)] hover:bg-[color:var(--module-entrenamientos)]/90"
        >
          <Plus className="size-4" aria-hidden />
          {submitting ? "Guardando..." : "Agregar serie"}
        </Button>

        {series.length > 0 ? (
          <div className="space-y-2">
            <p className="font-label text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {series.length} {series.length === 1 ? "serie" : "series"} de este ejercicio
            </p>
            {/* Solo lectura: editar y borrar viven en el resumen de la sesion, para que no
                haya dos caminos distintos que hagan lo mismo. */}
            <div className="flex flex-wrap gap-1.5">
              {series.map((serie, indice) => (
                <span
                  key={serie.id_fuerza_detalle}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                    serie.es_calentamiento
                      ? "bg-surface-low text-muted-foreground"
                      : "bg-foreground/5 text-foreground"
                  }`}
                >
                  <span className="font-label text-[10px] text-muted-foreground">
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
