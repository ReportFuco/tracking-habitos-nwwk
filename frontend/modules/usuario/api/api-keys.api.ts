import { api } from "@/lib/api"
import { parseApiResponse } from "@/lib/api-schema"
import {
  apiKeyCreatedResponseSchema,
  apiKeyListResponseSchema,
  type ApiKey,
  type ApiKeyCreate,
  type ApiKeyCreated,
} from "@/modules/usuario/schemas/api-key.schema"

export const ApiKeysAPI = {
  getAll: async (): Promise<ApiKey[]> => {
    const { data } = await api.get("/auth/api-keys")
    return parseApiResponse(apiKeyListResponseSchema, data, "GET /auth/api-keys")
  },

  create: async (payload: ApiKeyCreate): Promise<ApiKeyCreated> => {
    const { data } = await api.post("/auth/api-keys", payload)
    return parseApiResponse(apiKeyCreatedResponseSchema, data, "POST /auth/api-keys")
  },

  revoke: async (idApiKey: number): Promise<void> => {
    await api.delete(`/auth/api-keys/${idApiKey}`)
  },
}

/** URL del servidor MCP: el mismo backend que usa la app, en /mcp. */
export const getMcpUrl = (): string => {
  const base = api.defaults.baseURL || (typeof window !== "undefined" ? window.location.origin : "")
  return new URL("/mcp", base).toString()
}
