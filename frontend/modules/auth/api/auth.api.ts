import { api } from "@/lib/api"
import {
  AuthLoginPayload,
  AuthRegisterPayload,
  AuthRegisterResponse,
  UsuarioProfile,
} from "@/modules/auth/types/auth"

export const AuthAPI = {
  login: async (payload: AuthLoginPayload): Promise<void> => {
    const body = new URLSearchParams()
    body.set("grant_type", "password")
    body.append("username", payload.username)
    body.append("password", payload.password)
    body.set("scope", "")

    await api.post("/auth/session/login", body.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })
  },

  logout: async (): Promise<void> => {
    await api.post("/auth/session/logout", undefined, {
      skipAuthRedirect: true,
    })
  },

  refreshSession: async (): Promise<void> => {
    await api.post("/auth/session/refresh", undefined, {
      skipAuthRedirect: true,
    })
  },

  register: async (payload: AuthRegisterPayload): Promise<AuthRegisterResponse> => {
    const { data } = await api.post("/auth/register", payload)
    return data
  },

  getProfile: async (): Promise<UsuarioProfile> => {
    const { data } = await api.get("/api/usuarios/perfil")
    return data
  },
}
