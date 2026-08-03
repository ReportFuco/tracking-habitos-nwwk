import { api } from "@/lib/api"
import { parseApiResponse } from "@/lib/api-schema"
import {
  entrenoFuerzaResponseSchema,
  entrenoFuerzaSerieResponseSchema,
  entrenosFuerzaListResponseSchema,
  gimnasioResponseSchema,
  gimnasiosListResponseSchema,
  serieFuerzaResponseSchema,
} from "@/modules/entrenamientos/schemas/entrenamientos.schema"
import {
  EjercicioCreate,
  EjercicioEdit,
  EjerciciosParams,
  EjercicioResponse,
  EntrenoFuerzaCierre,
  EntrenoFuerzaCreate,
  EntrenoFuerzaResponse,
  EntrenoFuerzaSerieResponse,
  GimnasioCreate,
  GimnasioEdit,
  GimnasioResponse,
  Musculo,
  SubcategoriaMusculo,
  SerieFuerzaCreate,
  SerieFuerzaPatch,
  SerieFuerzaResponse,
} from "@/modules/entrenamientos/types/entrenamientos"

const toArray = <T>(payload: unknown): T[] => {
  if (Array.isArray(payload)) {
    return payload as T[]
  }

  if (
    payload &&
    typeof payload === "object" &&
    "results" in payload &&
    Array.isArray((payload as { results?: unknown[] }).results)
  ) {
    return (payload as { results: T[] }).results
  }

  return []
}

const asTexto = (valor: unknown): string | null =>
  typeof valor === "string" && valor.trim() ? valor : null

const asListaDeTexto = (valor: unknown): string[] | null => {
  if (!Array.isArray(valor)) {
    return null
  }

  const items = valor.filter((item): item is string => typeof item === "string" && item.trim() !== "")

  return items.length > 0 ? items : null
}

// Ejercicios y musculos vienen de un catalogo publico importado mas los que cada usuario
// crea a mano, y el backend fue cambiando de nombre de campo con el tiempo (id vs
// id_ejercicio, tipo vs tipo_ejercicio...). Estos normalizadores toleran esa variacion a
// proposito -- no se reemplazan por Zod estricto, que rompería esa tolerancia -- pero
// antes descartaban un item invalido en silencio. Ahora queda logueado (no solo en dev:
// esto es evidencia de un contrato roto, ver FE-ZOD-002 item 4).
const logDescarte = (endpoint: string, motivo: string, item: unknown) => {
  console.error(`${endpoint}: se descarto un item invalido (${motivo})`, item)
}

const normalizeEjercicio = (item: unknown, endpoint: string): EjercicioResponse | null => {
  if (!item || typeof item !== "object") {
    logDescarte(endpoint, "no es un objeto", item)
    return null
  }

  const record = item as Record<string, unknown>
  const id = Number(record.id_ejercicio ?? record.id ?? 0)
  const nombre = String(record.nombre ?? record.nombre_ejercicio ?? "").trim()
  const idSubcategoria = Number(record.id_subcategoria_musculo ?? 0)
  const idMusculo = Number(record.id_musculo ?? 0)
  const tipoLegacy = String(record.tipo ?? record.tipo_ejercicio ?? "").trim()

  if (!Number.isFinite(id) || id <= 0 || !nombre) {
    logDescarte(endpoint, "sin id/nombre validos", {
      id: record.id_ejercicio ?? record.id,
      nombre: record.nombre ?? record.nombre_ejercicio,
    })
    return null
  }

  return {
    id_ejercicio: id,
    nombre,
    id_subcategoria_musculo:
      Number.isFinite(idSubcategoria) && idSubcategoria > 0 ? idSubcategoria : null,
    url_video: typeof record.url_video === "string" ? record.url_video : null,
    id_musculo: Number.isFinite(idMusculo) && idMusculo > 0 ? idMusculo : null,
    musculo_codigo: typeof record.musculo_codigo === "string" ? record.musculo_codigo : null,
    musculo_nombre:
      typeof record.musculo_nombre === "string"
        ? record.musculo_nombre
        : tipoLegacy || null,
    subcategoria_codigo:
      typeof record.subcategoria_codigo === "string" ? record.subcategoria_codigo : null,
    subcategoria_nombre:
      typeof record.subcategoria_nombre === "string" ? record.subcategoria_nombre : null,
    tipo: tipoLegacy || (typeof record.musculo_nombre === "string" ? record.musculo_nombre : null),
    codigo_externo: asTexto(record.codigo_externo),
    nombre_original: asTexto(record.nombre_original),
    equipamiento: asTexto(record.equipamiento),
    musculos_secundarios: asListaDeTexto(record.musculos_secundarios),
    instrucciones: asListaDeTexto(record.instrucciones),
    url_imagen: asTexto(record.url_imagen),
    url_animacion: asTexto(record.url_animacion),
    atribucion: asTexto(record.atribucion),
  }
}

