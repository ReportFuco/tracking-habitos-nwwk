import { z } from "zod"

export const UNIDADES_COMPRA = ["unidad", "kg", "g", "lt", "ml", "pack"] as const

// Adapter representativo de FE-ZOD-001 (ver docs/auditoria/PLAN_FRONTEND.md y
// lib/api-schema.ts): la respuesta del backend se valida contra estos schemas antes de
// entrar al cache, y los tipos de `types/compras.ts` se derivan de ellos en vez de
// declararse por separado.
export const cadenaResponseSchema = z.object({
  id_cadena: z.number().int(),
  nombre_cadena: z.string(),
  created_at: z.string(),
})

export const cadenasListResponseSchema = z.array(cadenaResponseSchema)

export const cadenaCreateRequestSchema = z.object({
  nombre_cadena: z.string(),
})

export const cadenaPatchRequestSchema = z.object({
  nombre_cadena: z.string().nullish(),
})

export type CadenaResponse = z.infer<typeof cadenaResponseSchema>
export type CadenaCreate = z.infer<typeof cadenaCreateRequestSchema>
export type CadenaPatch = z.infer<typeof cadenaPatchRequestSchema>

export const localResponseSchema = z.object({
  id_local: z.number().int(),
  id_cadena: z.number().int().nullable(),
  nombre_local: z.string(),
  nombre_cadena: z.string().nullable().optional(),
  latitud: z.number().nullable(),
  longitud: z.number().nullable(),
  direccion: z.string().nullable(),
  created_at: z.string(),
})

export const localesListResponseSchema = z.array(localResponseSchema)

export const compraResponseSchema = z.object({
  id_compra: z.number().int(),
  id_local: z.number().int(),
  nombre_local: z.string().nullable().optional(),
  nombre_cadena: z.string().nullable().optional(),
  fecha_compra: z.string(),
  total_compra: z.number(),
  created_at: z.string(),
})

export const comprasListResponseSchema = z.array(compraResponseSchema)

export const compraDetalleResponseSchema = z.object({
  id_detalle: z.number().int(),
  id_compra: z.number().int(),
  id_producto: z.number().int(),
  cantidad_comprada: z.number(),
  unidad_compra: z.string(),
  precio_unitario: z.number(),
  precio_total: z.number(),
  cantidad_unidades: z.number().int().nullable(),
})

export const compraDetallesListResponseSchema = z.array(compraDetalleResponseSchema)

export type LocalResponse = z.infer<typeof localResponseSchema>
export type CompraResponse = z.infer<typeof compraResponseSchema>
export type CompraDetalleResponse = z.infer<typeof compraDetalleResponseSchema>

export const compraCreateSchema = z.object({
  id_local: z.number().int().positive("Selecciona un local"),
  fecha_compra: z
    .string()
    .trim()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/,
      "La fecha debe tener formato valido"
    ),
})

export const compraDetalleCreateSchema = z.object({
  id_compra: z.number().int().positive(),
  id_producto: z.number().int().positive("Selecciona un producto"),
  cantidad_comprada: z.number().positive("Debe ser mayor a 0"),
  unidad_compra: z.string().trim().min(1),
  precio_unitario: z.number().positive("Debe ser mayor a 0"),
  precio_total: z.number().positive("Debe ser mayor a 0"),
  cantidad_unidades: z.number().int().positive("Debe ser mayor a 0"),
})

export type CompraCreateForm = z.infer<typeof compraCreateSchema>
export type CompraDetalleCreateForm = z.infer<typeof compraDetalleCreateSchema>
