"use client"

import { Flame } from "lucide-react"
import { useNutricion } from "@/modules/nutricion/hooks/useNutricion"
import { fechaLocal, formatearKcal, metaVigente, resumenDelDia } from "@/modules/nutricion/lib/calorias"

const MODULE_COLOR = "var(--module-nutricion)"

/** Contador del dia: kcal consumidas contra la meta vigente, y los macros debajo. */
export function ResumenDiario() {
  const { consumos, metas, loading } = useNutricion()
  const hoy = fechaLocal()
  const resumen = resumenDelDia(consumos, hoy)
  const meta = metaVigente(metas, hoy)
  const objetivo = meta?.calorias_objetivo ?? null
  const progreso = objetivo ? Math.min(resumen.calorias / objetivo, 1) : 0
  const restante = objetivo !== null ? objetivo - resumen.calorias : null

  return (
    <section
      aria-label="Calorias de hoy"
      className="rounded-2xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5"
    >
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <Flame className="size-3.5" style={{ color: MODULE_COLOR }} />
        Calorias de hoy
      </p>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {loading ? "—" : formatearKcal(resumen.calorias)}
        </span>
        <span className="text-sm text-muted-foreground">
          {objetivo ? `/ ${formatearKcal(objetivo)} kcal` : "kcal"}
        </span>
      </div>

      {objetivo ? (
        <>
          <div
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[color:var(--surface-variant)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={objetivo}
            aria-valuenow={Math.round(resumen.calorias)}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${progreso * 100}%`,
                background: restante !== null && restante < 0 ? "var(--destructive)" : "var(--module-nutricion-fill)",
              }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
            {restante !== null && restante >= 0
              ? `Te quedan ${formatearKcal(restante)} kcal`
              : `Te pasaste por ${formatearKcal(-(restante ?? 0))} kcal`}
          </p>
        </>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
          Define una meta de calorias para ver cuanto te queda.
        </p>
      )}

      <dl className="mt-4 grid grid-cols-3 gap-2">
        <Macro nombre="Proteinas" valor={resumen.proteinas} objetivo={meta?.proteinas_objetivo ?? null} />
        <Macro nombre="Carbos" valor={resumen.carbohidratos} objetivo={meta?.carbohidratos_objetivo ?? null} />
        <Macro nombre="Grasas" valor={resumen.grasas} objetivo={meta?.grasas_objetivo ?? null} />
      </dl>

      {resumen.sinCalorias > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {resumen.sinCalorias === 1
            ? "1 alimento no tiene tabla nutricional y no suma."
            : `${resumen.sinCalorias} alimentos no tienen tabla nutricional y no suman.`}
        </p>
      ) : null}
    </section>
  )
}

function Macro({ nombre, valor, objetivo }: { nombre: string; valor: number; objetivo: number | null }) {
  return (
    <div className="rounded-lg bg-[color:var(--surface-variant)] px-3 py-2">
      <dt className="font-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{nombre}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-foreground">
        {Math.round(valor)}
        <span className="font-normal text-muted-foreground">{objetivo ? ` / ${objetivo} g` : " g"}</span>
      </dd>
    </div>
  )
}