const normalizeSubcategoriaMusculo = (
  item: unknown,
  fallbackMusculoId: number,
  endpoint: string,
): SubcategoriaMusculo | null => {
  if (!item || typeof item !== "object") {
    logDescarte(endpoint, "subcategoria que no es un objeto", item)
    return null
  }

  const record = item as Record<string, unknown>
  const id = Number(record.id_subcategoria_musculo ?? record.id ?? 0)
  const idMusculo = Number(record.id_musculo ?? fallbackMusculoId)
  const nombre = String(record.nombre ?? record.label ?? "").trim()
  const codigo = String(record.codigo ?? record.value ?? nombre).trim()

  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(idMusculo) || idMusculo <= 0 || !nombre) {
    logDescarte(endpoint, "subcategoria sin id/musculo/nombre validos", {
      id: record.id_subcategoria_musculo ?? record.id,
      nombre: record.nombre ?? record.label,
    })
    return null
  }

  return {
    id_subcategoria_musculo: id,
    id_musculo: idMusculo,
    codigo,
    nombre,
    activo: typeof record.activo === "boolean" ? record.activo : true,
  }
}

const normalizeMusculo = (item: unknown, endpoint: string): Musculo | null => {
  if (!item || typeof item !== "object") {
    logDescarte(endpoint, "no es un objeto", item)
    return null
  }

  const record = item as Record<string, unknown>
  const id = Number(record.id_musculo ?? record.id ?? 0)
  const nombre = String(record.nombre ?? record.label ?? record.tipo ?? "").trim()
  const codigo = String(record.codigo ?? record.value ?? record.tipo ?? nombre).trim()

  if (!Number.isFinite(id) || id <= 0 || !nombre) {
    logDescarte(endpoint, "sin id/nombre validos", {
      id: record.id_musculo ?? record.id,
      nombre: record.nombre ?? record.label ?? record.tipo,
    })
    return null
  }

  return {
    id_musculo: id,
    codigo,
    nombre,
    activo: typeof record.activo === "boolean" ? record.activo : true,
    subcategorias: toArray<unknown>(record.subcategorias)
      .map((subcategoria) => normalizeSubcategoriaMusculo(subcategoria, id, endpoint))
      .filter((subcategoria): subcategoria is SubcategoriaMusculo => subcategoria !== null),
  }
}

const toEjercicioPayload = (payload: EjercicioCreate | EjercicioEdit) => {
  const body: Record<string, string | number | null> = {}

  if ("nombre" in payload && payload.nombre !== undefined) {
    body.nombre = payload.nombre ?? null
  }

  if ("id_subcategoria_musculo" in payload && payload.id_subcategoria_musculo !== undefined) {
    body.id_subcategoria_musculo = payload.id_subcategoria_musculo
  }

  if ("url_video" in payload && payload.url_video !== undefined) {
    body.url_video = payload.url_video
  }

  return body
}

