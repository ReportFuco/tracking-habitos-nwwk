import { describe, expect, it } from "vitest"
import { caloriasDeTabla, factorPorcion, fechaLocal, metaVigente, resumenDelDia } from "@/modules/nutricion/lib/calorias"
import type { ConsumoResponse, MetaNutricionalResponse } from "@/modules/nutricion/types/nutricion"

const tabla = {
  porcion_cantidad: 100,
  porcion_unidad: "g",
  contenido_neto: 125,
  unidad_contenido: "g",
  calorias: 80,
  proteinas: 4,
  carbohidratos: 12,
  grasas: null,
}

describe("calorias de una linea (espejo del backend)", () => {
  it("escala por gramos, kilos, porciones y unidades con contenido neto", () => {
    expect(factorPorcion(150, "gr", tabla)).toBe(1.5)
    expect(factorPorcion(0.25, "kg", tabla)).toBe(2.5)
    expect(factorPorcion(2, "porcion", tabla)).toBe(2)
    expect(factorPorcion(2, "unidad", tabla)).toBe(2.5)
  })

  it("no inventa calorias con unidades que no calzan", () => {
    expect(factorPorcion(1, "taza", tabla)).toBeNull()
    // g y ml como equivalentes: bebidas informadas por 100 g.
    expect(factorPorcion(500, "ml", tabla)).toBe(5)
    expect(caloriasDeTabla(1, "unidad", { ...tabla, contenido_neto: null })).toBeNull()
  })

  it("los macros vacios cuentan como cero", () => {
    expect(caloriasDeTabla(2, "unidad", tabla)).toEqual({ calorias: 200, proteinas: 10, carbohidratos: 30, grasas: 0 })
  })
})

function consumo(fecha: string, calorias: (number | null)[]): ConsumoResponse {
  return {
    id_consumo: Math.random(),
    fecha_consumo: fecha,
    tipo_comida: "almuerzo",
    observacion: null,
    created_at: fecha,
    total_calorias: null,
    total_proteinas: null,
    total_carbohidratos: null,
    total_grasas: null,
    detalles: calorias.map((kcal, i) => ({
      id_consumo_detalle: i,
      id_consumo: 1,
      id_producto: null,
      nombre_alimento: "x",
      nombre: "x",
      cantidad_consumida: 1,
      unidad_consumida: "porcion",
      calorias: kcal,
      proteinas: kcal === null ? null : 5,
      carbohidratos: null,
      grasas: null,
      estimado: false,
    })),
  }
}

describe("contador del dia", () => {
  it("suma solo las comidas del dia y avisa lo que no tiene calorias", () => {
    const resumen = resumenDelDia(
      [consumo("2026-11-16T08:00:00", [300, null]), consumo("2026-11-16T22:30:00", [500]), consumo("2026-11-15T23:59:00", [900])],
      "2026-11-16",
    )
    expect(resumen).toMatchObject({ calorias: 800, proteinas: 10, comidas: 2, sinCalorias: 1 })
  })

  it("usa la fecha local, no la de UTC", () => {
    // 22:30 en Chile ya es el dia siguiente en UTC.
    expect(fechaLocal(new Date(2026, 10, 16, 22, 30))).toBe("2026-11-16")
  })

  it("la meta vigente es la que cubre el dia", () => {
    const meta = (id: number, inicio: string, fin: string | null) =>
      ({ id_meta: id, fecha_inicio: inicio, fecha_fin: fin, calorias_objetivo: 2000 }) as MetaNutricionalResponse
    expect(metaVigente([meta(1, "2026-01-01", "2026-06-30"), meta(2, "2026-07-01", null)], "2026-11-16")?.id_meta).toBe(2)
    expect(metaVigente([meta(1, "2026-01-01", "2026-06-30")], "2026-11-16")).toBeNull()
  })
})
