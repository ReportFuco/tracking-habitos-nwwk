import { api } from "@/lib/api"
import {
  ConsumoCreate,
  ConsumoDetalleCreate,
  ConsumoDetallePatch,
  ConsumoDetalleResponse,
  ConsumoPatch,
  ConsumoResponse,
  MetaNutricionalCreate,
  MetaNutricionalPatch,
  MetaNutricionalResponse,
  PesoCreate,
  PesoPatch,
  PesoResponse,
  TablaNutricionalCreate,
  TablaNutricionalPatch,
  TablaNutricionalResponse,
} from "@/modules/nutricion/types/nutricion"

export const NutricionAPI = {
  getConsumos: async (): Promise<ConsumoResponse[]> => {
    const { data } = await api.get("/api/nutricion/consumo/")
    return data
  },

  getConsumo: async (idConsumo: number): Promise<ConsumoResponse> => {
    const { data } = await api.get(`/api/nutricion/consumo/${idConsumo}`)
    return data
  },

  createConsumo: async (payload: ConsumoCreate): Promise<ConsumoResponse> => {
    const { data } = await api.post("/api/nutricion/consumo/", payload)
    return data
  },

  updateConsumo: async (idConsumo: number, payload: ConsumoPatch): Promise<ConsumoResponse> => {
    const { data } = await api.patch(`/api/nutricion/consumo/${idConsumo}`, payload)
    return data
  },

  deleteConsumo: async (idConsumo: number): Promise<void> => {
    await api.delete(`/api/nutricion/consumo/${idConsumo}`)
  },

  getConsumoDetalles: async (idConsumo: number): Promise<ConsumoDetalleResponse[]> => {
    const { data } = await api.get(`/api/nutricion/consumo-detalle/`, {
      params: { id_consumo: idConsumo },
    })
    return data
  },

  createConsumoDetalle: async (
    payload: ConsumoDetalleCreate
  ): Promise<ConsumoDetalleResponse> => {
    const { data } = await api.post(`/api/nutricion/consumo-detalle/`, payload)
    return data
  },

  updateConsumoDetalle: async (
    idDetalle: number,
    payload: ConsumoDetallePatch
  ): Promise<ConsumoDetalleResponse> => {
    const { data } = await api.patch(`/api/nutricion/consumo-detalle/${idDetalle}`, payload)
    return data
  },

  deleteConsumoDetalle: async (idDetalle: number): Promise<void> => {
    await api.delete(`/api/nutricion/consumo-detalle/${idDetalle}`)
  },

  getMetas: async (): Promise<MetaNutricionalResponse[]> => {
    const { data } = await api.get("/api/nutricion/meta/")
    return data
  },

  createMeta: async (payload: MetaNutricionalCreate): Promise<MetaNutricionalResponse> => {
    const { data } = await api.post("/api/nutricion/meta/", payload)
    return data
  },

  updateMeta: async (
    idMeta: number,
    payload: MetaNutricionalPatch
  ): Promise<MetaNutricionalResponse> => {
    const { data } = await api.patch(`/api/nutricion/meta/${idMeta}`, payload)
    return data
  },

  deleteMeta: async (idMeta: number): Promise<void> => {
    await api.delete(`/api/nutricion/meta/${idMeta}`)
  },

  getPesos: async (): Promise<PesoResponse[]> => {
    const { data } = await api.get("/api/nutricion/peso/")
    return data
  },

  createPeso: async (payload: PesoCreate): Promise<PesoResponse> => {
    const { data } = await api.post("/api/nutricion/peso/", payload)
    return data
  },

  updatePeso: async (idPeso: number, payload: PesoPatch): Promise<PesoResponse> => {
    const { data } = await api.patch(`/api/nutricion/peso/${idPeso}`, payload)
    return data
  },

  deletePeso: async (idPeso: number): Promise<void> => {
    await api.delete(`/api/nutricion/peso/${idPeso}`)
  },

  getTablas: async (): Promise<TablaNutricionalResponse[]> => {
    const { data } = await api.get("/api/nutricion/tabla/")
    return data
  },

  createTabla: async (payload: TablaNutricionalCreate): Promise<TablaNutricionalResponse> => {
    const { data } = await api.post("/api/nutricion/tabla/", payload)
    return data
  },

  updateTabla: async (idTabla: number, payload: TablaNutricionalPatch): Promise<TablaNutricionalResponse> => {
    const { data } = await api.patch(`/api/nutricion/tabla/${idTabla}`, payload)
    return data
  },

  deleteTabla: async (idTabla: number): Promise<void> => {
    await api.delete(`/api/nutricion/tabla/${idTabla}`)
  },
}
