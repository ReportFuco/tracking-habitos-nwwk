"use client"

import { type CSSProperties, useEffect, useMemo, useState } from "react"
import { CalendarCheck, ChevronRight, Flame } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  esConMancuernas,
  ordenarSeries,
} from "@/modules/entrenamientos/components/activo/shared"
import {
  CalendarioSemanas,
  inicioDeSemana,
  rangoSemana,
  sumarDias,
} from "@/modules/entrenamientos/components/calendario-semanas"
import { useEntrenamientos } from "@/modules/entrenamientos/hooks/useEntrenamientos"

const formatDate = (value: string) => {
  try {
    return new Intl.DateTimeFormat("es-CL", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value))
  } catch {
    return value
  }
}

const formatDateShort = (value: string) => {
  try {
    return new Intl.DateTimeFormat("es-CL", {
      dateStyle: "medium",
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function HistoricoFuerza() {
  const { entrenamientosFuerza, fetchEntrenosFuerza, fetchDetalleEntrenoFuerza, loading } = useEntrenamientos()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchDetalleEntrenoFuerza>> | null>(null)
  const [semana, setSemana] = useState(() => inicioDeSemana(new Date()))

  useEffect(() => {
    if (entrenamientosFuerza.length === 0) {
      void fetchEntrenosFuerza()
    }
  }, [entrenamientosFuerza.length, fetchEntrenosFuerza])

  const sesionesCerradas = entrenamientosFuerza.filter((entreno) => entreno.estado !== "activo")
  // El calendario marca tambien la sesion en curso: hoy ya se entreno aunque no se cierre.
  const fechasEntreno = useMemo(
    () => entrenamientosFuerza.map((entreno) => entreno.inicio_at),
    [entrenamientosFuerza],
  )
  // El listado sigue a la semana elegida en el calendario, de la mas reciente a la mas
  // antigua: el backend no garantiza orden.
  const sesionesSemana = useMemo(() => {
    const desde = semana.getTime()
    const hasta = sumarDias(semana, 7).getTime()

    return sesionesCerradas
      .filter((entreno) => {
        const inicio = new Date(entreno.inicio_at).getTime()
        return inicio >= desde && inicio < hasta
      })
      .sort((a, b) => new Date(b.inicio_at).getTime() - new Date(a.inicio_at).getTime())
  }, [sesionesCerradas, semana])
  const seriesDetalle = useMemo(() => ordenarSeries(detail?.series ?? []), [detail?.series])
  const totalSeriesDetalle = detail?.series?.length ?? 0

  const handleSelect = async (idEntrenamientoFuerza: number) => {
    const data = await fetchDetalleEntrenoFuerza(idEntrenamientoFuerza)
    setSelectedId(idEntrenamientoFuerza)
    setDetail(data)
  }

  return (
    <section className="grid gap-4 sm:gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <div className="space-y-4 sm:space-y-6">
        <section className="rounded-2xl bg-[color:var(--surface-low)] p-4 sm:rounded-3xl sm:p-6">
          <div className="hidden sm:block">
            <p className="font-label text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
              Diario de sesiones
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl sm:tracking-[-0.03em]">
              Tus entrenamientos anteriores toman el protagonismo.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Esta vista se dedica a revisar sesiones ya registradas, sin mezclar el registro activo ni el formulario para abrir una nueva.
            </p>
          </div>

          <div className="flex items-center gap-4 sm:mt-5 sm:justify-between sm:rounded-xl sm:bg-[color:var(--surface-lowest)] sm:p-5 sm:shadow-[var(--shadow-airy)]">
            <div className="flex items-center gap-3">
              <span
                className="flex size-10 items-center justify-center rounded-lg sm:size-11"
                style={{
                  background: "color-mix(in oklch, var(--module-entrenamientos) 12%, transparent)",
                  color: "var(--module-entrenamientos)",
                }}
              >
                <Flame className="size-4 sm:size-5" />
              </span>
              <div>
                <p className="font-label text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground sm:text-[0.68rem] sm:tracking-[0.2em]">
                  Sesiones cerradas
                </p>
                <p className="mt-0.5 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {sesionesCerradas.length}
                </p>
              </div>
            </div>

            {detail ? (
              <div className="flex items-center gap-3 border-l border-[color:var(--border)]/30 pl-4 sm:pl-6">
                <span
                  className="flex size-10 items-center justify-center rounded-lg sm:size-11"
                  style={{
                    background: "color-mix(in oklch, var(--module-entrenamientos) 8%, transparent)",
                    color: "var(--module-entrenamientos)",
                  }}
                >
                  <CalendarCheck className="size-4 sm:size-5" />
                </span>
                <div>
                  <p className="font-label text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground sm:text-[0.68rem] sm:tracking-[0.2em]">
                    Series visibles
                  </p>
                  <p className="mt-0.5 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                    {totalSeriesDetalle}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <CalendarioSemanas
          fechas={fechasEntreno}
          semana={semana}
          onSeleccionarSemana={setSemana}
        />

        <section className="rounded-2xl bg-[color:var(--surface-low)] p-4 sm:rounded-3xl sm:p-6">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-2">
            <div>
              <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-[0.7rem] sm:tracking-[0.22em]">
                Registro
              </p>
              <h3
                key={semana.getTime()}
                className="ritmo-entrada mt-1 text-lg font-semibold tracking-tight text-foreground sm:mt-2 sm:text-2xl"
              >
                Semana del {rangoSemana(semana)}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {sesionesSemana.length}{" "}
              {sesionesSemana.length === 1 ? "sesion cerrada" : "sesiones cerradas"}
            </p>
          </div>

          {loading && !detail && sesionesCerradas.length === 0 ? (
            <div className="mt-4 rounded-xl bg-[color:var(--surface-lowest)] p-5 text-sm text-muted-foreground shadow-[var(--shadow-airy)] sm:mt-6 sm:rounded-2xl sm:p-6">
              Cargando entrenamientos...
            </div>
          ) : sesionesCerradas.length === 0 ? (
            <div className="mt-4 rounded-xl bg-[color:var(--surface-lowest)] p-5 text-sm leading-6 text-muted-foreground shadow-[var(--shadow-airy)] sm:mt-6 sm:rounded-2xl sm:p-6">
              Todavia no tienes entrenamientos anteriores. Cuando cierres una sesion activa, aparecera aqui.
            </div>
          ) : sesionesSemana.length === 0 ? (
            <div
              key={semana.getTime()}
              className="ritmo-entrada mt-4 rounded-xl bg-[color:var(--surface-lowest)] p-5 text-sm leading-6 text-muted-foreground shadow-[var(--shadow-airy)] sm:mt-6 sm:rounded-2xl sm:p-6"
            >
              No hay sesiones cerradas esta semana. Elige otra en el calendario.
            </div>
          ) : (
            <>
              <div className="mt-6 hidden overflow-hidden rounded-2xl bg-[color:var(--surface-lowest)] lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="border-0 bg-[color:var(--surface-low)] hover:bg-transparent">
                      <TableHead className="px-8 py-4 font-label text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                        Sesion
                      </TableHead>
                      <TableHead className="px-6 py-4 font-label text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                        Gimnasio
                      </TableHead>
                      <TableHead className="px-6 py-4 font-label text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                        Estado
                      </TableHead>
                      <TableHead className="px-6 py-4 font-label text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                        Cierre
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody key={semana.getTime()}>
                    {sesionesSemana.map((entreno, indice) => {
                      const isSelected = entreno.id_entrenamiento_fuerza === selectedId
                      return (
                        <TableRow
                          key={entreno.id_entrenamiento_fuerza}
                          role="button"
                          tabIndex={0}
                          style={{ "--i": indice } as CSSProperties}
                          className={cn(
                            "ritmo-entrada cursor-pointer border-0 transition-colors duration-300",
                            isSelected
                              ? "bg-[color:color-mix(in_oklch,var(--module-entrenamientos)_8%,transparent)]"
                              : "hover:bg-[color:color-mix(in_oklch,var(--module-entrenamientos)_4%,transparent)]"
                          )}
                          onClick={() => void handleSelect(entreno.id_entrenamiento_fuerza)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              void handleSelect(entreno.id_entrenamiento_fuerza)
                            }
                          }}
                        >
                          <TableCell className="px-8 py-5 align-top">
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">
                                Sesion #{entreno.id_entrenamiento_fuerza}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(entreno.inicio_at)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-5">
                            <div>
                              <p className="text-foreground">{entreno.nombre_gimnasio ?? "Sin gimnasio"}</p>
                              <p className="text-sm text-muted-foreground">{entreno.comuna ?? "-"}</p>
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-5">
                            <span
                              className="inline-flex rounded-sm px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em]"
                              style={{
                                background:
                                  "color-mix(in oklch, var(--module-entrenamientos) 10%, transparent)",
                                color: "var(--module-entrenamientos)",
                              }}
                            >
                              {entreno.estado}
                            </span>
                          </TableCell>
                          <TableCell className="px-6 py-5 text-sm text-muted-foreground">
                            {entreno.fin_at ? formatDate(entreno.fin_at) : "Sin cierre"}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div key={semana.getTime()} className="mt-4 grid gap-3 sm:mt-6 sm:gap-4 lg:hidden">
                {sesionesSemana.map((entreno, indice) => {
                  const isSelected = entreno.id_entrenamiento_fuerza === selectedId
                  return (
                    <article
                      key={entreno.id_entrenamiento_fuerza}
                      style={{ "--i": indice } as CSSProperties}
                      className={cn(
                        "ritmo-entrada cursor-pointer rounded-xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] transition duration-300 ease-out active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 sm:rounded-2xl sm:p-5",
                        isSelected
                          ? "ring-2 ring-[color:var(--module-entrenamientos)]/40"
                          : "hover:-translate-y-0.5 hover:shadow-[var(--shadow-airy-lg)]"
                      )}
                      role="button"
                      tabIndex={0}
                      onClick={() => void handleSelect(entreno.id_entrenamiento_fuerza)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          void handleSelect(entreno.id_entrenamiento_fuerza)
                        }
                      }}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
                              {entreno.nombre_gimnasio ?? "Sin gimnasio"}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                              {formatDateShort(entreno.inicio_at)}
                            </p>
                          </div>
                          <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex rounded-sm px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] sm:px-2.5 sm:py-1 sm:text-[11px] sm:tracking-[0.18em]"
                            style={{
                              background:
                                "color-mix(in oklch, var(--module-entrenamientos) 10%, transparent)",
                              color: "var(--module-entrenamientos)",
                            }}
                          >
                            {entreno.estado}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {entreno.fin_at ? `Cerrada · ${formatDateShort(entreno.fin_at)}` : "Sin cierre"}
                          </span>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          )}
        </section>
      </div>

      <section className="rounded-2xl bg-[color:var(--surface-low)] p-4 sm:rounded-3xl sm:p-6">
        <div>
          <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-[0.7rem] sm:tracking-[0.22em]">
            Detalle
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:mt-2 sm:text-2xl">
            Sesion seleccionada
          </h3>
        </div>

        <div className="mt-4 sm:mt-6">
          {loading && !detail ? (
            <div className="rounded-xl bg-[color:var(--surface-lowest)] p-5 text-sm text-muted-foreground shadow-[var(--shadow-airy)] sm:rounded-2xl sm:p-6">
              Cargando detalle...
            </div>
          ) : detail ? (
            <div key={selectedId ?? "detalle"} className="ritmo-entrada space-y-3 sm:space-y-4">
              <article className="rounded-xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:rounded-2xl sm:p-5">
                <div className="space-y-2">
                  <span
                    className="inline-flex rounded-sm px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em]"
                    style={{
                      background: "color-mix(in oklch, var(--module-entrenamientos) 10%, transparent)",
                      color: "var(--module-entrenamientos)",
                    }}
                  >
                    Sesion #{selectedId}
                  </span>
                  <h4 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                    {detail.nombre_gimnasio ?? "Sin gimnasio"}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {detail.nombre_cadena ?? "Cadena no informada"} · {detail.comuna ?? "Sin comuna"}
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-[color:var(--surface-low)] p-3 sm:rounded-xl sm:p-4">
                    <p className="font-label text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground sm:text-[0.68rem] sm:tracking-[0.2em]">
                      Inicio
                    </p>
                    <p className="mt-1.5 text-sm text-foreground sm:mt-2">{formatDate(detail.inicio_at)}</p>
                  </div>
                  <div className="rounded-lg bg-[color:var(--surface-low)] p-3 sm:rounded-xl sm:p-4">
                    <p className="font-label text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground sm:text-[0.68rem] sm:tracking-[0.2em]">
                      Cierre
                    </p>
                    <p className="mt-1.5 text-sm text-foreground sm:mt-2">
                      {detail.fin_at ? formatDate(detail.fin_at) : "Sin cierre"}
                    </p>
                  </div>
                </div>
              </article>

              <div className="space-y-2 sm:space-y-3">
                {seriesDetalle.length === 0 ? (
                  <div className="rounded-xl bg-[color:var(--surface-lowest)] p-5 text-sm leading-6 text-muted-foreground shadow-[var(--shadow-airy)] sm:rounded-2xl sm:p-6">
                    Esta sesion no tiene series registradas.
                  </div>
                ) : (
                  seriesDetalle.map((serie, indice) => (
                    <article
                      key={serie.id_fuerza_detalle}
                      // Tope al escalonado: una sesion larga no deberia tardar en terminar de entrar.
                      style={{ "--i": Math.min(indice + 1, 12) } as CSSProperties}
                      className="ritmo-entrada rounded-xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:rounded-2xl sm:p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                "inline-flex rounded-sm px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] sm:text-[11px] sm:tracking-[0.18em]"
                              )}
                              style={
                                serie.es_calentamiento
                                  ? {
                                      background:
                                        "color-mix(in oklch, var(--module-entrenamientos) 10%, transparent)",
                                      color: "var(--module-entrenamientos)",
                                    }
                                  : {
                                      background: "color-mix(in oklch, var(--foreground) 5%, transparent)",
                                      color: "var(--foreground)",
                                    }
                              }
                            >
                              {serie.es_calentamiento ? "calentamiento" : "trabajo"}
                            </span>
                            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:text-xs sm:tracking-[0.18em]">
                              {serie.subcategoria_ejercicio && serie.subcategoria_ejercicio.toLowerCase() !== "general"
                                ? `${serie.tipo_ejercicio ?? "sin grupo"} / ${serie.subcategoria_ejercicio}`
                                : serie.tipo_ejercicio ?? "sin grupo"}
                            </span>
                          </div>
                          <p className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
                            {serie.nombre_ejercicio ?? `Serie #${serie.id_fuerza_detalle}`}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                            {serie.cantidad_peso}{" "}
                            <span className="text-sm text-muted-foreground">
                              {esConMancuernas(serie.equipamiento_ejercicio) ? "kg c/u" : "kg"}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground sm:text-sm">
                            {serie.repeticiones} reps
                            {serie.repeticiones_negativas
                              ? ` + ${serie.repeticiones_negativas} neg.`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-[color:var(--surface-lowest)] p-5 text-sm leading-6 text-muted-foreground shadow-[var(--shadow-airy)] sm:rounded-2xl sm:p-6">
              Selecciona una sesion del listado para revisar su detalle y las series asociadas.
            </div>
          )}
        </div>
      </section>
    </section>
  )
}
