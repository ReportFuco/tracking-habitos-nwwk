import { z } from "zod"

export const usuarioPerfilPatchSchema = z.object({
  username: z.string().max(20).optional(),
  nombre: z.string().max(20).optional(),
  apellido: z.string().max(20).optional(),
  telefono: z.string().max(11).optional(),
  email: z.string().email().optional(),
})

export type UsuarioPerfilPatchInput = z.infer<typeof usuarioPerfilPatchSchema>
