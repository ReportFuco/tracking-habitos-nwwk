"use client"

import { useMemo, useState } from "react"
import { ClipboardList, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useNutricion } from "@/modules/nutricion/hooks/useNutricion"

const MODULE_COLOR = "var(--module-nutricion)"

export function TablaManager() {
  const { tablas, loading } = useNutricion()
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tablas
    return tablas.filter((t) => (t.nombre_producto ?? "").toLowerCase().includes(q))
  }, [tablas, query])

  return (
    <section className="flex flex-col gap-4">
      <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <ClipboardList className="size-3.5" style={{ color: MODULE_COLOR }} />
          Tabla de referencia
        </p>
        <h3 className="mt-2 text-lg font-semibold tracking-tight sm:text-xl">
          Macros por producto
        </h3>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          Tabla maestra con calorias y macros por porcion. Se administra desde el rol admin.
        </p>
      </article>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar producto..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-12 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] pl-11 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
        />
      </div>

      {loading ? (
        <div className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-5 text-sm text-muted-foreground shadow-[var(--shadow-airy)]">
          Cargando tablas...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-5 text-sm text-muted-foreground shadow-[var(--shadow-airy)]">
          {tablas.length === 0
            ? "Aun no hay tablas nutricionales cargadas."
            : "Sin resultados para tu busqueda."}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((tabla) => (
            <li
              key={tabla.id_tabla}
              className="rounded-[1.25rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {tabla.nombre_producto ?? `Producto #${tabla.id_producto}`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Porcion {tabla.porcion_cantidad ?? "—"} {tabla.porcion_unidad ?? ""}
                  </p>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{
                    background: `color-mix(in oklch, ${MODULE_COLOR} 14%, transparent)`,
                    color: MODULE_COLOR,
                  }}
                >
                  {tabla.calorias ?? "—"} kcal
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                <Macro label="Proteina" value={`${tabla.proteinas ?? "—"}g`} />
                <Macro label="Carbos" value={`${tabla.carbohidratos ?? "—"}g`} />
                <Macro label="Grasas" value={`${tabla.grasas ?? "—"}g`} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Macro({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.85rem] bg-[color:var(--surface-low)] px-3 py-2">
      <p className="font-label text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}
