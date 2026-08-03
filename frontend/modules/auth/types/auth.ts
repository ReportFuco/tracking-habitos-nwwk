export interface AuthLoginPayload {
  username: string
  password: string
}

export interface AuthRegisterPayload {
  email: string
  password: string
  username: string
  nombre: string
  apellido: string
  telefono: string
}

export interface AuthTokenResponse {
  access_token: string
  token_type: string
}

export interface AuthRegisterResponse {
  id: number
  email: string
  is_active: boolean
  is_superuser: boolean
  is_verified?: boolean
}

// `/api/usuarios/perfil` es el mismo endpoint que consume el modulo usuario: antes cada
// modulo declaraba su propia interface (con is_active/is_superuser opcionales aca y
// obligatorios alla) y podian derivar. Ahora las dos apuntan al mismo schema Zod
// (FE-ZOD-002, ver modules/usuario/schemas/usuario.schema.ts).
export type { Usuario as UsuarioProfile } from "@/modules/usuario/types/usuario"
