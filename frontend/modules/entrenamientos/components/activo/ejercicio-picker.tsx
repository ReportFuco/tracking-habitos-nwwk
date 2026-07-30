"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { EjercicioMedia } from "@/modules/entrenamientos/components/ejercicio-media"
import {
  Chip,
  describirGrupoEjercicio,
  normalizarTexto,
} from "@/modules/entrenamientos/components/activo/shared"
import type {
  EjercicioResponse,
  Musculo,
} from "@/modules/entrenamientos/types/entrenamientos"

// El catalogo son mas de mil ejercicios: pintarlos todos de golpe bloquea el hilo
// principal en el telefono. Se muestran de a tandas conforme el usuario baja.
const TAMANO_TANDA = 24

function TarjetaEjercicio({
  ejercicio,
  onSeleccionar,
  priority,
}: {
  ejercicio: EjercicioResponse
  onSeleccionar: (ejercicio: EjercicioResponse) => void
  priority: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onSeleccionar(ejercicio)}
      className="flex min-h-18 w-full touch-manipulation items-center gap-3 rounded-[1.15rem] bg-surface-lowest p-2.5 text-left shadow-(--shadow-airy) transition duration-200 hover:shadow-(--shadow-airy-lg) focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.99]"
    >
      <EjercicioMedia src={ejercicio.url_imagen} alt="" size={52} priority={priority} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="line-clamp-2 text-sm leading-snug font-medium text-foreground">
          {ejercicio.nombre}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {ejercicio.equipamiento ?? describirGrupoEjercicio(ejercicio)}
        </p>
      </div>
    </button>
  )
}

/**
 * Eleccion del ejercicio a registrar.
 *
 * Reemplaza a los dos desplegables encadenados que habia antes. El musculo pasa a ser una
 * fila de chips -- se ve de un vistazo que grupos hay y cuantos ejercicios tiene cada uno,
 * sin abrir nada -- y el ejercicio se elige por su imagen, que es como se reconoce un
 * movimiento cuando no se recuerda como se llama.
 */
