import type {
  ConsumoResponse,
  MetaNutricionalResponse,
  TablaNutricionalResponse,
} from "@/modules/nutricion/types/nutricion"

/**
 * Espejo de `backend/app/services/nutricion/calculo.py`: solo sirve para la vista previa
 * mientras se anota. Las calorias que cuentan son las que guarda el backend.
 */
const SINONIMOS: Record<string, string> = {
  gr: "g",
  grs: "g",
  gramo: "g",
  gramos: "g",
  kilo: "kg",
  kilos: "kg",
  cc: "ml",
  mililitro: "ml",
  mililitros: "ml",
  lt: "l",
  litro: "l",
  litros: "l",
  "porción": "porcion",
  porciones: "porcion",
  unidades: "unidad",
  un: "unidad",
}

const A_BASE: Record<string, [string, number]> = { kg: ["g", 1000], l: ["ml", 1000] }

export function normalizarUnidad(unidad: string | null | undefined) {
  const u = (unidad ?? "").trim().toLowerCase().replace(/\.$/, "")
  return SINONIMOS[u] ?? u
}

function aBase(cantidad: number, unidad: string): [number, string] {
  const conv = A_BASE[unidad]
  return conv ? [cantidad * conv[1], conv[0]] : [cantidad, unidad]
}

type TablaCalculo = Pick<
  TablaNutricionalResponse,
  | "porcion_cantidad"
  | "porcion_unidad"
  | "contenido_neto"
  | "unidad_contenido"
  | "calorias"
  | "proteinas"
  | "carbohidratos"
  | "grasas"
>

/** g y ml como equivalentes (densidad ~1): muchas bebidas vienen informadas por 100 g. */
function mismaMagnitud(a: string, b: string) {
  return a === b || (new Set([a, b]).size === 2 && [a, b].every((u) => u === "g" || u === "ml"))
}

export function factorPorcion(cantidad: number, unidad: string, tabla: TablaCalculo): number | null {
  const u = normalizarUnidad(unidad)
  if (u === "porcion") return cantidad
  const porcion = tabla.porcion_cantidad
  if (!porcion || porcion <= 0) return null
  const [cant, uBase] = aBase(cantidad, u)
  const [porcionBase, puBase] = aBase(porcion, normalizarUnidad(tabla.porcion_unidad))
  if (mismaMagnitud(uBase, puBase)) return cant / porcionBase
  if (u === "unidad" && tabla.contenido_neto) {
    const [contenido, cuBase] = aBase(tabla.contenido_neto, normalizarUnidad(tabla.unidad_contenido))
    if (mismaMagnitud(cuBase, puBase)) return (cantidad * contenido) / porcionBase
  }
  return null
}

export interface Macros {
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
}

export function caloriasDeTabla(cantidad: number, unidad: string, tabla: TablaCalculo): Macros | null {
  const factor = factorPorcion(cantidad, unidad, tabla)
  if (factor === null) return null
  const r = (v: number | null) => Math.round((v ?? 0) * factor * 100) / 100
  return {
    calorias: r(tabla.calorias),
    proteinas: r(tabla.proteinas),
    carbohidratos: r(tabla.carbohidratos),
    grasas: r(tabla.grasas),
  }
}

/** Fecha local YYYY-MM-DD (no la de UTC: en Chile, despues de las 21:00 ya seria "manana"). */
export function fechaLocal(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export interface ResumenDia extends Macros {
  comidas: number
  /** Lineas sin calorias conocidas (producto sin tabla): el total se queda corto. */
  sinCalorias: number
}

export function resumenDelDia(consumos: ConsumoResponse[], fecha: string): ResumenDia {
  const resumen: ResumenDia = { calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0, comidas: 0, sinCalorias: 0 }
  for (const consumo of consumos) {
    // fecha_consumo viene en hora local de Chile y sin zona: el prefijo es el dia.
    if (consumo.fecha_consumo.slice(0, 10) !== fecha) continue
    resumen.comidas += 1
    for (const d of consumo.detalles) {
      if (d.calorias === null) resumen.sinCalorias += 1
      resumen.calorias += d.calorias ?? 0
      resumen.proteinas += d.proteinas ?? 0
      resumen.carbohidratos += d.carbohidratos ?? 0
      resumen.grasas += d.grasas ?? 0
    }
  }
  return resumen
}

export function metaVigente(metas: MetaNutricionalResponse[], fecha: string) {
  return (
    metas.find((m) => m.fecha_inicio <= fecha && (m.fecha_fin === null || fecha <= m.fecha_fin)) ?? null
  )
}

export function formatearKcal(valor: number) {
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(valor)
}
