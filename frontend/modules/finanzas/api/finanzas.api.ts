import { api } from "@/lib/api"
import { parseApiResponse } from "@/lib/api-schema"
import {
  analiticaDiariaResponseSchema,
  analiticaDistribucionCategoriasResponseSchema,
  analiticaDistribucionCuentasResponseSchema,
  analiticaResumenResponseSchema,
  analiticaTendenciaMensualResponseSchema,
  cuentaResponseSchema,
  cuentasListResponseSchema,
  movimientoResponseSchema,
  movimientosPageResponseSchema,
} from "@/modules/finanzas/schemas/finanzas.schema"
import {
  AnaliticaDiariaResponse,
  AnaliticaDistribucionCategoriasResponse,
  AnaliticaDistribucionCuentasResponse,
  MovimientosFiltros,
  AnaliticaResumenResponse,
  AnaliticaTendenciaMensualResponse,
  BancoCreate,
  BancoResponse,
  CategoriaCreate,
  CategoriaPatch,
  CategoriaResponse,
  CuentaCreate,
  CuentaPatch,
  CuentaResponse,
  MovimientoCreate,
  MovimientoItemCreate,
  MovimientoItemPatch,
  MovimientoPatch,
  MovimientoResponse,
  MovimientosPageResponse,
  ProductoFinancieroCreate,
  ProductoFinancieroPatch,
  ProductoFinancieroResponse,
} from "@/modules/finanzas/types/finanzas"

