import { api } from "@/lib/api"
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
    return data
  },

  createCadena: async (payload: CadenaCreate): Promise<CadenaResponse> => {
    const { data } = await api.post("/api/compras/cadena/", payload)
    return data
  },

  updateCadena: async (idCadena: number, payload: CadenaPatch): Promise<CadenaResponse> => {
    const { data } = await api.patch(`/api/compras/cadena/${idCadena}`, payload)
    return data
  },

  deleteCadena: async (idCadena: number): Promise<void> => {
    await api.delete(`/api/compras/cadena/${idCadena}`)
  },

  getLocales: async (): Promise<LocalResponse[]> => {
    const { data } = await api.get("/api/compras/local/")
    return data
  },

  createLocal: async (payload: LocalCreate): Promise<LocalResponse> => {
    const { data } = await api.post("/api/compras/local/", payload)
    return data
  },

  updateLocal: async (idLocal: number, payload: LocalPatch): Promise<LocalResponse> => {
    const { data } = await api.patch(`/api/compras/local/${idLocal}`, payload)
    return data
  },

  deleteLocal: async (idLocal: number): Promise<void> => {
    await api.delete(`/api/compras/local/${idLocal}`)
  },

  getCompras: async (): Promise<CompraResponse[]> => {
    const { data } = await api.get("/api/compras/compra/")
    return data
  },

  getCompra: async (idCompra: number): Promise<CompraResponse> => {
    const { data } = await api.get(`/api/compras/compra/${idCompra}`)
    return data
  },

  createCompra: async (payload: CompraCreate): Promise<CompraResponse> => {
    const { data } = await api.post("/api/compras/compra/", payload)
    return data
  },

  updateCompra: async (idCompra: number, payload: CompraPatch): Promise<CompraResponse> => {
    const { data } = await api.patch(`/api/compras/compra/${idCompra}`, payload)
    return data
  },

  deleteCompra: async (idCompra: number): Promise<void> => {
    await api.delete(`/api/compras/compra/${idCompra}`)
  },

  getCompraDetalles: async (idCompra: number): Promise<CompraDetalleResponse[]> => {
    const { data } = await api.get("/api/compras/compra-detalle/", {
      params: { id_compra: idCompra },
    })
    return data
  },

  createCompraDetalle: async (
    payload: CompraDetalleCreate
  ): Promise<CompraDetalleResponse> => {
    const { data } = await api.post("/api/compras/compra-detalle/", payload)
    return data
  },

  updateCompraDetalle: async (
    idDetalle: number,
    payload: CompraDetallePatch
  ): Promise<CompraDetalleResponse> => {
    const { data } = await api.patch(`/api/compras/compra-detalle/${idDetalle}`, payload)
    return data
  },

  deleteCompraDetalle: async (idDetalle: number): Promise<void> => {
    await api.delete(`/api/compras/compra-detalle/${idDetalle}`)
  },
}
