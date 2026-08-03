import { z } from "zod"

const optionalTrimmedText = z.string().trim().optional().nullable().or(z.literal(""))

export const gimnasioCreateSchema = z.object({
  nombre_gimnasio: z.string().trim().min(2, "El nombre del gimnasio debe tener al menos 2 caracteres"),
  nombre_cadena: optionalTrimmedText,
  direccion: z.string().trim().min(5, "La direccion debe tener al menos 5 caracteres"),
  comuna: optionalTrimmedText,
  latitud: z.number().finite("La latitud debe ser un numero valido"),
  longitud: z.number().finite("La longitud debe ser un numero valido"),
})

export const gimnasioEditSchema = z.object({
  nombre_gimnasio: z.string().trim().min(2).optional().nullable().or(z.literal("")),
  nombre_cadena: optionalTrimmedText,
  direccion: z.string().trim().min(5).optional().nullable().or(z.literal("")),
  comuna: optionalTrimmedText,
  latitud: z.number().finite().optional().nullable(),
  longitud: z.number().finite().optional().nullable(),
})

export const ejercicioCreateSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre del ejercicio debe tener al menos 2 caracteres"),
  id_subcategoria_musculo: z
    .number()
    .int("Selecciona una subcategoria valida")
    .positive("Selecciona una subcategoria"),
  url_video: z
    .string()
    .trim()
    .url("La URL del video no es valida")
    .optional()
    .nullable()
    .or(z.literal("")),
})

export const ejercicioEditSchema = z.object({
  nombre: z.string().trim().min(2).optional().nullable().or(z.literal("")),
  id_subcategoria_musculo: z.number().int().positive().optional().nullable(),
  url_video: z.string().trim().url("La URL del video no es valida").optional().nullable().or(z.literal("")),
})

export const entrenoFuerzaCreateSchema = z.object({
  id_gimnasio: z.number().int().positive(),
  observacion: optionalTrimmedText,
})

export const serieFuerzaCreateSchema = z.object({
  id_ejercicio: z.number().int().positive("Selecciona un ejercicio"),
  es_calentamiento: z.boolean(),
  cantidad_peso: z.number().nonnegative("El peso no puede ser negativo").finite("El peso no es valido"),
  repeticiones: z
    .number()
    .int("Las repeticiones deben ser un numero entero")
    .positive("Las repeticiones deben ser mayor a 0"),
})

export const serieFuerzaPatchSchema = z.object({
  id_ejercicio: z.number().int().positive().optional().nullable(),
  es_calentamiento: z.boolean().optional().nullable(),
  cantidad_peso: z.number().nonnegative().finite().optional().nullable(),
  repeticiones: z.number().int().positive().optional().nullable(),
})

export type GimnasioCreateForm = z.infer<typeof gimnasioCreateSchema>
export type GimnasioEditForm = z.infer<typeof gimnasioEditSchema>
export type EjercicioCreateForm = z.infer<typeof ejercicioCreateSchema>
export type EjercicioEditForm = z.infer<typeof ejercicioEditSchema>
export type EntrenoFuerzaCreateForm = z.infer<typeof entrenoFuerzaCreateSchema>
export type SerieFuerzaCreateForm = z.infer<typeof serieFuerzaCreateSchema>
export type SerieFuerzaPatchForm = z.infer<typeof serieFuerzaPatchSchema>

// Adapter validado (FE-ZOD-001/002): entreno activo, apertura, cierre y series son las
// respuestas persistidas que maneja la cola offline (FE-OFF-002/003/004). Gimnasios,
// ejercicios y musculos quedan afuera a proposito -- ya tienen normalizadores tolerantes
// a variantes de campo entre datos cacheados viejos y nuevos, y reemplazarlos por Zod
// estricto es un cambio mas delicado que se deja para cuando se cubra el catalogo.
const entrenoFuerzaBaseSchema = z.object({
  estado: z.string(),
  inicio_at: z.string(),
  fin_at: z.string().nullable(),
  nombre_gimnasio: z.string().nullish(),
  nombre_cadena: z.string().nullish(),
  comuna: z.string().nullish(),
  direccion: z.string().nullish(),
  latitud: z.number().nullish(),
  longitud: z.number().nullish(),
})

export const serieFuerzaResponseSchema = z.object({
  id_fuerza_detalle: z.number().int(),
  es_calentamiento: z.boolean(),
  cantidad_peso: z.number(),
  repeticiones: z.number().int(),
  id_ejercicio: z.number().int().nullish(),
  nombre_ejercicio: z.string().nullish(),
  tipo_ejercicio: z.string().nullish(),
  subcategoria_ejercicio: z.string().nullish(),
  url_video: z.string().nullish(),
  url_imagen: z.string().nullish(),
  url_animacion: z.string().nullish(),
})

export const entrenoFuerzaResponseSchema = entrenoFuerzaBaseSchema.extend({
  id_entrenamiento: z.number().int(),
  id_entrenamiento_fuerza: z.number().int(),
})

export const entrenosFuerzaListResponseSchema = z.array(entrenoFuerzaResponseSchema)

export const entrenoFuerzaSerieResponseSchema = entrenoFuerzaBaseSchema.extend({
  id_entrenamiento_fuerza: z.number().int(),
  series: z.array(serieFuerzaResponseSchema).optional(),
})

export type SerieFuerzaResponse = z.infer<typeof serieFuerzaResponseSchema>
export type EntrenoFuerzaResponse = z.infer<typeof entrenoFuerzaResponseSchema>
// sync_error es solo-cliente (ver types/entrenamientos.ts): la apertura offline lo agrega
// sobre el cache cuando el backend rechaza el alta, el backend nunca lo manda.
export type EntrenoFuerzaSerieResponse = z.infer<typeof entrenoFuerzaSerieResponseSchema> & {
  sync_error?: string | null
}
