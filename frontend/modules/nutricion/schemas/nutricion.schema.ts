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

/** Una linea de lo que se comio: un producto con tabla nutricional o un alimento libre. */
export const consumoItemSchema = z
  .object({
    id_producto: z.number().int().positive().nullable(),
    nombre_alimento: z.string().trim().max(160).nullable(),
    cantidad_consumida: z.number().positive("La cantidad debe ser mayor a 0"),
    unidad_consumida: z.string().trim().min(1, "Indica una unidad"),
    calorias: z.number().min(0, "Las calorias no pueden ser negativas").nullable(),
    proteinas: z.number().min(0).nullable(),
    carbohidratos: z.number().min(0).nullable(),
    grasas: z.number().min(0).nullable(),
  })
  .refine((item) => item.id_producto !== null || !!item.nombre_alimento, {
    message: "Elige un producto o escribe el alimento",
  })
  .refine((item) => item.id_producto !== null || item.calorias !== null, {
    message: "Indica las calorias del alimento",
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
export type ConsumoItemForm = z.infer<typeof consumoItemSchema>
export type MetaCreateForm = z.infer<typeof metaCreateSchema>
export type PesoCreateForm = z.infer<typeof pesoCreateSchema>

// Adapter FE-ZOD-001 (ver docs/auditoria/PLAN_FRONTEND.md y lib/api-schema.ts): la
// respuesta del backend se valida contra estos schemas antes de entrar al cache, y los
// tipos de `types/nutricion.ts` se derivan de ellos en vez de declararse por separado.
export const consumoDetalleResponseSchema = z.object({
  id_consumo_detalle: z.number().int(),
  id_consumo: z.number().int(),
  id_producto: z.number().int().nullable(),
  nombre_alimento: z.string().nullable().default(null),
  nombre: z.string().default("Alimento"),
  cantidad_consumida: z.number(),
  unidad_consumida: z.string(),
  calorias: z.number().nullable().default(null),
  proteinas: z.number().nullable().default(null),
  carbohidratos: z.number().nullable().default(null),
  grasas: z.number().nullable().default(null),
  estimado: z.boolean().default(false),
})

// Los campos nuevos llevan default: el cache persistido antes de que existieran sigue
// siendo valido (ver la nota de QUERY_CACHE_SCHEMA_VERSION en lib/api-schema.ts).
export const consumoResponseSchema = z.object({
  id_consumo: z.number().int(),
  fecha_consumo: z.string(),
  tipo_comida: z.enum(TIPOS_COMIDA),
  observacion: z.string().nullable(),
  created_at: z.string(),
  detalles: z.array(consumoDetalleResponseSchema).default([]),
  total_calorias: z.number().nullable().default(null),
  total_proteinas: z.number().nullable().default(null),
  total_carbohidratos: z.number().nullable().default(null),
  total_grasas: z.number().nullable().default(null),
})

export const consumosListResponseSchema = z.array(consumoResponseSchema)

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
  contenido_neto: z.number().nullable().default(null),
  unidad_contenido: z.string().nullable().default(null),
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

/** GET /api/nutricion/codigo-barra/{codigo}: producto del catalogo o de Open Food Facts. */
export const codigoBarraResponseSchema = z.object({
  origen: z.enum(["catalogo", "openfoodfacts"]),
  codigo: z.string(),
  id_producto: z.number().int().nullable(),
  nombre: z.string(),
  marca: z.string().nullable(),
  porcion_cantidad: z.number().nullable(),
  porcion_unidad: z.string().nullable(),
  contenido_neto: z.number().nullable(),
  unidad_contenido: z.string().nullable(),
  calorias: z.number().nullable(),
  proteinas: z.number().nullable(),
  carbohidratos: z.number().nullable(),
  grasas: z.number().nullable(),
  fuente_nutricional: z.enum(["tabla", "openfoodfacts"]).nullable().default(null),
})

export type ConsumoResponse = z.infer<typeof consumoResponseSchema>
export type ConsumoDetalleResponse = z.infer<typeof consumoDetalleResponseSchema>
export type MetaNutricionalResponse = z.infer<typeof metaNutricionalResponseSchema>
export type PesoResponse = z.infer<typeof pesoResponseSchema>
export type TablaNutricionalResponse = z.infer<typeof tablaNutricionalResponseSchema>
export type CodigoBarraResponse = z.infer<typeof codigoBarraResponseSchema>
