import { afterEach, describe, expect, it, vi } from "vitest"

// Item 4 de FE-ZOD-002: catalogos usados para optimismo offline. Gimnasios recibe
// validacion estricta (patron FE-ZOD-001) porque no tiene normalizador ni tolerancia
// legacy. Ejercicios/musculos SIGUEN usando su normalizador tolerante a variantes de
// campo -- lo unico que cambia es que ahora un item descartado queda logueado en vez de
// desaparecer en silencio (ver comentario en entrenamientos.api.ts).
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}))

import { api } from "@/lib/api"
import { ApiSchemaError } from "@/lib/api-schema"
import { EntrenamientosAPI } from "@/modules/entrenamientos/api/entrenamientos.api"

const gimnasioValido = {
  id_gimnasio: 1,
  nombre_gimnasio: "Sport Life",
  nombre_cadena: null,
  direccion: "Av. Siempre Viva 123",
  comuna: "Providencia",
  latitud: -33.4,
  longitud: -70.6,
  activo: true,
  created_at: "2026-01-01T00:00:00",
}

afterEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.patch).mockReset()
})

describe("EntrenamientosAPI.getGimnasios: adapter validado estricto", () => {
  it("parsea la lista de gimnasios", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [gimnasioValido] })

    const gimnasios = await EntrenamientosAPI.getGimnasios()

    expect(gimnasios).toEqual([gimnasioValido])
  })

  it("rechaza con ApiSchemaError si falta un campo obligatorio (direccion)", async () => {
    const sinDireccion: Record<string, unknown> = { ...gimnasioValido }
    delete sinDireccion.direccion
    vi.mocked(api.get).mockResolvedValue({ data: [sinDireccion] })

    await expect(EntrenamientosAPI.getGimnasios()).rejects.toBeInstanceOf(ApiSchemaError)
  })

  it("createGimnasio parsea el gimnasio creado", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: gimnasioValido })

    const creado = await EntrenamientosAPI.createGimnasio({
      nombre_gimnasio: "Sport Life",
      nombre_cadena: null,
      direccion: "Av. Siempre Viva 123",
      comuna: "Providencia",
      latitud: -33.4,
      longitud: -70.6,
    })

    expect(creado.id_gimnasio).toBe(1)
  })
})

describe("EntrenamientosAPI.getEjercicios / getMusculos: normalizador tolerante, ya no silencioso", () => {
  it("acepta la variante legacy de campos (id/nombre_ejercicio/tipo) igual que antes", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [{ id: 7, nombre_ejercicio: "Sentadilla", tipo: "Piernas" }],
    })

    const ejercicios = await EntrenamientosAPI.getEjercicios()

    expect(ejercicios).toHaveLength(1)
    expect(ejercicios[0]).toMatchObject({ id_ejercicio: 7, nombre: "Sentadilla", tipo: "Piernas" })
  })

  it("descarta un ejercicio sin id/nombre validos y lo deja logueado (no silencioso)", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.mocked(api.get).mockResolvedValue({
      data: [{ id: 7, nombre_ejercicio: "Sentadilla" }, { foo: "bar" }],
    })

    const ejercicios = await EntrenamientosAPI.getEjercicios()

    expect(ejercicios).toHaveLength(1)
    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(consoleError.mock.calls[0]?.[0]).toContain("GET /api/entrenamientos/ejercicios/")

    consoleError.mockRestore()
  })

  it("getMusculos descarta una subcategoria invalida sin tumbar el musculo ni el resto", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    vi.mocked(api.get).mockResolvedValue({
      data: [
        {
          id_musculo: 1,
          nombre: "Pecho",
          subcategorias: [
            { id_subcategoria_musculo: 1, nombre: "Pecho superior" },
            { nombre: "" },
          ],
        },
      ],
    })

    const musculos = await EntrenamientosAPI.getMusculos()

    expect(musculos).toHaveLength(1)
    expect(musculos[0]?.subcategorias).toHaveLength(1)
    expect(consoleError).toHaveBeenCalledTimes(1)

    consoleError.mockRestore()
  })
})
