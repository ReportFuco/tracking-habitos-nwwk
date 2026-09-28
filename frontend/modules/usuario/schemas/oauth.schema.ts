import { z } from "zod"

// Adapter validado (ver lib/api-schema.ts) para /auth/oauth: la pantalla donde el usuario
// aprueba que una app (Claude.ai, ChatGPT...) se conecte por OAuth, y las apps ya conectadas.

export const solicitudOAuthSchema = z.object({
  cliente_nombre: z.string().nullable(),
  cliente_uri: z.string().nullable(),
  redirect_host: z.string(),
  scopes_disponibles: z.array(z.string()),
})

export const redireccionOAuthSchema = z.object({
  redirect_url: z.string(),
})

export const conexionOAuthSchema = z.object({
  id_autorizacion: z.number().int(),
  cliente_nombre: z.string().nullable(),
  scopes: z.array(z.string()),
  created_at: z.string(),
  last_used_at: z.string().nullable(),
})

export const conexionesOAuthSchema = z.array(conexionOAuthSchema)

export type SolicitudOAuth = z.infer<typeof solicitudOAuthSchema>
export type ConexionOAuth = z.infer<typeof conexionOAuthSchema>
