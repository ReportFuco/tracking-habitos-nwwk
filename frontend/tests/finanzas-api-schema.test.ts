import { afterEach, describe, expect, it, vi } from "vitest"

// Movimientos paginados y cuentas son las queries persistidas de finanzas (FE-ZOD-002,
// item 3 del orden sugerido); movimientos ademas tiene la cola offline idempotente por
// client_request_id (ver modules/finanzas/offline/movimientos-offline.ts).
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
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
  categoria: "Comida",
  nombre_cuenta: "Cuenta Vista",
  compras_vinculadas: [],
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
