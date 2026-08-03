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