export const FinanzasAPI = {
  getBancos: async (): Promise<BancoResponse[]> => {
    const { data } = await api.get("/api/finanzas/banco/")
    return data
  },

  createBanco: async (payload: BancoCreate): Promise<BancoResponse> => {
    const { data } = await api.post("/api/finanzas/banco/", payload)
    return data
  },

  updateBanco: async (idBanco: number, payload: BancoCreate): Promise<BancoResponse> => {
    const { data } = await api.patch(`/api/finanzas/banco/${idBanco}`, payload)
    return data
  },

  deleteBanco: async (idBanco: number): Promise<void> => {
    await api.delete(`/api/finanzas/banco/${idBanco}`)
  },

  getProductosFinancieros: async (params?: {
    id_banco?: number
    q?: string
    incluir_inactivos?: boolean
  }): Promise<ProductoFinancieroResponse[]> => {
    const { data } = await api.get("/api/finanzas/producto-financiero/", { params })
    return data
  },

  getProductoFinancieroById: async (
    idProducto: number
  ): Promise<ProductoFinancieroResponse> => {
    const { data } = await api.get(`/api/finanzas/producto-financiero/${idProducto}`)
    return data
  },

  createProductoFinanciero: async (
    payload: ProductoFinancieroCreate
  ): Promise<ProductoFinancieroResponse> => {
    const { data } = await api.post("/api/finanzas/producto-financiero/", payload)
    return data
  },

  updateProductoFinanciero: async (
    idProducto: number,
    payload: ProductoFinancieroPatch
  ): Promise<ProductoFinancieroResponse> => {
    const { data } = await api.patch(`/api/finanzas/producto-financiero/${idProducto}`, payload)
    return data
  },

  deleteProductoFinanciero: async (idProducto: number): Promise<void> => {
    await api.delete(`/api/finanzas/producto-financiero/${idProducto}`)
  },

  getCategorias: async (params?: { incluir_archivadas?: boolean }): Promise<CategoriaResponse[]> => {
    const { data } = await api.get("/api/finanzas/categoria/", { params })
    return data
  },

  createCategoria: async (payload: CategoriaCreate): Promise<CategoriaResponse> => {
    const { data } = await api.post("/api/finanzas/categoria/", payload)
    return data
  },

  updateCategoria: async (idCategoria: number, payload: CategoriaPatch): Promise<CategoriaResponse> => {
    const { data } = await api.patch(`/api/finanzas/categoria/${idCategoria}`, payload)
    return data
  },

  deleteCategoria: async (idCategoria: number): Promise<void> => {
    await api.delete(`/api/finanzas/categoria/${idCategoria}`)
  },

  getCuentas: async (): Promise<CuentaResponse[]> => {
    const { data } = await api.get("/api/finanzas/cuentas/")
    return parseApiResponse(cuentasListResponseSchema, data, "GET /api/finanzas/cuentas/")
  },

  createCuenta: async (payload: CuentaCreate): Promise<CuentaResponse> => {
    const { data } = await api.post("/api/finanzas/cuentas/", payload)
    return parseApiResponse(cuentaResponseSchema, data, "POST /api/finanzas/cuentas/")
  },

  updateCuenta: async (idCuenta: number, payload: CuentaPatch): Promise<CuentaResponse> => {
    const { data } = await api.patch(`/api/finanzas/cuentas/${idCuenta}`, payload)
    return parseApiResponse(cuentaResponseSchema, data, "PATCH /api/finanzas/cuentas/:id")
  },

  deleteCuenta: async (idCuenta: number): Promise<void> => {
    await api.delete(`/api/finanzas/cuentas/${idCuenta}`)
  },

  getMovimientos: async (
    params?: { offset?: number; limit?: number } & MovimientosFiltros,
  ): Promise<MovimientosPageResponse> => {
    try {
      const { data } = await api.get("/api/finanzas/movimientos/", { params })
      return parseApiResponse(
        movimientosPageResponseSchema,
        data,
        "GET /api/finanzas/movimientos/",
      )
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } })?.response?.status === 404) {
        return { items: [], offset: 0, limit: params?.limit ?? 20, total_gasto_mensual: 0 }
      }
      throw err
    }
  },

  getMovimientoById: async (idMovimiento: number): Promise<MovimientoResponse> => {
    const { data } = await api.get(`/api/finanzas/movimientos/${idMovimiento}`)
    return parseApiResponse(movimientoResponseSchema, data, "GET /api/finanzas/movimientos/:id")
  },

  createMovimiento: async (payload: MovimientoCreate): Promise<MovimientoResponse> => {
    const { data } = await api.post("/api/finanzas/movimientos/", payload)
    return parseApiResponse(movimientoResponseSchema, data, "POST /api/finanzas/movimientos/")
  },

  deleteMovimiento: async (idMovimiento: number): Promise<void> => {
    await api.delete(`/api/finanzas/movimientos/${idMovimiento}`)
  },

  // Los endpoints de productos del gasto devuelven el movimiento completo actualizado.
  addMovimientoItem: async (idMovimiento: number, payload: MovimientoItemCreate): Promise<MovimientoResponse> => {
    const { data } = await api.post(`/api/finanzas/movimientos/${idMovimiento}/items`, payload)
    return parseApiResponse(movimientoResponseSchema, data, "POST /api/finanzas/movimientos/:id/items")
  },

  updateMovimientoItem: async (
    idMovimiento: number,
    idItem: number,
    payload: MovimientoItemPatch,
  ): Promise<MovimientoResponse> => {
    const { data } = await api.patch(`/api/finanzas/movimientos/${idMovimiento}/items/${idItem}`, payload)
    return parseApiResponse(movimientoResponseSchema, data, "PATCH /api/finanzas/movimientos/:id/items/:id")
  },

  deleteMovimientoItem: async (idMovimiento: number, idItem: number): Promise<MovimientoResponse> => {
    const { data } = await api.delete(`/api/finanzas/movimientos/${idMovimiento}/items/${idItem}`)
    return parseApiResponse(movimientoResponseSchema, data, "DELETE /api/finanzas/movimientos/:id/items/:id")
  },

  getAnaliticaDiaria: async (params?: { year?: number; month?: number }): Promise<AnaliticaDiariaResponse> => {
    const { data } = await api.get("/api/finanzas/analitica/diaria", { params })
    return parseApiResponse(analiticaDiariaResponseSchema, data, "GET /api/finanzas/analitica/diaria")
  },

  updateMovimiento: async (
    idMovimiento: number,
    payload: MovimientoPatch
  ): Promise<MovimientoResponse> => {
    const { data } = await api.patch(`/api/finanzas/movimientos/${idMovimiento}`, payload)
    return parseApiResponse(
      movimientoResponseSchema,
      data,
      "PATCH /api/finanzas/movimientos/:id",
    )
  },

  getAnaliticaResumen: async (params?: {
    year?: number
    month?: number
  }): Promise<AnaliticaResumenResponse> => {
    const { data } = await api.get("/api/finanzas/analitica/resumen", { params })
    return parseApiResponse(analiticaResumenResponseSchema, data, "GET /api/finanzas/analitica/resumen")
  },

  getAnaliticaTendenciaMensual: async (params?: {
    months?: number
  }): Promise<AnaliticaTendenciaMensualResponse> => {
    const { data } = await api.get("/api/finanzas/analitica/tendencia-mensual", { params })
    return parseApiResponse(
      analiticaTendenciaMensualResponseSchema,
      data,
      "GET /api/finanzas/analitica/tendencia-mensual",
    )
  },

  getAnaliticaDistribucionCategorias: async (params?: {
    year?: number
    month?: number
    tipo_movimiento?: "gasto" | "ingreso"
  }): Promise<AnaliticaDistribucionCategoriasResponse> => {
    const { data } = await api.get("/api/finanzas/analitica/distribucion-categorias", { params })
    return parseApiResponse(
      analiticaDistribucionCategoriasResponseSchema,
      data,
      "GET /api/finanzas/analitica/distribucion-categorias",
    )
  },

  getAnaliticaDistribucionCuentas: async (params?: {
    year?: number
    month?: number
    tipo_movimiento?: "gasto" | "ingreso"
  }): Promise<AnaliticaDistribucionCuentasResponse> => {
    const { data } = await api.get("/api/finanzas/analitica/distribucion-cuentas", { params })
    return parseApiResponse(
      analiticaDistribucionCuentasResponseSchema,
      data,
      "GET /api/finanzas/analitica/distribucion-cuentas",
    )
  },
}
