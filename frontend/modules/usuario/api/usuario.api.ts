import { api } from "@/lib/api"
import { Usuario, UsuarioPerfilPatch } from "@/modules/usuario/types/usuario"

export const UsuariosAPI = {
  getAll: async (): Promise<Usuario[]> => {
    const { data } = await api.get("/api/usuarios/")
    return data
  },

  getPerfil: async (): Promise<Usuario> => {
    const { data } = await api.get("/api/usuarios/perfil")
    return data
  },

  updatePerfil: async (payload: UsuarioPerfilPatch): Promise<Usuario> => {
    const { data } = await api.patch("/api/usuarios/perfil", payload)
    return data
  },

  desactivar: async (idUsuario: number): Promise<void> => {
    await api.delete(`/api/usuarios/${idUsuario}`)
  },

  eliminarPermanente: async (idUsuario: number): Promise<void> => {
    await api.delete(`/api/usuarios/${idUsuario}/permanente`)
  },
}
