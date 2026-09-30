import { afterEach, describe, expect, it, vi } from "vitest"

// Movimientos paginados y cuentas son las queries persistidas de finanzas (FE-ZOD-002,
// item 3 del orden sugerido); movimientos ademas tiene la cola offline idempotente por
// client_request_id (ver modules/finanzas/offline/movimientos-offline.ts).
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import { api } from "@/lib/api"
import { ApiSchemaError } from "@/lib/api-schema"
import { FinanzasAPI } from "@/modules/finanzas/api/finanzas.api"

const cuentaValida = {
  id_cuenta: 1,
  nombre_cuenta: "Cuenta Vista",
  nombre_banco: "Banco Estado",
  nombre_producto: "Cuenta Vista",
  id_producto_financiero: 5,
  created_at: "2026-01-01T00:00:00",
}

const movimientoValido = {
  id_transaccion: 10,
  client_request_id: "11111111-1111-4111-8111-111111111111",
  tipo_movimiento: "gasto",
  tipo_gasto: "variable",
  id_categoria: 3,
  categoria: "Comida",
  nombre_cuenta: "Cuenta Vista",
  items: [],
  total_detallado: 0,
  monto: 5000,
  descripcion: "Almuerzo",
  en_lugar_compra: false,
  created_at: "2026-08-03T12:00:00",
}

afterEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.patch).mockReset()
})

describe("FinanzasAPI.getCuentas / createCuenta: adapter validado", () => {
  it("getCuentas parsea la lista", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [cuentaValida] })

    const cuentas = await FinanzasAPI.getCuentas()

    expect(cuentas).toEqual([cuentaValida])
  })

  it("getCuentas rechaza si falta nombre_producto (campo obligatorio segun el backend)", async () => {
    const sinNombreProducto: Record<string, unknown> = { ...cuentaValida }
    delete sinNombreProducto.nombre_producto
    vi.mocked(api.get).mockResolvedValue({ data: [sinNombreProducto] })

    await expect(FinanzasAPI.getCuentas()).rejects.toBeInstanceOf(ApiSchemaError)
  })

  it("createCuenta parsea la cuenta creada", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: cuentaValida })

    const creada = await FinanzasAPI.createCuenta({
      id_producto_financiero: 5,
      nombre_cuenta: "Cuenta Vista",
    })

    expect(creada.id_cuenta).toBe(1)
  })
})

describe("FinanzasAPI.getMovimientos / createMovimiento: adapter validado", () => {
  it("getMovimientos parsea la pagina completa", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { items: [movimientoValido], offset: 0, limit: 20, total_gasto_mensual: 5000 },
    })

    const pagina = await FinanzasAPI.getMovimientos()

    expect(pagina.items).toHaveLength(1)
    expect(pagina.total_gasto_mensual).toBe(5000)
  })

  it("getMovimientos rechaza si un item de la pagina tiene tipo_movimiento invalido", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        items: [{ ...movimientoValido, tipo_movimiento: "no-es-un-tipo-valido" }],
        offset: 0,
        limit: 20,
        total_gasto_mensual: 5000,
      },
    })

    await expect(FinanzasAPI.getMovimientos()).rejects.toBeInstanceOf(ApiSchemaError)
  })

  it("un 404 real (mes sin movimientos) sigue devolviendo la pagina vacia, no un error de schema", async () => {
    const notFound = Object.assign(new Error("not found"), { response: { status: 404 } })
    vi.mocked(api.get).mockRejectedValue(notFound)

    const pagina = await FinanzasAPI.getMovimientos({ limit: 20 })

    expect(pagina).toEqual({ items: [], offset: 0, limit: 20, total_gasto_mensual: 0 })
  })

  it("createMovimiento parsea el movimiento creado", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: movimientoValido })

    const creado = await FinanzasAPI.createMovimiento({
      id_categoria: 1,
      id_cuenta: 1,
      tipo_movimiento: "gasto",
      tipo_gasto: "variable",
      monto: 5000,
    })

    expect(creado.id_transaccion).toBe(10)
    expect(creado.client_request_id).toBe(movimientoValido.client_request_id)
  })

  it("createMovimiento rechaza si el backend manda descripcion ausente en vez de null", async () => {
    const sinDescripcion: Record<string, unknown> = { ...movimientoValido }
    delete sinDescripcion.descripcion
    vi.mocked(api.post).mockResolvedValue({ data: sinDescripcion })

    await expect(
      FinanzasAPI.createMovimiento({
        id_categoria: 1,
        id_cuenta: 1,
        tipo_movimiento: "gasto",
        tipo_gasto: "variable",
        monto: 5000,
      }),
    ).rejects.toBeInstanceOf(ApiSchemaError)
  })
})

