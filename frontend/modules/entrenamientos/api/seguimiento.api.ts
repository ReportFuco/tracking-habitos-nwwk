import { api } from "@/lib/api"
import { parseApiResponse } from "@/lib/api-schema"
import {
  cargaMuscularResponseSchema,
  seguimientosResponseSchema,
} from "@/modules/entrenamientos/schemas/seguimiento.schema"

export type ModoCarga = "7d" | "semana"

export const SeguimientoAPI = {
  /** `fecha` (YYYY-MM-DD) solo aplica a modo semana: cualquier dia de la semana a ver. */
  getCargaMuscular: async (modo: ModoCarga, fecha?: string) => {
    const { data } = await api.get("/api/entrenamientos/carga-muscular", {
      params: { modo, ...(modo === "semana" && fecha ? { fecha } : {}) },
    })
    return parseApiResponse(cargaMuscularResponseSchema, data, "GET /api/entrenamientos/carga-muscular")
  },

  getSeguimientos: async () => {
    const { data } = await api.get("/api/entrenamientos/seguimiento")
    return parseApiResponse(seguimientosResponseSchema, data, "GET /api/entrenamientos/seguimiento")
      .seguimientos
  },

  eliminarSeguimiento: async (idSeguimiento: number) => {
    await api.delete(`/api/entrenamientos/seguimiento/${idSeguimiento}`)
  },
}
