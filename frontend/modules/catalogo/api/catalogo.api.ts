import { api } from "@/lib/api"
import { parseApiResponse } from "@/lib/api-schema"
import {
  marcaResponseSchema,
  marcasListResponseSchema,
  productoResponseSchema,
  productosListResponseSchema,
} from "@/modules/catalogo/schemas/catalogo.schema"
import {
  MarcaCreate,
  MarcaPatch,
  MarcaResponse,
  ProductoCreate,
  ProductoPatch,
  ProductoResponse,
} from "@/modules/catalogo/types/catalogo"

export const CatalogoAPI = {
  getMarcas: async (): Promise<MarcaResponse[]> => {
    const { data } = await api.get("/api/catalogo/marca/")
    return parseApiResponse(marcasListResponseSchema, data, "GET /api/catalogo/marca/")
  },

  createMarca: async (payload: MarcaCreate): Promise<MarcaResponse> => {
    const { data } = await api.post("/api/catalogo/marca/", payload)
    return parseApiResponse(marcaResponseSchema, data, "POST /api/catalogo/marca/")
  },

  updateMarca: async (idMarca: number, payload: MarcaPatch): Promise<MarcaResponse> => {
    const { data } = await api.patch(`/api/catalogo/marca/${idMarca}`, payload)
    return parseApiResponse(marcaResponseSchema, data, "PATCH /api/catalogo/marca/{id}")
  },

  deleteMarca: async (idMarca: number): Promise<void> => {
    await api.delete(`/api/catalogo/marca/${idMarca}`)
  },

  getProductos: async (params?: { q?: string; limit?: number }): Promise<ProductoResponse[]> => {
    const { data } = await api.get("/api/catalogo/producto/", {
      params: params?.q || params?.limit ? params : undefined,
    })
    return parseApiResponse(productosListResponseSchema, data, "GET /api/catalogo/producto/")
  },

  /** Los que mas compra el usuario, para elegirlos con un toque. */
  getProductosFrecuentes: async (): Promise<ProductoResponse[]> => {
    const { data } = await api.get("/api/catalogo/producto/frecuentes")
    return parseApiResponse(productosListResponseSchema, data, "GET /api/catalogo/producto/frecuentes")
  },

  /** Cola de revision del administrador. */
  getProductosEnRevision: async (estado: "pendiente" | "rechazado" = "pendiente"): Promise<ProductoResponse[]> => {
    const { data } = await api.get("/api/catalogo/producto/revision", { params: { estado } })
    return parseApiResponse(productosListResponseSchema, data, "GET /api/catalogo/producto/revision")
  },

  aprobarProducto: async (idProducto: number): Promise<ProductoResponse> => {
    const { data } = await api.post(`/api/catalogo/producto/${idProducto}/aprobar`)
    return parseApiResponse(productoResponseSchema, data, "POST /api/catalogo/producto/{id}/aprobar")
  },

  rechazarProducto: async (idProducto: number): Promise<ProductoResponse> => {
    const { data } = await api.post(`/api/catalogo/producto/${idProducto}/rechazar`)
    return parseApiResponse(productoResponseSchema, data, "POST /api/catalogo/producto/{id}/rechazar")
  },

  fusionarProducto: async (idProducto: number, idProductoDestino: number): Promise<ProductoResponse> => {
    const { data } = await api.post(`/api/catalogo/producto/${idProducto}/fusionar`, {
      id_producto_destino: idProductoDestino,
    })
    return parseApiResponse(productoResponseSchema, data, "POST /api/catalogo/producto/{id}/fusionar")
  },

  createProducto: async (payload: ProductoCreate): Promise<ProductoResponse> => {
    const { data } = await api.post("/api/catalogo/producto/", payload)
    return parseApiResponse(productoResponseSchema, data, "POST /api/catalogo/producto/")
  },

  updateProducto: async (idProducto: number, payload: ProductoPatch): Promise<ProductoResponse> => {
    const { data } = await api.patch(`/api/catalogo/producto/${idProducto}`, payload)
    return parseApiResponse(productoResponseSchema, data, "PATCH /api/catalogo/producto/{id}")
  },

  deleteProducto: async (idProducto: number): Promise<void> => {
    await api.delete(`/api/catalogo/producto/${idProducto}`)
  },
}