export const EntrenamientosAPI = {
  getEjercicios: async (params?: EjerciciosParams): Promise<EjercicioResponse[]> => {
    // Los filtros vacios se omiten para que la URL -- y con ella la clave de cache -- sea
    // la misma con params undefined que con un objeto sin nada seleccionado.
    const activos = Object.fromEntries(
      Object.entries(params ?? {}).filter(([, valor]) => valor !== undefined && valor !== ""),
    )

    const endpoint = "GET /api/entrenamientos/ejercicios/"
    const { data } = await api.get(endpoint, {
      params: Object.keys(activos).length > 0 ? activos : undefined,
    })

    return toArray<unknown>(data)
      .map((item) => normalizeEjercicio(item, endpoint))
      .filter((item): item is EjercicioResponse => item !== null)
  },

  getEquipamientos: async (): Promise<string[]> => {
    const { data } = await api.get("/api/entrenamientos/ejercicios/equipamientos")

    return toArray<unknown>(data).filter((item): item is string => typeof item === "string")
  },

  createEjercicio: async (payload: EjercicioCreate): Promise<EjercicioResponse> => {
    const endpoint = "POST /api/entrenamientos/ejercicios/"
    const { data } = await api.post(endpoint, toEjercicioPayload(payload))
    return normalizeEjercicio(data, endpoint) ?? (data as EjercicioResponse)
  },

  updateEjercicio: async (idEjercicio: number, payload: EjercicioEdit): Promise<EjercicioResponse> => {
    const endpoint = "PATCH /api/entrenamientos/ejercicios/:id"
    const { data } = await api.patch(
      `/api/entrenamientos/ejercicios/${idEjercicio}`,
      toEjercicioPayload(payload),
    )
    return normalizeEjercicio(data, endpoint) ?? (data as EjercicioResponse)
  },

  deleteEjercicio: async (idEjercicio: number): Promise<void> => {
    await api.delete(`/api/entrenamientos/ejercicios/${idEjercicio}`)
  },

  getMusculos: async (): Promise<Musculo[]> => {
    const endpoint = "GET /api/entrenamientos/ejercicios/musculos"
    const { data } = await api.get(endpoint)

    return toArray<unknown>(data)
      .map((item) => normalizeMusculo(item, endpoint))
      .filter((item): item is Musculo => item !== null)
  },

  getGimnasios: async (q?: string): Promise<GimnasioResponse[]> => {
    const { data } = await api.get("/api/entrenamientos/gimnasio/", {
      params: q ? { q } : undefined,
    })
    return parseApiResponse(gimnasiosListResponseSchema, data, "GET /api/entrenamientos/gimnasio/")
  },

  getGimnasioById: async (idGimnasio: number): Promise<GimnasioResponse> => {
    const { data } = await api.get(`/api/entrenamientos/gimnasio/${idGimnasio}`)
    return parseApiResponse(gimnasioResponseSchema, data, "GET /api/entrenamientos/gimnasio/:id")
  },

  createGimnasio: async (payload: GimnasioCreate): Promise<GimnasioResponse> => {
    const { data } = await api.post("/api/entrenamientos/gimnasio/", payload)
    return parseApiResponse(gimnasioResponseSchema, data, "POST /api/entrenamientos/gimnasio/")
  },

  updateGimnasio: async (idGimnasio: number, payload: GimnasioEdit): Promise<GimnasioResponse> => {
    const { data } = await api.patch(`/api/entrenamientos/gimnasio/${idGimnasio}`, payload)
    return parseApiResponse(
      gimnasioResponseSchema,
      data,
      "PATCH /api/entrenamientos/gimnasio/:id",
    )
  },

  deleteGimnasio: async (idGimnasio: number): Promise<void> => {
    await api.delete(`/api/entrenamientos/gimnasio/${idGimnasio}`)
  },

  getEntrenosFuerza: async (): Promise<EntrenoFuerzaResponse[]> => {
    const { data } = await api.get("/api/entrenamientos/fuerza/")
    return parseApiResponse(entrenosFuerzaListResponseSchema, data, "GET /api/entrenamientos/fuerza/")
  },

  createEntrenoFuerza: async (payload: EntrenoFuerzaCreate): Promise<EntrenoFuerzaResponse> => {
    const { data } = await api.post("/api/entrenamientos/fuerza/", payload)
    return parseApiResponse(entrenoFuerzaResponseSchema, data, "POST /api/entrenamientos/fuerza/")
  },

  getEntrenoFuerzaActivo: async (): Promise<EntrenoFuerzaSerieResponse> => {
    const { data } = await api.get("/api/entrenamientos/fuerza/activo")
    return parseApiResponse(
      entrenoFuerzaSerieResponseSchema,
      data,
      "GET /api/entrenamientos/fuerza/activo",
    )
  },

  getEntrenoFuerzaDetalle: async (
    idEntrenamientoFuerza: number
  ): Promise<EntrenoFuerzaSerieResponse> => {
    const { data } = await api.get(`/api/entrenamientos/fuerza/${idEntrenamientoFuerza}`)
    return parseApiResponse(
      entrenoFuerzaSerieResponseSchema,
      data,
      "GET /api/entrenamientos/fuerza/:id",
    )
  },

  closeEntrenoFuerzaActivo: async (
    payload: EntrenoFuerzaCierre
  ): Promise<EntrenoFuerzaResponse> => {
    const { data } = await api.patch("/api/entrenamientos/fuerza/activo/cerrar", payload)
    return parseApiResponse(
      entrenoFuerzaResponseSchema,
      data,
      "PATCH /api/entrenamientos/fuerza/activo/cerrar",
    )
  },

  createSerieFuerza: async (payload: SerieFuerzaCreate): Promise<SerieFuerzaResponse> => {
    const { data } = await api.post("/api/entrenamientos/series/", payload)
    return parseApiResponse(serieFuerzaResponseSchema, data, "POST /api/entrenamientos/series/")
  },

  updateSerieFuerza: async (
    idFuerzaDetalle: number,
    payload: SerieFuerzaPatch
  ): Promise<SerieFuerzaResponse> => {
    const { data } = await api.patch(`/api/entrenamientos/series/${idFuerzaDetalle}`, payload)
    return parseApiResponse(serieFuerzaResponseSchema, data, "PATCH /api/entrenamientos/series/:id")
  },

  deleteSerieFuerza: async (idFuerzaDetalle: number): Promise<void> => {
    await api.delete(`/api/entrenamientos/series/${idFuerzaDetalle}`)
  },
}
