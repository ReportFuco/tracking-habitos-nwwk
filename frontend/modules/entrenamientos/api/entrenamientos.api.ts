import { api } from "@/lib/api"
import {
  EjercicioCreate,
  EjercicioEdit,
  EjerciciosParams,
  EjercicioResponse,
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

const normalizeEjercicio = (item: unknown): EjercicioResponse | null => {
  if (!item || typeof item !== "object") {
    return null
  }

  const record = item as Record<string, unknown>
  const id = Number(record.id_ejercicio ?? record.id ?? 0)
  const nombre = String(record.nombre ?? record.nombre_ejercicio ?? "").trim()
  const idSubcategoria = Number(record.id_subcategoria_musculo ?? 0)
  const idMusculo = Number(record.id_musculo ?? 0)
  const tipoLegacy = String(record.tipo ?? record.tipo_ejercicio ?? "").trim()

  if (!Number.isFinite(id) || id <= 0 || !nombre) {
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
  }
}

const normalizeSubcategoriaMusculo = (item: unknown, fallbackMusculoId: number): SubcategoriaMusculo | null => {
  if (!item || typeof item !== "object") {
    return null
  }

  const record = item as Record<string, unknown>
  const id = Number(record.id_subcategoria_musculo ?? record.id ?? 0)
  const idMusculo = Number(record.id_musculo ?? fallbackMusculoId)
  const nombre = String(record.nombre ?? record.label ?? "").trim()
  const codigo = String(record.codigo ?? record.value ?? nombre).trim()

  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(idMusculo) || idMusculo <= 0 || !nombre) {
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

const normalizeMusculo = (item: unknown): Musculo | null => {
  if (!item || typeof item !== "object") {
    return null
  }

  const record = item as Record<string, unknown>
  const id = Number(record.id_musculo ?? record.id ?? 0)
  const nombre = String(record.nombre ?? record.label ?? record.tipo ?? "").trim()
  const codigo = String(record.codigo ?? record.value ?? record.tipo ?? nombre).trim()

  if (!Number.isFinite(id) || id <= 0 || !nombre) {
    return null
  }

  return {
    id_musculo: id,
    codigo,
    nombre,
    activo: typeof record.activo === "boolean" ? record.activo : true,
    subcategorias: toArray<unknown>(record.subcategorias)
      .map((subcategoria) => normalizeSubcategoriaMusculo(subcategoria, id))
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
    const { data } = await api.get("/api/entrenamientos/ejercicios/", {
      params:
        params?.q || params?.tipo || params?.id_musculo || params?.id_subcategoria_musculo
          ? params
          : undefined,
    })

    return toArray<unknown>(data).map(normalizeEjercicio).filter((item): item is EjercicioResponse => item !== null)
  },

  createEjercicio: async (payload: EjercicioCreate): Promise<EjercicioResponse> => {
    const { data } = await api.post("/api/entrenamientos/ejercicios/", toEjercicioPayload(payload))
    return normalizeEjercicio(data) ?? (data as EjercicioResponse)
  },

  updateEjercicio: async (idEjercicio: number, payload: EjercicioEdit): Promise<EjercicioResponse> => {
    const { data } = await api.patch(`/api/entrenamientos/ejercicios/${idEjercicio}`, toEjercicioPayload(payload))
    return normalizeEjercicio(data) ?? (data as EjercicioResponse)
  },

  deleteEjercicio: async (idEjercicio: number): Promise<void> => {
    await api.delete(`/api/entrenamientos/ejercicios/${idEjercicio}`)
  },

  getMusculos: async (): Promise<Musculo[]> => {
    const { data } = await api.get("/api/entrenamientos/ejercicios/musculos")

    return toArray<unknown>(data).map(normalizeMusculo).filter((item): item is Musculo => item !== null)
  },

  getGimnasios: async (q?: string): Promise<GimnasioResponse[]> => {
    const { data } = await api.get("/api/entrenamientos/gimnasio/", {
      params: q ? { q } : undefined,
    })
    return data
  },

  getGimnasioById: async (idGimnasio: number): Promise<GimnasioResponse> => {
    const { data } = await api.get(`/api/entrenamientos/gimnasio/${idGimnasio}`)
    return data
  },

  createGimnasio: async (payload: GimnasioCreate): Promise<GimnasioResponse> => {
    const { data } = await api.post("/api/entrenamientos/gimnasio/", payload)
    return data
  },

  updateGimnasio: async (idGimnasio: number, payload: GimnasioEdit): Promise<GimnasioResponse> => {
    const { data } = await api.patch(`/api/entrenamientos/gimnasio/${idGimnasio}`, payload)
    return data
  },

  deleteGimnasio: async (idGimnasio: number): Promise<void> => {
    await api.delete(`/api/entrenamientos/gimnasio/${idGimnasio}`)
  },

  getEntrenosFuerza: async (): Promise<EntrenoFuerzaResponse[]> => {
    const { data } = await api.get("/api/entrenamientos/fuerza/")
    return data
  },

  createEntrenoFuerza: async (payload: EntrenoFuerzaCreate): Promise<EntrenoFuerzaResponse> => {
    const { data } = await api.post("/api/entrenamientos/fuerza/", payload)
    return data
  },

  getEntrenoFuerzaActivo: async (): Promise<EntrenoFuerzaSerieResponse> => {
    const { data } = await api.get("/api/entrenamientos/fuerza/activo")
    return data
  },

  getEntrenoFuerzaDetalle: async (
    idEntrenamientoFuerza: number
  ): Promise<EntrenoFuerzaSerieResponse> => {
    const { data } = await api.get(`/api/entrenamientos/fuerza/${idEntrenamientoFuerza}`)
    return data
  },

  closeEntrenoFuerzaActivo: async (): Promise<EntrenoFuerzaResponse> => {
    const { data } = await api.patch("/api/entrenamientos/fuerza/activo/cerrar")
    return data
  },

  createSerieFuerza: async (payload: SerieFuerzaCreate): Promise<SerieFuerzaResponse> => {
    const { data } = await api.post("/api/entrenamientos/series/", payload)
    return data
  },

  updateSerieFuerza: async (
    idFuerzaDetalle: number,
    payload: SerieFuerzaPatch
  ): Promise<SerieFuerzaResponse> => {
    const { data } = await api.patch(`/api/entrenamientos/series/${idFuerzaDetalle}`, payload)
    return data
  },

  deleteSerieFuerza: async (idFuerzaDetalle: number): Promise<void> => {
    await api.delete(`/api/entrenamientos/series/${idFuerzaDetalle}`)
  },
}
