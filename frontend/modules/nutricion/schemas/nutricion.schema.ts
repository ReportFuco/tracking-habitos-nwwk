import { z } from "zod"

export const TIPOS_COMIDA = ["desayuno", "colacion", "almuerzo", "once", "cena", "snack"] as const

export const UNIDADES_CONSUMO = ["porcion", "unidad", "g", "ml", "taza", "cucharada"] as const

export const consumoCreateSchema = z.object({
  fecha_consumo: z
    .string()
    .trim()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/,
      "La fecha debe tener formato valido"
    ),
  tipo_comida: z.enum(TIPOS_COMIDA),
  observacion: z.string().trim().max(250).optional().or(z.literal("")),
})

export const consumoDetalleCreateSchema = z.object({
  id_consumo: z.number().int().positive(),
  id_producto: z.number().int().positive("Selecciona un producto"),
  cantidad_consumida: z.number().positive("La cantidad debe ser mayor a 0"),
  unidad_consumida: z.string().trim().min(1, "Indica una unidad"),
})

export const metaCreateSchema = z.object({
  fecha_inicio: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inicio invalida"),
  fecha_fin: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha fin invalida"),
  calorias_objetivo: z.number().positive("Debe ser mayor a 0"),
  proteinas_objetivo: z.number().positive("Debe ser mayor a 0"),
  carbohidratos_objetivo: z.number().positive("Debe ser mayor a 0"),
  grasas_objetivo: z.number().positive("Debe ser mayor a 0"),
})

export const pesoCreateSchema = z.object({
  fecha_registro: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida"),
  peso_kg: z.number().positive("El peso debe ser mayor a 0"),
})

export type ConsumoCreateForm = z.infer<typeof consumoCreateSchema>
export type ConsumoDetalleCreateForm = z.infer<typeof consumoDetalleCreateSchema>
export type MetaCreateForm = z.infer<typeof metaCreateSchema>
export type PesoCreateForm = z.infer<typeof pesoCreateSchema>

// Adapter FE-ZOD-001 (ver docs/auditoria/PLAN_FRONTEND.md y lib/api-schema.ts): la
// respuesta del backend se valida contra estos schemas antes de entrar al cache, y los
// tipos de `types/nutricion.ts` se derivan de ellos en vez de declararse por separado.
export const consumoResponseSchema = z.object({
  id_consumo: z.number().int(),
  fecha_consumo: z.string(),
  tipo_comida: z.enum(TIPOS_COMIDA),
  observacion: z.string().nullable(),
  created_at: z.string(),
})

export const consumosListResponseSchema = z.array(consumoResponseSchema)

export const consumoDetalleResponseSchema = z.object({
  id_consumo_detalle: z.number().int(),
  id_consumo: z.number().int(),
  id_producto: z.number().int(),
  cantidad_consumida: z.number(),
  unidad_consumida: z.string(),
})

export const consumoDetallesListResponseSchema = z.array(consumoDetalleResponseSchema)

export const metaNutricionalResponseSchema = z.object({
  id_meta: z.number().int(),
  fecha_inicio: z.string(),
  fecha_fin: z.string().nullable(),
  calorias_objetivo: z.number().nullable(),
  proteinas_objetivo: z.number().nullable(),
  carbohidratos_objetivo: z.number().nullable(),
  grasas_objetivo: z.number().nullable(),
  created_at: z.string(),
})

export const metasListResponseSchema = z.array(metaNutricionalResponseSchema)

export const pesoResponseSchema = z.object({
  id_peso: z.number().int(),
  fecha_registro: z.string(),
  peso_kg: z.number(),
  created_at: z.string(),
})

export const pesosListResponseSchema = z.array(pesoResponseSchema)

export const tablaNutricionalResponseSchema = z.object({
  id_tabla: z.number().int(),
  id_producto: z.number().int(),
  nombre_producto: z.string().nullable(),
  porcion_cantidad: z.number().nullable(),
  porcion_unidad: z.string().nullable(),
  calorias: z.number().nullable(),
  proteinas: z.number().nullable(),
  carbohidratos: z.number().nullable(),
  grasas: z.number().nullable(),
  azucares: z.number().nullable(),
  sodio: z.number().nullable(),
  fibra: z.number().nullable(),
  created_at: z.string(),
})

export const tablasListResponseSchema = z.array(tablaNutricionalResponseSchema)

export type ConsumoResponse = z.infer<typeof consumoResponseSchema>
export type ConsumoDetalleResponse = z.infer<typeof consumoDetalleResponseSchema>
export type MetaNutricionalResponse = z.infer<typeof metaNutricionalResponseSchema>
export type PesoResponse = z.infer<typeof pesoResponseSchema>
export type TablaNutricionalResponse = z.infer<typeof tablaNutricionalResponseSchema>
