"use client"

import Link from "next/link"
import { useDeferredValue, useMemo, useState } from "react"
import { ArrowDownLeft, ArrowUpRight, ChevronRight, CloudOff, Plus, Search, X } from "lucide-react"
import { addDays, datePart, formatMonth, toLocalIsoDate } from "@/lib/dates"
import { formatCLP } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  useAnaliticaResumen,
  useFinanzas,
  useMovimientosFiltrados,
} from "@/modules/finanzas/hooks/useFinanzas"
import type { MovimientoResponse, MovimientosFiltros, TipoMovimiento } from "@/modules/finanzas/types/finanzas"
import { PeriodoSelector, usePeriodoMensual } from "./periodo-selector"

type Tipo = "todos" | TipoMovimiento

const TIPOS: { value: Tipo; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "gasto", label: "Gastos" },
  { value: "ingreso", label: "Ingresos" },
]

const diaFormatter = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" })

function etiquetaDia(isoDate: string, hoy: string) {
  if (isoDate === hoy) return "Hoy"
  if (isoDate === addDays(hoy, -1)) return "Ayer"
  const [y, m, d] = isoDate.split("-").map(Number)
  const texto = diaFormatter.format(new Date(Date.UTC(y, m - 1, d))).replace(".", "")
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

interface GrupoDia {
  fecha: string
  movimientos: MovimientoResponse[]
  gasto: number
  ingreso: number
}

function agruparPorDia(movimientos: MovimientoResponse[]): GrupoDia[] {
  const grupos = new Map<string, GrupoDia>()
  for (const movimiento of movimientos) {
    const fecha = datePart(movimiento.created_at)
    const grupo = grupos.get(fecha) ?? { fecha, movimientos: [], gasto: 0, ingreso: 0 }
    grupo.movimientos.push(movimiento)
    if (movimiento.tipo_movimiento === "gasto") grupo.gasto += movimiento.monto
    else grupo.ingreso += movimiento.monto
    grupos.set(fecha, grupo)
  }
  return [...grupos.values()].sort((a, b) => b.fecha.localeCompare(a.fecha))
}

export function MovimientosManager() {
  const { categorias, cuentas, movimientos: principales } = useFinanzas()
  const { periodo, esMesActual, mover } = usePeriodoMensual()
  const [tipo, setTipo] = useState<Tipo>("todos")
  const [idCategoria, setIdCategoria] = useState("")
  const [idCuenta, setIdCuenta] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [buscando, setBuscando] = useState(false)
  const q = useDeferredValue(busqueda.trim())

  const hayFiltrosExtra = tipo !== "todos" || Boolean(idCategoria) || Boolean(idCuenta) || Boolean(q)

  const filtros = useMemo<MovimientosFiltros>(
    () => ({
      year: periodo.year,
      month: periodo.month,
      ...(tipo !== "todos" ? { tipo_movimiento: tipo } : {}),
      ...(idCategoria ? { id_categoria: Number(idCategoria) } : {}),
      ...(idCuenta ? { id_cuenta: Number(idCuenta) } : {}),
      ...(q ? { q } : {}),
    }),
    [periodo, tipo, idCategoria, idCuenta, q],
  )

  const query = useMovimientosFiltrados(filtros)
  const resumenQuery = useAnaliticaResumen({ year: periodo.year, month: periodo.month })

  // Lo anotado sin conexion vive solo en la lista principal: se suma al mes en curso.
  const pendientes = useMemo(
    () => (esMesActual && !hayFiltrosExtra ? principales.filter((m) => m.pendiente_sincronizacion) : []),
    [esMesActual, hayFiltrosExtra, principales],
  )
  const movimientos = useMemo(
    () => [...pendientes, ...(query.data?.pages.flatMap((page) => page.items) ?? [])],
    [pendientes, query.data],
  )
  const grupos = useMemo(() => agruparPorDia(movimientos), [movimientos])
  const hoy = toLocalIsoDate()

  // Totales del periodo: exactos desde la analitica si solo se filtra por mes; con otros
  // filtros se suman los movimientos cargados.
  const totales = useMemo(() => {
    if (!hayFiltrosExtra && resumenQuery.data) {
      return {
        gasto: resumenQuery.data.gasto_total,
        ingreso: resumenQuery.data.ingreso_total,
        cantidad: resumenQuery.data.cantidad_movimientos,
        parcial: false,
      }
    }
    return {
      gasto: movimientos.filter((m) => m.tipo_movimiento === "gasto").reduce((s, m) => s + m.monto, 0),
      ingreso: movimientos.filter((m) => m.tipo_movimiento === "ingreso").reduce((s, m) => s + m.monto, 0),
      cantidad: movimientos.length,
      parcial: Boolean(query.hasNextPage),
    }
  }, [hayFiltrosExtra, resumenQuery.data, movimientos, query.hasNextPage])

  const limpiarFiltros = () => {
    setTipo("todos")
    setIdCategoria("")
    setIdCuenta("")
    setBusqueda("")
    setBuscando(false)
  }

  return (
    <section className="flex flex-col gap-4">
      {/* Periodo + busqueda */}
      <div className="flex items-center gap-2">
        <PeriodoSelector periodo={periodo} esMesActual={esMesActual} onMove={mover} className="flex-1" />
        <button
          type="button"
          onClick={() => {
            if (buscando) setBusqueda("")
            setBuscando((value) => !value)
          }}
          aria-label={buscando ? "Cerrar busqueda" : "Buscar"}
          aria-expanded={buscando}
          className="inline-flex size-10 items-center justify-center rounded-md border border-border hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-ring"
        >
          {buscando ? <X className="size-4" /> : <Search className="size-4" />}
        </button>
      </div>

      {buscando ? (
        <div>
          <label htmlFor="buscar-movimientos" className="sr-only">
            Buscar por nota o categoria
          </label>
          <input
            id="buscar-movimientos"
            autoFocus
            type="search"
            placeholder="Buscar por nota o categoria"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            className="h-11 w-full rounded-md border border-border bg-[color:var(--surface-lowest)] px-3 text-sm outline-none focus:border-foreground"
          />
        </div>
      ) : null}

      {/* Filtros */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        <div role="radiogroup" aria-label="Tipo" className="flex shrink-0 rounded-md bg-[color:var(--surface-low)] p-0.5">
          {TIPOS.map((opcion) => (
            <button
              key={opcion.value}
              type="button"
              role="radio"
              aria-checked={tipo === opcion.value}
              onClick={() => setTipo(opcion.value)}
              className={cn(
                "h-9 rounded-[3px] px-3 text-sm font-semibold transition-colors",
                tipo === opcion.value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opcion.label}
            </button>
          ))}
        </div>
        <FiltroSelect
          label="Categoria"
          value={idCategoria}
          onChange={setIdCategoria}
          options={categorias.map((c) => ({ value: String(c.id_categoria), label: c.nombre }))}
        />
        <FiltroSelect
          label="Cuenta"
          value={idCuenta}
          onChange={setIdCuenta}
          options={cuentas.map((c) => ({ value: String(c.id_cuenta), label: c.nombre_cuenta }))}
        />
        {hayFiltrosExtra ? (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="h-10 shrink-0 px-2 text-sm font-semibold underline underline-offset-4"
          >
            Limpiar
          </button>
        ) : null}
      </div>

      {/* Totales del periodo */}
      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-border shadow-[var(--shadow-airy)]">
        <Total etiqueta="Gastado" valor={formatCLP(totales.gasto)} parcial={totales.parcial} color="var(--gasto)" />
        <Total etiqueta="Ingresos" valor={formatCLP(totales.ingreso)} parcial={totales.parcial} color="var(--ingreso)" />
        <Total etiqueta="Movimientos" valor={`${totales.cantidad}${totales.parcial ? "+" : ""}`} />
      </dl>

      {/* Lista por dia */}
      {query.isLoading ? (
        <div className="flex flex-col gap-3" aria-hidden>
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-xl bg-[color:var(--surface-low)]" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="rounded-xl bg-[color:var(--surface-lowest)] p-5 text-sm shadow-[var(--shadow-airy)]">
          <p className="font-semibold">No pudimos cargar los movimientos.</p>
          <button type="button" onClick={() => void query.refetch()} className="mt-2 font-semibold underline underline-offset-4">
            Reintentar
          </button>
        </div>
      ) : grupos.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl bg-[color:var(--surface-lowest)] p-5 shadow-[var(--shadow-airy)]">
          <p className="font-semibold">
            {hayFiltrosExtra ? "Nada coincide con estos filtros." : `Sin movimientos en ${formatMonth(periodo.year, periodo.month)}.`}
          </p>
          {hayFiltrosExtra ? (
            <button type="button" onClick={limpiarFiltros} className="text-sm font-semibold underline underline-offset-4">
              Limpiar filtros
            </button>
          ) : (
            <Link
              href="/app/finanzas/registrar-movimiento"
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-highlight px-3 text-sm font-semibold text-highlight-foreground"
            >
              <Plus className="size-4" />
              Anotar movimiento
            </Link>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {grupos.map((grupo, index) => {
            // El ultimo dia puede seguir en la pagina siguiente: su total seria parcial.
            const totalIncompleto = index === grupos.length - 1 && Boolean(query.hasNextPage)
            return (
              <section key={grupo.fecha} aria-label={etiquetaDia(grupo.fecha, hoy)}>
                <header className="mb-1.5 flex items-baseline justify-between gap-3 px-1">
                  <h3 className="text-sm font-bold">{etiquetaDia(grupo.fecha, hoy)}</h3>
                  {!totalIncompleto ? (
                    <p className="flex gap-3 text-sm font-semibold tabular-nums text-muted-foreground">
                      {grupo.ingreso > 0 ? <span>+{formatCLP(grupo.ingreso)}</span> : null}
                      {grupo.gasto > 0 ? <span className="text-foreground">−{formatCLP(grupo.gasto)}</span> : null}
                    </p>
                  ) : null}
                </header>
                <ul className="divide-y divide-border overflow-hidden rounded-xl bg-[color:var(--surface-lowest)] shadow-[var(--shadow-airy)]">
                  {grupo.movimientos.map((movimiento) => (
                    <FilaMovimiento key={movimiento.id_transaccion} movimiento={movimiento} />
                  ))}
                </ul>
              </section>
            )
          })}

          {query.hasNextPage ? (
            <button
              type="button"
              onClick={() => void query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
              className="h-11 rounded-md border border-border text-sm font-semibold hover:border-foreground/40 disabled:opacity-60"
            >
              {query.isFetchingNextPage ? "Cargando..." : "Cargar mas"}
            </button>
          ) : null}
        </div>
      )}
    </section>
  )
}

function FilaMovimiento({ movimiento }: { movimiento: MovimientoResponse }) {
  const esIngreso = movimiento.tipo_movimiento === "ingreso"
  const Icon = esIngreso ? ArrowDownLeft : ArrowUpRight
  const hora = movimiento.created_at.slice(11, 16)
  const titulo = movimiento.descripcion || movimiento.categoria || "Sin categoria"
  const detalle = [movimiento.descripcion ? movimiento.categoria : null, movimiento.nombre_cuenta, hora]
    .filter(Boolean)
    .join(" · ")
  const contenido = (
    <>
      <span
        aria-hidden
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md"
        style={{
          background: esIngreso ? "var(--ingreso)" : "var(--gasto)",
          color: esIngreso ? "var(--ingreso-on)" : "var(--gasto-on)",
        }}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold first-letter:uppercase">{titulo}</span>
        <span className="block truncate text-xs text-muted-foreground first-letter:uppercase">{detalle}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold tabular-nums">
        {movimiento.pendiente_sincronizacion ? (
          <CloudOff className="size-3.5 text-muted-foreground" aria-label="Pendiente de sincronizar" />
        ) : null}
        {esIngreso ? "+" : "−"}
        {formatCLP(movimiento.monto)}
      </span>
    </>
  )

  return (
    <li>
      {movimiento.pendiente_sincronizacion ? (
        <div className="flex items-center gap-3 px-3 py-3 opacity-80">{contenido}</div>
      ) : (
        <Link
          href={`/app/finanzas/movimientos/${movimiento.id_transaccion}`}
          className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-[color:var(--surface-low)] focus-visible:bg-[color:var(--surface-low)] focus-visible:outline-none"
        >
          {contenido}
        </Link>
      )}
    </li>
  )
}

function Total({ etiqueta, valor, parcial, color }: { etiqueta: string; valor: string; parcial?: boolean; color?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-[color:var(--surface-lowest)] px-3 py-3">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {color ? <span aria-hidden className="size-2 rounded-[2px]" style={{ background: color }} /> : null}
        {etiqueta}
      </dt>
      <dd className="truncate font-display text-base leading-none sm:text-xl" title={parcial ? "Suma de lo cargado hasta ahora" : undefined}>
        {valor}
      </dd>
    </div>
  )
}

function FiltroSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label
      className={cn(
        "relative flex h-10 shrink-0 items-center rounded-md border px-3 text-sm font-semibold",
        value ? "border-foreground bg-foreground text-background" : "border-border text-foreground",
      )}
    >
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[10rem] appearance-none truncate bg-transparent pr-4 capitalize outline-none"
      >
        <option value="">{label}: todas</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronRight aria-hidden className="pointer-events-none absolute right-2 size-3.5 rotate-90" />
    </label>
  )
}
