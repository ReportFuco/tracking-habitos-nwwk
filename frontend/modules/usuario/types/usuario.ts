export interface Usuario {
  id_usuario: number
  username: string
  nombre: string
  apellido: string
  telefono: string
  email: string
  is_active: boolean
  is_superuser: boolean
  created_at: string
}

export interface UsuarioPerfilPatch {
  username?: string
  nombre?: string
  apellido?: string
  telefono?: string
  email?: string
}
