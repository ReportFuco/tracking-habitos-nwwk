"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Plus, Search, SlidersHorizontal, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { EjercicioCard } from "@/modules/entrenamientos/components/ejercicio-card"
import { EjercicioDetalleDialog } from "@/modules/entrenamientos/components/ejercicio-detalle-dialog"
import {
  EjercicioFormDialog,
  type EjercicioFormState,
} from "@/modules/entrenamientos/components/ejercicio-form-dialog"
import {
  useEjerciciosCatalogo,
  useEjerciciosMutations,
  useEquipamientos,
  useMusculosCatalogo,
} from "@/modules/entrenamientos/hooks/useEjercicios"
import {
  ejercicioCreateSchema,
  ejercicioEditSchema,
} from "@/modules/entrenamientos/schemas/entrenamientos.schema"
import type { EjercicioResponse } from "@/modules/entrenamientos/types/entrenamientos"

// El catalogo son mas de mil ejercicios: pintarlos todos de golpe bloquea el hilo
// principal en el telefono. Se muestran de a tandas conforme el usuario baja.
const TAMANO_TANDA = 30

function Chip({
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
        "inline-flex min-h-11 shrink-0 touch-manipulation items-center rounded-full px-4 text-sm whitespace-nowrap transition duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
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

function TarjetaEsqueleto() {
  return (
    <div className="flex min-h-20 items-center gap-3 rounded-[1.25rem] bg-surface-lowest p-3 shadow-(--shadow-airy)">
      <Skeleton className="size-16 shrink-0 rounded-[0.9rem]" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

export function EjerciciosCatalogo() {
  const [busqueda, setBusqueda] = useState("")
  const [busquedaAplicada, setBusquedaAplicada] = useState("")
  const [idMusculo, setIdMusculo] = useState<number | null>(null)
  const [equipamiento, setEquipamiento] = useState<string | null>(null)
  const [verFiltros, setVerFiltros] = useState(false)
  const [tanda, setTanda] = useState<{ filtros: object; visibles: number }>({
    filtros: {},
    visibles: TAMANO_TANDA,
  })

  const [seleccionado, setSeleccionado] = useState<EjercicioResponse | null>(null)
  const [editando, setEditando] = useState<EjercicioResponse | null>(null)
  const [formAbierto, setFormAbierto] = useState(false)

  const centinela = useRef<HTMLDivElement | null>(null)

  // El buscador espera a que el usuario deje de escribir: sin esto cada tecla dispara una
  // peticion y una entrada nueva en el cache persistido.
  useEffect(() => {
    const temporizador = setTimeout(() => setBusquedaAplicada(busqueda.trim()), 300)
    return () => clearTimeout(temporizador)
  }, [busqueda])

  const filtros = useMemo(
    () => ({
      ...(busquedaAplicada ? { q: busquedaAplicada } : {}),
      ...(idMusculo !== null ? { id_musculo: idMusculo } : {}),
      ...(equipamiento !== null ? { equipamiento } : {}),
    }),
    [busquedaAplicada, idMusculo, equipamiento],
  )

  const { ejercicios, cargando, refrescando } = useEjerciciosCatalogo(filtros)
  const musculos = useMusculosCatalogo()
  const equipamientos = useEquipamientos()
  const { crear, editar, eliminar, guardando } = useEjerciciosMutations()

  // Cuantos se muestran va atado a los filtros con los que se conto: si cambian, el
  // valor guardado deja de aplicar y se vuelve solo a la primera tanda, sin un efecto que
  // recorte la lista en un segundo render.
  const visibles = tanda.filtros === filtros ? tanda.visibles : TAMANO_TANDA

  const mostrarMas = () => setTanda({ filtros, visibles: visibles + TAMANO_TANDA })

  useEffect(() => {
    const nodo = centinela.current

    if (!nodo || visibles >= ejercicios.length) {
      return
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) {
          mostrarMas()
        }
      },
      // Se adelanta a que el centinela entre en pantalla para que la lista no se corte.
      { rootMargin: "600px" },
    )

    observador.observe(nodo)
    return () => observador.disconnect()
    // mostrarMas se recrea en cada render, pero solo se usa dentro del callback: basta
    // con volver a observar cuando cambia lo que ya se mostro o la lista de resultados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibles, ejercicios.length, filtros])

  const hayFiltros = idMusculo !== null || equipamiento !== null || busquedaAplicada !== ""

  const limpiarFiltros = () => {
    setBusqueda("")
    setBusquedaAplicada("")
    setIdMusculo(null)
    setEquipamiento(null)
  }

  const abrirNuevo = () => {
    setEditando(null)
    setFormAbierto(true)
  }

  const abrirEdicion = (ejercicio: EjercicioResponse) => {
    setSeleccionado(null)
    setEditando(ejercicio)
    setFormAbierto(true)
  }

  const guardar = async (valores: EjercicioFormState) => {
    const base = {
      nombre: valores.nombre.trim(),
      id_subcategoria_musculo: Number(valores.id_subcategoria_musculo),
      url_video: valores.url_video.trim() || "",
    }

    const validado = editando
      ? ejercicioEditSchema.safeParse({ ...base, url_video: base.url_video || null })
      : ejercicioCreateSchema.safeParse(base)

    if (!validado.success) {
      toast.error("Revisa los datos", {
        description: validado.error.issues[0]?.message,
      })
      return
    }

    try {
      if (editando) {
        await editar.mutateAsync({
          idEjercicio: editando.id_ejercicio,
          payload: {
            nombre: validado.data.nombre?.trim() || null,
            id_subcategoria_musculo: validado.data.id_subcategoria_musculo ?? null,
            url_video: validado.data.url_video ? validado.data.url_video.trim() : null,
          },
        })
        toast.success("Ejercicio actualizado")
      } else {
        await crear.mutateAsync({
          nombre: base.nombre,
          id_subcategoria_musculo: base.id_subcategoria_musculo,
          ...(base.url_video ? { url_video: base.url_video } : {}),
        })
        toast.success("Ejercicio creado")
      }

      setFormAbierto(false)
      setEditando(null)
    } catch (error) {
      toast.error(editando ? "No se pudo actualizar" : "No se pudo crear", {
        description: getFriendlyErrorMessage(error),
      })
    }
  }

  const borrar = async (ejercicio: EjercicioResponse) => {
    try {
      await eliminar.mutateAsync(ejercicio.id_ejercicio)
      toast.success("Ejercicio eliminado")
      setSeleccionado(null)
    } catch {
      toast.error("No se pudo eliminar", {
        description: "Puede estar asociado a series ya registradas.",
      })
    }
  }

  const mostrados = ejercicios.slice(0, visibles)

  return (
    <section className="space-y-4">
      {/* La barra queda fija al hacer scroll: con mil ejercicios, volver arriba para
          cambiar un filtro es el gesto que mas se repite. */}
      <div className="sticky top-0 z-20 -mx-4 space-y-3 bg-background/85 px-4 pt-1 pb-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
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
              aria-label="Buscar en el catalogo de ejercicios"
              className="h-13 w-full rounded-3xl border-0 bg-surface-variant pr-11 pl-11 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring sm:text-sm"
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

          <Button
            variant={verFiltros || hayFiltros ? "secondary" : "outline"}
            size="icon"
            aria-label="Filtros"
            aria-expanded={verFiltros}
            className="size-13 shrink-0 rounded-3xl"
            onClick={() => setVerFiltros((previo) => !previo)}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
          </Button>

          <Button
            size="icon"
            aria-label="Nuevo ejercicio"
            className="size-13 shrink-0 rounded-3xl"
            onClick={abrirNuevo}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>

        {verFiltros ? (
          <div className="space-y-2.5">
            {/* Scroll horizontal en vez de envolver: mantiene la barra en una linea y no
                empuja la lista hacia abajo en el telefono. */}
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6">
              <Chip activo={idMusculo === null} onClick={() => setIdMusculo(null)}>
                Todos
              </Chip>
              {musculos
                .filter((musculo) => musculo.activo)
                .map((musculo) => (
                  <Chip
                    key={musculo.id_musculo}
                    activo={idMusculo === musculo.id_musculo}
                    onClick={() =>
                      setIdMusculo(idMusculo === musculo.id_musculo ? null : musculo.id_musculo)
                    }
                  >
                    {musculo.nombre}
                  </Chip>
                ))}
            </div>

            {equipamientos.length > 0 ? (
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6">
                <Chip activo={equipamiento === null} onClick={() => setEquipamiento(null)}>
                  Todo el equipo
                </Chip>
                {equipamientos.map((item) => (
                  <Chip
                    key={item}
                    activo={equipamiento === item}
                    onClick={() => setEquipamiento(equipamiento === item ? null : item)}
                  >
                    {item}
                  </Chip>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
            {cargando
              ? "Cargando"
              : `${ejercicios.length} ${ejercicios.length === 1 ? "ejercicio" : "ejercicios"}`}
            {refrescando ? " · actualizando" : ""}
          </p>
          {hayFiltros ? (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              Limpiar filtros
            </button>
          ) : null}
        </div>
      </div>

      {cargando ? (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, indice) => (
            <TarjetaEsqueleto key={indice} />
          ))}
        </div>
      ) : ejercicios.length === 0 ? (
        <div className="rounded-[1.5rem] bg-surface-lowest p-8 text-center shadow-(--shadow-airy)">
          <p className="text-sm text-muted-foreground">
            No hay ejercicios que coincidan con la busqueda.
          </p>
          {hayFiltros ? (
            <Button variant="ghost" className="mt-3 min-h-11" onClick={limpiarFiltros}>
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {mostrados.map((ejercicio, indice) => (
              <EjercicioCard
                key={ejercicio.id_ejercicio}
                ejercicio={ejercicio}
                onSelect={setSeleccionado}
                // Las primeras entran con la pagina; el resto se carga al acercarse.
                priority={indice < 6}
              />
            ))}
          </div>
          <div ref={centinela} aria-hidden className="h-px" />
        </>
      )}

      {/* Los dialogos se montan al abrirse y llevan `key`, de modo que cada ficha y cada
          formulario parten con su propio estado en vez de arrastrar el anterior. */}
      {seleccionado ? (
        <EjercicioDetalleDialog
          key={seleccionado.id_ejercicio}
          ejercicio={seleccionado}
          onClose={() => setSeleccionado(null)}
          onEditar={abrirEdicion}
          onEliminar={borrar}
          eliminando={eliminar.isPending}
        />
      ) : null}

      {formAbierto ? (
        <EjercicioFormDialog
          key={editando?.id_ejercicio ?? "nuevo"}
          ejercicio={editando}
          musculos={musculos}
          guardando={guardando}
          onGuardar={guardar}
          onCerrar={() => {
            setFormAbierto(false)
            setEditando(null)
          }}
        />
      ) : null}
    </section>
  )
}
