import { api } from "@/lib/api"
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
    return data
  },

  createMarca: async (payload: MarcaCreate): Promise<MarcaResponse> => {
    const { data } = await api.post("/api/catalogo/marca/", payload)
    return data
  },

  updateMarca: async (idMarca: number, payload: MarcaPatch): Promise<MarcaResponse> => {
    const { data } = await api.patch(`/api/catalogo/marca/${idMarca}`, payload)
    return data
  },

  deleteMarca: async (idMarca: number): Promise<void> => {
    await api.delete(`/api/catalogo/marca/${idMarca}`)
  },

  getProductos: async (params?: { q?: string }): Promise<ProductoResponse[]> => {
    const { data } = await api.get("/api/catalogo/producto/", {
      params: params?.q ? params : undefined,
    })
    return data
  },

  createProducto: async (payload: ProductoCreate): Promise<ProductoResponse> => {
    const { data } = await api.post("/api/catalogo/producto/", payload)
    return data
  },

  updateProducto: async (idProducto: number, payload: ProductoPatch): Promise<ProductoResponse> => {
    const { data } = await api.patch(`/api/catalogo/producto/${idProducto}`, payload)
    return data
  },

  deleteProducto: async (idProducto: number): Promise<void> => {
    await api.delete(`/api/catalogo/producto/${idProducto}`)
  },
}
