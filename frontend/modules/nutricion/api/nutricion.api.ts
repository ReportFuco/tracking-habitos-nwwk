import { api } from "@/lib/api"
import { parseApiResponse } from "@/lib/api-schema"
import {
  consumoDetalleResponseSchema,
  consumoDetallesListResponseSchema,
  consumoResponseSchema,
  consumosListResponseSchema,
  metaNutricionalResponseSchema,
  metasListResponseSchema,
  pesoResponseSchema,
  pesosListResponseSchema,
  tablaNutricionalResponseSchema,
  tablasListResponseSchema,
} from "@/modules/nutricion/schemas/nutricion.schema"
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
    return parseApiResponse(consumosListResponseSchema, data, "GET /api/nutricion/consumo/")
  },

  getConsumo: async (idConsumo: number): Promise<ConsumoResponse> => {
    const { data } = await api.get(`/api/nutricion/consumo/${idConsumo}`)
    return parseApiResponse(consumoResponseSchema, data, "GET /api/nutricion/consumo/{id}")
  },

  createConsumo: async (payload: ConsumoCreate): Promise<ConsumoResponse> => {
    const { data } = await api.post("/api/nutricion/consumo/", payload)
    return parseApiResponse(consumoResponseSchema, data, "POST /api/nutricion/consumo/")
  },

  updateConsumo: async (idConsumo: number, payload: ConsumoPatch): Promise<ConsumoResponse> => {
    const { data } = await api.patch(`/api/nutricion/consumo/${idConsumo}`, payload)
    return parseApiResponse(consumoResponseSchema, data, "PATCH /api/nutricion/consumo/{id}")
  },

  deleteConsumo: async (idConsumo: number): Promise<void> => {
    await api.delete(`/api/nutricion/consumo/${idConsumo}`)
  },

  getConsumoDetalles: async (idConsumo: number): Promise<ConsumoDetalleResponse[]> => {
    const { data } = await api.get(`/api/nutricion/consumo-detalle/`, {
      params: { id_consumo: idConsumo },
    })
    return parseApiResponse(
      consumoDetallesListResponseSchema,
      data,
      "GET /api/nutricion/consumo-detalle/"
    )
  },

  createConsumoDetalle: async (
    payload: ConsumoDetalleCreate
  ): Promise<ConsumoDetalleResponse> => {
    const { data } = await api.post(`/api/nutricion/consumo-detalle/`, payload)
    return parseApiResponse(
      consumoDetalleResponseSchema,
      data,
      "POST /api/nutricion/consumo-detalle/"
    )
  },

  updateConsumoDetalle: async (
    idDetalle: number,
    payload: ConsumoDetallePatch
  ): Promise<ConsumoDetalleResponse> => {
    const { data } = await api.patch(`/api/nutricion/consumo-detalle/${idDetalle}`, payload)
    return parseApiResponse(
      consumoDetalleResponseSchema,
      data,
      "PATCH /api/nutricion/consumo-detalle/{id}"
    )
  },

  deleteConsumoDetalle: async (idDetalle: number): Promise<void> => {
    await api.delete(`/api/nutricion/consumo-detalle/${idDetalle}`)
  },

  getMetas: async (): Promise<MetaNutricionalResponse[]> => {
    const { data } = await api.get("/api/nutricion/meta/")
    return parseApiResponse(metasListResponseSchema, data, "GET /api/nutricion/meta/")
  },

  createMeta: async (payload: MetaNutricionalCreate): Promise<MetaNutricionalResponse> => {
    const { data } = await api.post("/api/nutricion/meta/", payload)
    return parseApiResponse(metaNutricionalResponseSchema, data, "POST /api/nutricion/meta/")
  },

  updateMeta: async (
    idMeta: number,
    payload: MetaNutricionalPatch
  ): Promise<MetaNutricionalResponse> => {
    const { data } = await api.patch(`/api/nutricion/meta/${idMeta}`, payload)
    return parseApiResponse(metaNutricionalResponseSchema, data, "PATCH /api/nutricion/meta/{id}")
  },

  deleteMeta: async (idMeta: number): Promise<void> => {
    await api.delete(`/api/nutricion/meta/${idMeta}`)
  },

  getPesos: async (): Promise<PesoResponse[]> => {
    const { data } = await api.get("/api/nutricion/peso/")
    return parseApiResponse(pesosListResponseSchema, data, "GET /api/nutricion/peso/")
  },

  createPeso: async (payload: PesoCreate): Promise<PesoResponse> => {
    const { data } = await api.post("/api/nutricion/peso/", payload)
    return parseApiResponse(pesoResponseSchema, data, "POST /api/nutricion/peso/")
  },

  updatePeso: async (idPeso: number, payload: PesoPatch): Promise<PesoResponse> => {
    const { data } = await api.patch(`/api/nutricion/peso/${idPeso}`, payload)
    return parseApiResponse(pesoResponseSchema, data, "PATCH /api/nutricion/peso/{id}")
  },

  deletePeso: async (idPeso: number): Promise<void> => {
    await api.delete(`/api/nutricion/peso/${idPeso}`)
  },

  getTablas: async (): Promise<TablaNutricionalResponse[]> => {
    const { data } = await api.get("/api/nutricion/tabla/")
    return parseApiResponse(tablasListResponseSchema, data, "GET /api/nutricion/tabla/")
  },

  createTabla: async (payload: TablaNutricionalCreate): Promise<TablaNutricionalResponse> => {
    const { data } = await api.post("/api/nutricion/tabla/", payload)
    return parseApiResponse(tablaNutricionalResponseSchema, data, "POST /api/nutricion/tabla/")
  },

  updateTabla: async (idTabla: number, payload: TablaNutricionalPatch): Promise<TablaNutricionalResponse> => {
    const { data } = await api.patch(`/api/nutricion/tabla/${idTabla}`, payload)
    return parseApiResponse(
      tablaNutricionalResponseSchema,
      data,
      "PATCH /api/nutricion/tabla/{id}"
    )
  },

  deleteTabla: async (idTabla: number): Promise<void> => {
    await api.delete(`/api/nutricion/tabla/${idTabla}`)
  },
}
