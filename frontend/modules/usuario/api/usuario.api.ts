import { api } from "@/lib/api"
import { parseApiResponse } from "@/lib/api-schema"
import {
  usuarioResponseSchema,
  usuariosListResponseSchema,
} from "@/modules/usuario/schemas/usuario.schema"
import { Usuario, UsuarioPerfilPatch } from "@/modules/usuario/types/usuario"

export const UsuariosAPI = {
  getAll: async (): Promise<Usuario[]> => {
    const { data } = await api.get("/api/usuarios/")
    return parseApiResponse(usuariosListResponseSchema, data, "GET /api/usuarios/")
  },

  getPerfil: async (): Promise<Usuario> => {
    const { data } = await api.get("/api/usuarios/perfil")
    return parseApiResponse(usuarioResponseSchema, data, "GET /api/usuarios/perfil")
  },

  updatePerfil: async (payload: UsuarioPerfilPatch): Promise<Usuario> => {
    const { data } = await api.patch("/api/usuarios/perfil", payload)
    return parseApiResponse(usuarioResponseSchema, data, "PATCH /api/usuarios/perfil")
  },

  desactivar: async (idUsuario: number): Promise<void> => {
    await api.delete(`/api/usuarios/${idUsuario}`)
  },

  eliminarPermanente: async (idUsuario: number): Promise<void> => {
    await api.delete(`/api/usuarios/${idUsuario}/permanente`)
  },
}
