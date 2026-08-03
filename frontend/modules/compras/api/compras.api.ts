import { api } from "@/lib/api"
import { parseApiResponse } from "@/lib/api-schema"
import {
  cadenaResponseSchema,
  cadenasListResponseSchema,
  compraDetalleResponseSchema,
  compraDetallesListResponseSchema,
  compraResponseSchema,
  comprasListResponseSchema,
  localResponseSchema,
  localesListResponseSchema,
} from "@/modules/compras/schemas/compras.schema"
import {
  CadenaCreate,
  CadenaPatch,
  CadenaResponse,
  LocalCreate,
  LocalPatch,
  CompraCreate,
  CompraDetalleCreate,
  CompraDetallePatch,
  CompraDetalleResponse,
  CompraPatch,
  CompraResponse,
  LocalResponse,
} from "@/modules/compras/types/compras"

export const ComprasAPI = {
  getCadenas: async (): Promise<CadenaResponse[]> => {
    const { data } = await api.get("/api/compras/cadena/")
    return parseApiResponse(cadenasListResponseSchema, data, "GET /api/compras/cadena/")
  },

  createCadena: async (payload: CadenaCreate): Promise<CadenaResponse> => {
    const { data } = await api.post("/api/compras/cadena/", payload)
    return parseApiResponse(cadenaResponseSchema, data, "POST /api/compras/cadena/")
  },

  updateCadena: async (idCadena: number, payload: CadenaPatch): Promise<CadenaResponse> => {
    const { data } = await api.patch(`/api/compras/cadena/${idCadena}`, payload)
    return parseApiResponse(cadenaResponseSchema, data, "PATCH /api/compras/cadena/{id}")
  },

  deleteCadena: async (idCadena: number): Promise<void> => {
    await api.delete(`/api/compras/cadena/${idCadena}`)
  },

  getLocales: async (): Promise<LocalResponse[]> => {
    const { data } = await api.get("/api/compras/local/")
    return parseApiResponse(localesListResponseSchema, data, "GET /api/compras/local/")
  },

  createLocal: async (payload: LocalCreate): Promise<LocalResponse> => {
    const { data } = await api.post("/api/compras/local/", payload)
    return parseApiResponse(localResponseSchema, data, "POST /api/compras/local/")
  },

  updateLocal: async (idLocal: number, payload: LocalPatch): Promise<LocalResponse> => {
    const { data } = await api.patch(`/api/compras/local/${idLocal}`, payload)
    return parseApiResponse(localResponseSchema, data, "PATCH /api/compras/local/{id}")
  },

  deleteLocal: async (idLocal: number): Promise<void> => {
    await api.delete(`/api/compras/local/${idLocal}`)
  },

  getCompras: async (): Promise<CompraResponse[]> => {
    const { data } = await api.get("/api/compras/compra/")
    return parseApiResponse(comprasListResponseSchema, data, "GET /api/compras/compra/")
  },

  getCompra: async (idCompra: number): Promise<CompraResponse> => {
    const { data } = await api.get(`/api/compras/compra/${idCompra}`)
    return parseApiResponse(compraResponseSchema, data, "GET /api/compras/compra/{id}")
  },

  createCompra: async (payload: CompraCreate): Promise<CompraResponse> => {
    const { data } = await api.post("/api/compras/compra/", payload)
    return parseApiResponse(compraResponseSchema, data, "POST /api/compras/compra/")
  },

  updateCompra: async (idCompra: number, payload: CompraPatch): Promise<CompraResponse> => {
    const { data } = await api.patch(`/api/compras/compra/${idCompra}`, payload)
    return parseApiResponse(compraResponseSchema, data, "PATCH /api/compras/compra/{id}")
  },

  deleteCompra: async (idCompra: number): Promise<void> => {
    await api.delete(`/api/compras/compra/${idCompra}`)
  },

  getCompraDetalles: async (idCompra: number): Promise<CompraDetalleResponse[]> => {
    const { data } = await api.get("/api/compras/compra-detalle/", {
      params: { id_compra: idCompra },
    })
    return parseApiResponse(
      compraDetallesListResponseSchema,
      data,
      "GET /api/compras/compra-detalle/"
    )
  },

  createCompraDetalle: async (
    payload: CompraDetalleCreate
  ): Promise<CompraDetalleResponse> => {
    const { data } = await api.post("/api/compras/compra-detalle/", payload)
    return parseApiResponse(
      compraDetalleResponseSchema,
      data,
      "POST /api/compras/compra-detalle/"
    )
  },

  updateCompraDetalle: async (
    idDetalle: number,
    payload: CompraDetallePatch
  ): Promise<CompraDetalleResponse> => {
    const { data } = await api.patch(`/api/compras/compra-detalle/${idDetalle}`, payload)
    return parseApiResponse(
      compraDetalleResponseSchema,
      data,
      "PATCH /api/compras/compra-detalle/{id}"
    )
  },

  deleteCompraDetalle: async (idDetalle: number): Promise<void> => {
    await api.delete(`/api/compras/compra-detalle/${idDetalle}`)
  },
}
