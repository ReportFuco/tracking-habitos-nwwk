import { afterEach, describe, expect, it, vi } from "vitest"

// Perfil es la query critica del guard offline (auth-guard.tsx): si el shape viene roto,
// mejor fallar rapido que dejar pasar un perfil a medio completar. Cubre tambien la
// consolidacion de UsuarioProfile (auth) y Usuario (usuario) en un solo schema (FE-ZOD-002).
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

import { api } from "@/lib/api"
import { ApiSchemaError } from "@/lib/api-schema"
import { AuthAPI } from "@/modules/auth/api/auth.api"
import { UsuariosAPI } from "@/modules/usuario/api/usuario.api"

const perfilValido = {
  id_usuario: 1,
  username: "fuco",
  nombre: "Francisco",
  apellido: "Arancibia",
  telefono: "56900000000",
  email: "fuco@example.com",
  is_active: true,
  is_superuser: false,
  created_at: "2026-01-01T00:00:00",
}

afterEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.patch).mockReset()
})

describe("AuthAPI.getProfile / UsuariosAPI.getPerfil: mismo schema", () => {
  it("AuthAPI.getProfile devuelve el perfil parseado, con is_active/is_superuser incluidos", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: perfilValido })

    const perfil = await AuthAPI.getProfile()

    expect(perfil).toEqual(perfilValido)
  })

  it("AuthAPI.getProfile rechaza con ApiSchemaError si falta is_active (el bug que motivo esta tarjeta)", async () => {
    const sinIsActive: Record<string, unknown> = { ...perfilValido }
    delete sinIsActive.is_active
    vi.mocked(api.get).mockResolvedValue({ data: sinIsActive })

    await expect(AuthAPI.getProfile()).rejects.toBeInstanceOf(ApiSchemaError)
  })

  it("UsuariosAPI.getPerfil usa el mismo schema que AuthAPI.getProfile", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: perfilValido })

    const perfil = await UsuariosAPI.getPerfil()

    expect(perfil).toEqual(perfilValido)
  })

  it("UsuariosAPI.getAll rechaza si una fila del listado viene sin is_superuser", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [perfilValido, { ...perfilValido, id_usuario: 2, is_superuser: undefined }],
    })

    await expect(UsuariosAPI.getAll()).rejects.toBeInstanceOf(ApiSchemaError)
  })

  it("UsuariosAPI.updatePerfil valida la respuesta del PATCH", async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: { ...perfilValido, nombre: "Fuco" } })

    const actualizado = await UsuariosAPI.updatePerfil({ nombre: "Fuco" })

    expect(actualizado.nombre).toBe("Fuco")
  })
})