export function EjercicioPicker({
  ejercicios,
  musculos,
  cargando,
  recientes,
  onSeleccionar,
  onCancelar,
  titulo,
  descripcion,
}: {
  ejercicios: EjercicioResponse[]
  musculos: Musculo[]
  cargando: boolean
  /** Ejercicios ya usados en esta sesion; volver a uno es el gesto mas repetido. */
  recientes: EjercicioResponse[]
  onSeleccionar: (ejercicio: EjercicioResponse) => void
  onCancelar?: () => void
  titulo: string
  descripcion: string
}) {
  const [busqueda, setBusqueda] = useState("")
  const [idMusculo, setIdMusculo] = useState<number | null>(null)
  const [tanda, setTanda] = useState({ clave: "", visibles: TAMANO_TANDA })

  const centinela = useRef<HTMLDivElement | null>(null)

  // Solo se ofrecen los grupos que tienen ejercicios cargados: un chip que no devuelve
  // nada al tocarlo es una promesa rota.
  const gruposConEjercicios = useMemo(() => {
    const conteo = new Map<number, number>()

    for (const ejercicio of ejercicios) {
      if (ejercicio.id_musculo != null) {
        conteo.set(ejercicio.id_musculo, (conteo.get(ejercicio.id_musculo) ?? 0) + 1)
      }
    }

    return musculos
      .filter((musculo) => musculo.activo && conteo.has(musculo.id_musculo))
      .map((musculo) => ({ musculo, total: conteo.get(musculo.id_musculo) ?? 0 }))
  }, [ejercicios, musculos])

  const termino = normalizarTexto(busqueda)

  const filtrados = useMemo(() => {
    if (idMusculo === null && !termino) {
      return ejercicios
    }

    return ejercicios.filter((ejercicio) => {
      if (idMusculo !== null && ejercicio.id_musculo !== idMusculo) {
        return false
      }

      if (!termino) {
        return true
      }

      // El catalogo guarda el nombre original en ingles: buscar "bench press" tiene que
      // encontrar "Press de banca con barra".
      return (
        normalizarTexto(ejercicio.nombre).includes(termino) ||
        normalizarTexto(ejercicio.nombre_original).includes(termino) ||
        normalizarTexto(ejercicio.equipamiento).includes(termino)
      )
    })
  }, [ejercicios, idMusculo, termino])

  // Cuantos se muestran va atado a los filtros con los que se conto: si cambian, el valor
  // guardado deja de aplicar y se vuelve a la primera tanda sin un efecto que recorte la
  // lista en un segundo render.
  const clave = `${idMusculo ?? ""}|${termino}`
  const visibles = tanda.clave === clave ? tanda.visibles : TAMANO_TANDA

  useEffect(() => {
    const nodo = centinela.current

    if (!nodo || visibles >= filtrados.length) {
      return
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) {
          setTanda({ clave, visibles: visibles + TAMANO_TANDA })
        }
      },
      // Se adelanta a que el centinela entre en pantalla para que la lista no se corte.
      { rootMargin: "600px" },
    )

    observador.observe(nodo)
    return () => observador.disconnect()
  }, [clave, visibles, filtrados.length])

  const mostrados = filtrados.slice(0, visibles)
  const hayFiltro = idMusculo !== null || termino !== ""

  return (
    <section className="rounded-[1.5rem] bg-surface-lowest shadow-(--shadow-airy-lg) sm:rounded-[1.75rem]">
      <div className="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 font-label text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-[0.68rem]">
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ background: "var(--module-entrenamientos)" }}
              />
              {titulo}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{descripcion}</p>
          </div>
          {onCancelar ? (
            <Button variant="ghost" size="sm" onClick={onCancelar} className="shrink-0">
              Cancelar
            </Button>
          ) : null}
        </div>

        {recientes.length > 0 ? (
          <div className="space-y-2">
            <p className="font-label text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              En esta sesion
            </p>
            {/* Scroll horizontal en vez de envolver: no empuja el catalogo hacia abajo. */}
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6">
              {recientes.map((ejercicio) => (
                <button
                  key={ejercicio.id_ejercicio}
                  type="button"
                  onClick={() => onSeleccionar(ejercicio)}
                  className="flex w-20 shrink-0 touch-manipulation flex-col items-center gap-1.5 rounded-[1rem] p-1 text-center transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-95"
                >
                  <EjercicioMedia src={ejercicio.url_imagen} alt="" size={56} />
                  <span className="line-clamp-2 text-[11px] leading-tight text-muted-foreground">
                    {ejercicio.nombre}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            inputMode="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar ejercicio o equipo..."
            aria-label="Buscar ejercicio"
            className="h-12 w-full rounded-3xl border-0 bg-surface-variant pr-11 pl-11 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring sm:text-sm"
          />
          {busqueda ? (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              aria-label="Limpiar busqueda"
              className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6">
          <Chip activo={idMusculo === null} onClick={() => setIdMusculo(null)}>
            Todos
          </Chip>
          {gruposConEjercicios.map(({ musculo, total }) => (
            <Chip
              key={musculo.id_musculo}
              activo={idMusculo === musculo.id_musculo}
              onClick={() =>
                setIdMusculo(idMusculo === musculo.id_musculo ? null : musculo.id_musculo)
              }
            >
              {musculo.nombre}
              <span
                className={
                  idMusculo === musculo.id_musculo
                    ? "text-[11px] opacity-70"
                    : "text-[11px] text-muted-foreground/60"
                }
              >
                {total}
              </span>
            </Chip>
          ))}
        </div>

        {cargando && ejercicios.length === 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 6 }, (_, indice) => (
              <div
                key={indice}
                className="flex min-h-18 items-center gap-3 rounded-[1.15rem] bg-surface-lowest p-2.5 shadow-(--shadow-airy)"
              >
                <Skeleton className="size-13 shrink-0 rounded-[0.9rem]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="rounded-[1.25rem] bg-surface-low p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Ningun ejercicio coincide con la busqueda.
            </p>
            {hayFiltro ? (
              <Button
                variant="ghost"
                className="mt-2 min-h-11"
                onClick={() => {
                  setBusqueda("")
                  setIdMusculo(null)
                }}
              >
                Limpiar filtros
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {mostrados.map((ejercicio, indice) => (
                <TarjetaEjercicio
                  key={ejercicio.id_ejercicio}
                  ejercicio={ejercicio}
                  onSeleccionar={onSeleccionar}
                  // Las primeras entran con la pagina; el resto al acercarse.
                  priority={indice < 4}
                />
              ))}
            </div>
            <div ref={centinela} aria-hidden className="h-px" />
          </>
        )}
      </div>
    </section>
  )
}
