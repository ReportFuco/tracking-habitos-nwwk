"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  ListChecks,
  Sparkles,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { addDays, formatShortDate, startOfWeek, toLocalIsoDate } from "@/lib/dates"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { cn } from "@/lib/utils"
import type { ModoCarga } from "@/modules/entrenamientos/api/seguimiento.api"
import {
  ETIQUETA_NIVEL,
  MapaCuerpo,
  MuestraNivel,
  formatearSeries,
} from "@/modules/entrenamientos/components/seguimiento/mapa-cuerpo"
import { useCargaMuscular, useSeguimientos } from "@/modules/entrenamientos/hooks/useSeguimiento"
import {
  NIVELES_CARGA,
  type Seguimiento,
  type ZonaCarga,
} from "@/modules/entrenamientos/schemas/seguimiento.schema"

const RANGO_NIVEL: Record<(typeof NIVELES_CARGA)[number], string> = {
  sin_trabajo: "0",
  bajo: "< 4",
  moderado: "4–10",
  optimo: "10–20",
  alto: "> 20",
}

const fechaLocal = (valor: string) => formatShortDate(toLocalIsoDate(new Date(valor)))

const formatearKg = (valor: number) =>
  `${Math.round(valor).toLocaleString("es-CL")} kg`

export function SeguimientoView() {
  const [modo, setModo] = useState<ModoCarga>("7d")
  const hoy = toLocalIsoDate()
  const lunesActual = startOfWeek(hoy)
  const [lunes, setLunes] = useState(lunesActual)
  const { carga, cargando, refrescando, error } = useCargaMuscular(modo, lunes)
  const [seleccionada, setSeleccionada] = useState<string | null>(null)

  const zonas = useMemo(() => carga?.zonas ?? [], [carga])
  const trabajadas = useMemo(
    () => zonas.filter((zona) => zona.series > 0).sort((a, b) => b.series - a.series),
    [zonas],
  )
  const sinTrabajo = zonas.filter((zona) => zona.series === 0)
  const zonaActiva = zonas.find((zona) => zona.codigo === seleccionada) ?? trabajadas[0] ?? null
  const escala = Math.max(20, ...trabajadas.map((zona) => zona.series))

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <section className="rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="radiogroup"
            aria-label="Periodo"
            className="grid grid-cols-2 gap-1 rounded-xl bg-[color:var(--surface-low)] p-1 sm:w-80"
          >
            {(
              [
                { valor: "7d", etiqueta: "Últimos 7 días" },
                { valor: "semana", etiqueta: "Lun a dom" },
              ] as const
            ).map((opcion) => (
              <button
                key={opcion.valor}
                type="button"
                role="radio"
                aria-checked={modo === opcion.valor}
                onClick={() => setModo(opcion.valor)}
                className={cn(
                  "min-h-11 rounded-lg text-sm transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none",
                  modo === opcion.valor
                    ? "bg-[color:var(--surface-lowest)] font-medium text-foreground shadow-[var(--shadow-airy)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opcion.etiqueta}
              </button>
            ))}
          </div>

          {modo === "semana" ? (
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-11 p-0"
                aria-label="Semana anterior"
                onClick={() => setLunes(addDays(lunes, -7))}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <p className="text-center text-sm font-medium tabular-nums">
                {formatShortDate(lunes)} – {formatShortDate(addDays(lunes, 6))}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-11 p-0"
                aria-label="Semana siguiente"
                disabled={lunes >= lunesActual}
                onClick={() => setLunes(addDays(lunes, 7))}
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Acumulado continuo hasta hoy, sin reinicio los lunes.
            </p>
          )}
        </div>

        {error && !carga ? (
          <p className="mt-6 text-sm text-[color:var(--destructive)]">{getFriendlyErrorMessage(error)}</p>
        ) : null}

        {cargando && !carga ? (
          <div className="mt-6 h-80 animate-pulse rounded-xl bg-[color:var(--surface-low)]" aria-hidden />
        ) : null}

        {carga ? (
          <div className={cn("mt-5 transition-opacity", refrescando && "opacity-70")}>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              <span className="font-semibold text-foreground">{carga.sesiones}</span>{" "}
              {carga.sesiones === 1 ? "sesión" : "sesiones"} ·{" "}
              <span className="font-semibold text-foreground">{carga.series_trabajo}</span> series de trabajo
            </p>

            <div className="mt-4 grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
              <MapaCuerpo
                zonas={zonas}
                seleccionada={zonaActiva?.codigo ?? null}
                onSeleccionar={setSeleccionada}
              />
              {zonaActiva ? <DetalleZona zona={zonaActiva} /> : null}
            </div>

            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2" aria-label="Niveles de carga">
              {NIVELES_CARGA.map((nivel) => (
                <li key={nivel} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MuestraNivel nivel={nivel} />
                  <span className="text-foreground">{ETIQUETA_NIVEL[nivel]}</span>
                  <span>{RANGO_NIVEL[nivel]}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Series efectivas por semana: cada serie de trabajo cuenta 1 para el músculo principal
              y 0,5 para los secundarios. Los calentamientos no cuentan.
            </p>
          </div>
        ) : null}
      </section>

      {carga ? (
        <section
          aria-labelledby="carga-por-musculo"
          className="rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5"
        >
          <h2 id="carga-por-musculo" className="text-base font-semibold">
            Carga por músculo
          </h2>
          {trabajadas.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No hay series de trabajo en este periodo.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {trabajadas.map((zona) => (
                <li key={zona.codigo}>
                  <button
                    type="button"
                    onClick={() => setSeleccionada(zona.codigo)}
                    aria-pressed={zonaActiva?.codigo === zona.codigo}
                    className="flex w-full items-center gap-3 py-2.5 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <MuestraNivel nivel={zona.nivel} />
                    <span className="w-28 shrink-0 truncate text-sm font-medium sm:w-36">{zona.nombre}</span>
                    <span className="relative h-2 min-w-0 flex-1 rounded-sm bg-[color:var(--surface-low)]">
                      <span
                        className="absolute inset-y-0 left-0 rounded-sm"
                        style={{
                          width: `${Math.max(3, (zona.series / escala) * 100)}%`,
                          background: "var(--carga-3)",
                        }}
                      />
                    </span>
                    <span className="w-24 shrink-0 text-right text-sm tabular-nums">
                      <span className="font-semibold">{formatearSeries(zona.series)}</span>
                      <span className="text-xs text-muted-foreground"> · {ETIQUETA_NIVEL[zona.nivel]}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {sinTrabajo.length > 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Sin trabajo:</span>{" "}
              {sinTrabajo.map((zona) => zona.nombre).join(", ")}.
            </p>
          ) : null}
        </section>
      ) : null}

      <NotasIA
        nombres={new Map(zonas.map((zona) => [zona.codigo, zona.nombre]))}
        onSeleccionarZona={setSeleccionada}
      />
    </div>
  )
}

function DetalleZona({ zona }: { zona: ZonaCarga }) {
  return (
    <article className="rounded-xl bg-[color:var(--surface-low)] p-4" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">Zona</p>
          <h3 className="mt-1 text-lg font-semibold">{zona.nombre}</h3>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-[color:var(--surface-lowest)] px-2 py-1 text-xs font-medium">
          <MuestraNivel nivel={zona.nivel} />
          {ETIQUETA_NIVEL[zona.nivel]}
          {zona.nivel === "alto" ? <AlertTriangle className="size-3.5" aria-label="Posible sobrecarga" /> : null}
        </span>
      </div>
      <p className="mt-3 font-display text-4xl leading-none tabular-nums">
        {formatearSeries(zona.series)}
        <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">series efectivas</span>
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Directas</dt>
          <dd className="font-semibold tabular-nums">{zona.directas}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Como secundario</dt>
          <dd className="font-semibold tabular-nums">{zona.indirectas}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Tonelaje</dt>
          <dd className="font-semibold tabular-nums">{zona.tonelaje > 0 ? formatearKg(zona.tonelaje) : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Última vez</dt>
          <dd className="font-semibold">{zona.ultima_vez ? fechaLocal(zona.ultima_vez) : "—"}</dd>
        </div>
      </dl>
      {zona.ejercicios.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground">Ejercicios directos</p>
          <ul className="mt-1 space-y-0.5 text-sm">
            {zona.ejercicios.map((ejercicio) => (
              <li key={ejercicio} className="truncate">
                {ejercicio}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  )
}

const TIPOS: Record<string, { etiqueta: string; icono: typeof Activity }> = {
  seguimiento: { etiqueta: "Seguimiento", icono: Activity },
  sugerencia: { etiqueta: "Sugerencia", icono: Lightbulb },
  alerta: { etiqueta: "Alerta", icono: AlertTriangle },
  plan: { etiqueta: "Plan", icono: ListChecks },
}

function NotasIA({
  nombres,
  onSeleccionarZona,
}: {
  nombres: Map<string, string>
  onSeleccionarZona: (codigo: string) => void
}) {
  const { seguimientos, cargando, eliminar, eliminando } = useSeguimientos()
  const [confirmando, setConfirmando] = useState<number | null>(null)

  const borrar = async (nota: Seguimiento) => {
    try {
      await eliminar(nota.id_seguimiento)
      toast.success("Nota eliminada")
    } catch (error) {
      toast.error("No pudimos eliminar la nota", { description: getFriendlyErrorMessage(error) })
    } finally {
      setConfirmando(null)
    }
  }

  return (
    <section
      aria-labelledby="notas-ia"
      className="rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-[color:var(--module-entrenamientos)]" aria-hidden />
        <h2 id="notas-ia" className="text-base font-semibold">
          Notas de tu asistente
        </h2>
      </div>

      {cargando ? (
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-[color:var(--surface-low)]" aria-hidden />
      ) : seguimientos.length === 0 ? (
        <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
          <p>
            Aquí aparecen los análisis y sugerencias que te deje Claude u otro asistente conectado
            a Ritmo. Pídele, por ejemplo:{" "}
            <span className="text-foreground">
              &ldquo;Revisa mi carga de esta semana y déjame sugerencias en Ritmo&rdquo;
            </span>
            .
          </p>
          <p>
            Para conectarlo ve a{" "}
            <Link href="/app/perfil" className="font-semibold text-foreground underline underline-offset-4">
              Perfil → Conexiones con IA
            </Link>{" "}
            y dale permiso de escritura en entrenamientos.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {seguimientos.map((nota) => {
            const tipo = TIPOS[nota.tipo] ?? TIPOS.seguimiento
            const Icono = tipo.icono
            return (
              <li key={nota.id_seguimiento} className="rounded-xl bg-[color:var(--surface-low)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Icono className="size-3.5" aria-hidden />
                      {tipo.etiqueta}
                      <span aria-hidden>·</span>
                      <span className="font-normal">
                        {fechaLocal(nota.created_at)}
                        {nota.origen ? ` · ${nota.origen}` : ""}
                      </span>
                    </p>
                    <h3 className="mt-1 font-semibold">{nota.titulo}</h3>
                  </div>
                  {confirmando === nota.id_seguimiento ? (
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmando(null)}>
                        No
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={eliminando === nota.id_seguimiento}
                        onClick={() => void borrar(nota)}
                      >
                        Eliminar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Eliminar nota"
                      className="size-11 shrink-0 rounded-full p-0 text-muted-foreground hover:text-[color:var(--destructive)]"
                      onClick={() => setConfirmando(nota.id_seguimiento)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 whitespace-pre-line text-foreground/90">{nota.contenido}</p>
                {nota.zonas.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {nota.zonas.map((codigo) => (
                      <button
                        key={codigo}
                        type="button"
                        onClick={() => {
                          onSeleccionarZona(codigo)
                          window.scrollTo({ top: 0, behavior: "smooth" })
                        }}
                        className="min-h-8 rounded-sm bg-[color:var(--surface-lowest)] px-2.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {nombres.get(codigo) ?? codigo}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
