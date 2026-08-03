import { afterEach, describe, expect, it, vi } from "vitest"

// Entreno activo, apertura, cierre y series son las respuestas persistidas que maneja la
// cola offline (FE-OFF-002/003/004) -- si el shape viene roto, mejor fallar rapido que
// guardar algo a medio completar en el cache. (FE-ZOD-002, item 2 del orden sugerido.)
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

const entrenoActivoValido = {
  id_entrenamiento_fuerza: 9,
  estado: "activo",
  inicio_at: "2026-08-03T10:00:00",
  fin_at: null,
  nombre_gimnasio: "Sport Life",
  series: [
    {
      id_fuerza_detalle: 1,
      es_calentamiento: false,
      cantidad_peso: 40,
      repeticiones: 10,
      id_ejercicio: 5,
      nombre_ejercicio: "Press banca",
    },
  ],
}

const entrenoValido = {
  id_entrenamiento: 3,
  id_entrenamiento_fuerza: 9,
  estado: "activo",
  inicio_at: "2026-08-03T10:00:00",
  fin_at: null,
}

afterEach(() => {
  vi.mocked(api.get).mockReset()
  vi.mocked(api.post).mockReset()
  vi.mocked(api.patch).mockReset()
})

describe("EntrenamientosAPI.getEntrenoFuerzaActivo: adapter validado", () => {
  it("parsea el entreno activo con sus series", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: entrenoActivoValido })

    const activo = await EntrenamientosAPI.getEntrenoFuerzaActivo()

    expect(activo.estado).toBe("activo")
    expect(activo.series).toHaveLength(1)
    expect(activo.series?.[0]?.nombre_ejercicio).toBe("Press banca")
  })

  it("rechaza con ApiSchemaError si falta un campo obligatorio (estado)", async () => {
    const sinEstado: Record<string, unknown> = { ...entrenoActivoValido }
    delete sinEstado.estado
    vi.mocked(api.get).mockResolvedValue({ data: sinEstado })

    await expect(EntrenamientosAPI.getEntrenoFuerzaActivo()).rejects.toBeInstanceOf(
      ApiSchemaError,
    )
  })

  it("rechaza si una serie del array viene con un tipo invalido", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...entrenoActivoValido,
        series: [{ ...entrenoActivoValido.series[0], cantidad_peso: "cuarenta" }],
      },
    })

    await expect(EntrenamientosAPI.getEntrenoFuerzaActivo()).rejects.toBeInstanceOf(
      ApiSchemaError,
    )
  })
})

describe("EntrenamientosAPI.createEntrenoFuerza / closeEntrenoFuerzaActivo: adapter validado", () => {
  it("createEntrenoFuerza parsea la respuesta de abrir", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: entrenoValido })

    const creado = await EntrenamientosAPI.createEntrenoFuerza({ id_gimnasio: 1 })

    expect(creado.id_entrenamiento_fuerza).toBe(9)
  })

  it("closeEntrenoFuerzaActivo parsea la respuesta de cerrar", async () => {
    vi.mocked(api.patch).mockResolvedValue({
      data: { ...entrenoValido, estado: "cerrado", fin_at: "2026-08-03T11:00:00" },
    })

    const cerrado = await EntrenamientosAPI.closeEntrenoFuerzaActivo({
      client_request_id: "11111111-1111-4111-8111-111111111111",
    })

    expect(cerrado.estado).toBe("cerrado")
  })

  it("rechaza si el backend devuelve id_entrenamiento_fuerza como texto", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { ...entrenoValido, id_entrenamiento_fuerza: "nueve" },
    })

    await expect(
      EntrenamientosAPI.createEntrenoFuerza({ id_gimnasio: 1 }),
    ).rejects.toBeInstanceOf(ApiSchemaError)
  })
})

describe("EntrenamientosAPI.createSerieFuerza / updateSerieFuerza: adapter validado", () => {
  it("createSerieFuerza parsea la serie creada", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: entrenoActivoValido.series[0] })

    const serie = await EntrenamientosAPI.createSerieFuerza({
      id_ejercicio: 5,
      es_calentamiento: false,
      cantidad_peso: 40,
      repeticiones: 10,
    })

    expect(serie.id_fuerza_detalle).toBe(1)
  })

  it("updateSerieFuerza rechaza si repeticiones no es un numero", async () => {
    vi.mocked(api.patch).mockResolvedValue({
      data: { ...entrenoActivoValido.series[0], repeticiones: null },
    })

    await expect(
      EntrenamientosAPI.updateSerieFuerza(1, { repeticiones: 12 }),
    ).rejects.toBeInstanceOf(ApiSchemaError)
  })
})
