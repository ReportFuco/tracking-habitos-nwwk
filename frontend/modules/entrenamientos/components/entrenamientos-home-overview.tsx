"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Activity, ChevronRight, Dumbbell, History, MapPin, Play } from "lucide-react"
import { MenuGroup, MenuList, MenuRow } from "@/components/shell/menu-group"
import { datePart, formatShortDate, startOfWeek, toLocalIsoDate } from "@/lib/dates"
import { useEntrenamientos } from "@/modules/entrenamientos/hooks/useEntrenamientos"
import { entrenosFuerzaQueryOptions } from "@/modules/entrenamientos/queries"

/**
 * Portada de entrenamientos en dos grupos: registrar (abrir o retomar la sesion) y
 * consultar (lo demas, una fila por seccion con su dato del momento). Cabe en una
 * pantalla de telefono sin scroll.
 */
export function EntrenamientosHomeOverview() {
  const { entrenamientoActivo } = useEntrenamientos()
  const entrenosQuery = useQuery(entrenosFuerzaQueryOptions())

  const entrenos = entrenosQuery.data ?? []
  const weekStart = startOfWeek(toLocalIsoDate())
  const semana = entrenos.filter((entreno) => datePart(entreno.inicio_at) >= weekStart).length
  const ultimo = entrenos
    .filter((entreno) => entreno.fin_at !== null)
    .sort((a, b) => b.inicio_at.localeCompare(a.inicio_at))[0]
  const historialDetalle = entrenosQuery.data
    ? `${semana} ${semana === 1 ? "sesion" : "sesiones"} esta semana${ultimo ? ` · ultima el ${formatShortDate(ultimo.inicio_at)}` : ""}`
    : "Sesiones cerradas y sus series"

  return (
    <div className="flex flex-col gap-5">
      <MenuGroup title="Registrar">
        <Link
          href={entrenamientoActivo ? "/app/entrenamientos/activo" : "/app/entrenamientos/registrar"}
          className="group flex min-h-18 items-center gap-3 rounded-xl bg-[color:var(--module-entrenamientos-fill)] px-4 py-3 text-[color:var(--module-entrenamientos-on)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-black/15">
            {entrenamientoActivo ? <Play className="size-5" aria-hidden /> : <Dumbbell className="size-5" aria-hidden />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-display text-lg leading-tight">
              {entrenamientoActivo ? "Continuar sesion" : "Empezar entrenamiento"}
            </span>
            <span className="truncate text-xs opacity-85">
              {entrenamientoActivo
                ? `En curso${entrenamientoActivo.nombre_gimnasio ? ` en ${entrenamientoActivo.nombre_gimnasio}` : ""}`
                : "Abre la sesion y carga las series ahi mismo"}
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 transition group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
        </Link>
      </MenuGroup>

      <MenuGroup title="Consultar">
        <MenuList>
          <MenuRow
            href="/app/entrenamientos/seguimiento"
            icon={Activity}
            title="Seguimiento"
            detail="Carga por musculo y sugerencias"
            module="entrenamientos"
          />
          <MenuRow
            href="/app/entrenamientos/historico"
            icon={History}
            title="Historial"
            detail={historialDetalle}
            module="entrenamientos"
          />
          <MenuRow
            href="/app/entrenamientos/ejercicios"
            icon={Dumbbell}
            title="Ejercicios"
            detail="Tecnica por musculo o equipo"
            module="entrenamientos"
          />
          <MenuRow
            href="/app/entrenamientos/gimnasios"
            icon={MapPin}
            title="Gimnasios"
            detail="Directorio de gimnasios"
            module="entrenamientos"
          />
        </MenuList>
      </MenuGroup>
    </div>
  )
}
