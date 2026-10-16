import { z } from "zod"

// Adapters validados (ver lib/api-schema.ts) de la carga muscular y las notas de
// seguimiento que deja la IA por MCP.

export const NIVELES_CARGA = ["sin_trabajo", "bajo", "moderado", "optimo", "alto"] as const
export type NivelCarga = (typeof NIVELES_CARGA)[number]

export const zonaCargaSchema = z.object({
  codigo: z.string(),
  nombre: z.string(),
  series: z.number(),
  directas: z.number().int(),
  indirectas: z.number().int(),
  tonelaje: z.number(),
  nivel: z.enum(NIVELES_CARGA),
  ultima_vez: z.string().nullable(),
  ejercicios: z.array(z.string()),
})

export const cargaMuscularResponseSchema = z.object({
  modo: z.enum(["7d", "semana"]),
  etiqueta: z.string(),
  desde: z.string(),
  hasta: z.string(),
  sesiones: z.number().int(),
  series_trabajo: z.number().int(),
  zonas: z.array(zonaCargaSchema),
})

export const seguimientoSchema = z.object({
  id_seguimiento: z.number().int(),
  // string y no enum: un tipo nuevo en el backend no debe romper la lista.
  tipo: z.string(),
  titulo: z.string(),
  contenido: z.string(),
  zonas: z.array(z.string()),
  origen: z.string().nullable(),
  created_at: z.string(),
})

export const seguimientosResponseSchema = z.object({
  seguimientos: z.array(seguimientoSchema),
})

export type ZonaCarga = z.infer<typeof zonaCargaSchema>
export type CargaMuscular = z.infer<typeof cargaMuscularResponseSchema>
export type Seguimiento = z.infer<typeof seguimientoSchema>
