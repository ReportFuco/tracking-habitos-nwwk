import { z } from "zod"

// Adapter validado (FE-ZOD-001/002, ver lib/api-schema.ts): `/api/usuarios/perfil` es la
// query critica que controla el guard offline (auth-guard.tsx confia en que este shape
// venga completo). `UsuarioProfile` (modulo auth) y `Usuario` (este modulo) apuntaban al
// mismo endpoint con dos interfaces manuales que podian derivar entre si; ahora ambas se
// derivan de este schema.
export const usuarioResponseSchema = z.object({
  id_usuario: z.number().int(),
  username: z.string(),
  nombre: z.string(),
  apellido: z.string(),
  telefono: z.string(),
  email: z.string(),
  is_active: z.boolean(),
  is_superuser: z.boolean(),
  created_at: z.string(),
})

export const usuariosListResponseSchema = z.array(usuarioResponseSchema)

export const usuarioPerfilPatchSchema = z.object({
  username: z.string().max(20).optional(),
  nombre: z.string().max(20).optional(),
  apellido: z.string().max(20).optional(),
  telefono: z.string().max(11).optional(),
  email: z.string().email().optional(),
})

export type Usuario = z.infer<typeof usuarioResponseSchema>
export type UsuarioPerfilPatchInput = z.infer<typeof usuarioPerfilPatchSchema>
