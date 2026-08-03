import { afterEach, describe, expect, it, vi } from "vitest"

// Adapter representativo de FE-ZOD-001: valida que la capa de validacion realmente
// bloquee un shape roto antes de que llegue al llamador (y de ahi al cache de Query).
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import { api } from "@/lib/api"
import { ApiSchemaError } from "@/lib/api-schema"
import { ComprasAPI } from "@/modules/compras/api/compras.api"

afterEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
})

describe("ComprasAPI.getCadenas: adapter validado", () => {
  it("devuelve la lista parseada cuando la respuesta es valida", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [{ id_cadena: 1, nombre_cadena: "Lider", created_at: "2026-01-01T00:00:00" }],
    })

    const cadenas = await ComprasAPI.getCadenas()

    expect(cadenas).toEqual([
      { id_cadena: 1, nombre_cadena: "Lider", created_at: "2026-01-01T00:00:00" },
    ])
  })

  it("rechaza con ApiSchemaError si el backend devuelve un shape roto", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [{ id_cadena: 1, nombre_cadena: null, created_at: "2026-01-01T00:00:00" }],
    })

    await expect(ComprasAPI.getCadenas()).rejects.toBeInstanceOf(ApiSchemaError)
  })

  it("el error identifica el endpoint y el campo, sin exponer el valor invalido", async () => {
    const tokenSensible = "sk-super-secreto-1234567890"

    vi.mocked(api.get).mockResolvedValue({
      data: [{ id_cadena: tokenSensible, nombre_cadena: "Lider", created_at: "2026-01-01T00:00:00" }],
    })

    expect.assertions(4)

    try {
      await ComprasAPI.getCadenas()
    } catch (err) {
      expect(err).toBeInstanceOf(ApiSchemaError)
      const error = err as ApiSchemaError
      expect(error.endpoint).toBe("GET /api/compras/cadena/")
      expect(error.message).toContain("id_cadena")
      expect(error.message).not.toContain(tokenSensible)
    }
  })
})

describe("ComprasAPI.createCadena: adapter validado", () => {
  it("devuelve la cadena creada cuando la respuesta es valida", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { id_cadena: 9, nombre_cadena: "Jumbo", created_at: "2026-02-01T00:00:00" },
    })

    const creada = await ComprasAPI.createCadena({ nombre_cadena: "Jumbo" })

    expect(creada).toEqual({ id_cadena: 9, nombre_cadena: "Jumbo", created_at: "2026-02-01T00:00:00" })
  })

  it("rechaza con ApiSchemaError si la respuesta viene incompleta", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { id_cadena: 9 } })

    await expect(ComprasAPI.createCadena({ nombre_cadena: "Jumbo" })).rejects.toBeInstanceOf(
      ApiSchemaError,
    )
  })
})