// Contrato de analitica: el backend devuelve objetos con items + metadatos
// (backend/app/schemas/finanzas/analitica.py), no arrays planos.
describe("FinanzasAPI analitica: contrato con el backend", () => {
  it("tendencia mensual devuelve { months, items }", async () => {
    const respuesta = {
      months: 2,
      items: [
        { year: 2026, month: 8, label: "2026-08", gasto_total: 100, ingreso_total: 300, balance_total: 200, cantidad_movimientos: 3 },
        { year: 2026, month: 9, label: "2026-09", gasto_total: 50, ingreso_total: 0, balance_total: -50, cantidad_movimientos: 1 },
      ],
    }
    vi.mocked(api.get).mockResolvedValue({ data: respuesta })

    await expect(FinanzasAPI.getAnaliticaTendenciaMensual({ months: 2 })).resolves.toEqual(respuesta)
  })

  it("distribucion por categorias usa categoria y porcentaje_del_total", async () => {
    const respuesta = {
      year: 2026,
      month: 9,
      tipo_movimiento: "gasto",
      total_periodo: 1000,
      items: [
        { id_categoria: 1, categoria: "Comida", total: 600, cantidad_movimientos: 4, porcentaje_del_total: 60 },
      ],
    }
    vi.mocked(api.get).mockResolvedValue({ data: respuesta })

    await expect(FinanzasAPI.getAnaliticaDistribucionCategorias()).resolves.toEqual(respuesta)
  })

  it("rechaza la forma vieja (array plano con label/porcentaje)", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [{ label: "Comida", total: 600, porcentaje: 60 }] })

    await expect(FinanzasAPI.getAnaliticaDistribucionCuentas()).rejects.toBeInstanceOf(ApiSchemaError)
  })
})

describe("FinanzasAPI: filtros, borrado y gasto diario", () => {
  it("getMovimientos envia los filtros como query params", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { items: [], offset: 0, limit: 50, total_gasto_mensual: 0 } })

    await FinanzasAPI.getMovimientos({ year: 2026, month: 9, tipo_movimiento: "gasto", q: "farmacia", offset: 0, limit: 50 })

    expect(api.get).toHaveBeenCalledWith("/api/finanzas/movimientos/", {
      params: { year: 2026, month: 9, tipo_movimiento: "gasto", q: "farmacia", offset: 0, limit: 50 },
    })
  })

  it("deleteMovimiento hace DELETE a la ruta del movimiento", async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: undefined })

    await FinanzasAPI.deleteMovimiento(42)

    expect(api.delete).toHaveBeenCalledWith("/api/finanzas/movimientos/42")
  })

  it("getAnaliticaDiaria valida el contrato del backend", async () => {
    const dia = { dia: 22, fecha: "2026-09-22", gasto_total: 18990, ingreso_total: 0, cantidad_movimientos: 1, es_futuro: false }
    const respuesta = {
      year: 2026,
      month: 9,
      dias_mes: 30,
      dias_transcurridos: 26,
      gasto_total: 18990,
      promedio_gasto_diario: 730.4,
      dia_mayor_gasto: dia,
      items: [dia],
    }
    vi.mocked(api.get).mockResolvedValue({ data: respuesta })

    await expect(FinanzasAPI.getAnaliticaDiaria({ year: 2026, month: 9 })).resolves.toEqual(respuesta)

    vi.mocked(api.get).mockResolvedValue({ data: { ...respuesta, items: [{ dia: 1 }] } })
    await expect(FinanzasAPI.getAnaliticaDiaria()).rejects.toBeInstanceOf(ApiSchemaError)
  })
})
