import { api } from "@/lib/api"
import { parseApiResponse } from "@/lib/api-schema"
import {
  conexionesOAuthSchema,
  redireccionOAuthSchema,
  solicitudOAuthSchema,
  type ConexionOAuth,
  type SolicitudOAuth,
} from "@/modules/usuario/schemas/oauth.schema"

export const OAuthAPI = {
  getSolicitud: async (solicitud: string): Promise<SolicitudOAuth> => {
    const { data } = await api.get("/auth/oauth/solicitud", { params: { solicitud } })
    return parseApiResponse(solicitudOAuthSchema, data, "GET /auth/oauth/solicitud")
  },

  aprobar: async (solicitud: string, scopes: string[]): Promise<string> => {
    const { data } = await api.post("/auth/oauth/solicitud/aprobar", { solicitud, scopes })
    return parseApiResponse(redireccionOAuthSchema, data, "POST /auth/oauth/solicitud/aprobar").redirect_url
  },

  rechazar: async (solicitud: string): Promise<string> => {
    const { data } = await api.post("/auth/oauth/solicitud/rechazar", { solicitud })
    return parseApiResponse(redireccionOAuthSchema, data, "POST /auth/oauth/solicitud/rechazar").redirect_url
  },

  getConexiones: async (): Promise<ConexionOAuth[]> => {
    const { data } = await api.get("/auth/oauth/conexiones")
    return parseApiResponse(conexionesOAuthSchema, data, "GET /auth/oauth/conexiones")
  },

  revocar: async (idAutorizacion: number): Promise<void> => {
    await api.delete(`/auth/oauth/conexiones/${idAutorizacion}`)
  },
}
