import { z } from "zod"

// Adapter validado (ver lib/api-schema.ts) para las API keys de /auth/api-keys. Son las
// credenciales con que un asistente de IA se conecta al servidor MCP de Ritmo.

export const API_KEY_SCOPES = ["*", "finanzas:read", "finanzas:write"] as const
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]

export const apiKeyResponseSchema = z.object({
  id_api_key: z.number().int(),
  nombre: z.string(),
  key_prefix: z.string(),
  // string y no enum: un scope nuevo en el backend no debe romper el listado.
  scopes: z.array(z.string()),
  activo: z.boolean(),
  usage_count: z.number().int(),
  last_used_at: z.string().nullable(),
  last_used_ip: z.string().nullable(),
  created_at: z.string(),
  revoked_at: z.string().nullable(),
})

export const apiKeyListResponseSchema = z.array(apiKeyResponseSchema)

export const apiKeyCreatedResponseSchema = apiKeyResponseSchema.extend({
  api_key: z.string(),
})

export const apiKeyCreateSchema = z.object({
  nombre: z.string().trim().min(1, "Ponle un nombre a la conexion.").max(80),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1),
})

export type ApiKey = z.infer<typeof apiKeyResponseSchema>
export type ApiKeyCreated = z.infer<typeof apiKeyCreatedResponseSchema>
export type ApiKeyCreate = z.infer<typeof apiKeyCreateSchema>
