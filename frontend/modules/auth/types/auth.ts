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

export interface UsuarioProfile {
  id_usuario: number
  username: string
  nombre: string
  apellido: string
  telefono: string
  email: string
  is_active?: boolean
  is_superuser?: boolean
  created_at: string
}
