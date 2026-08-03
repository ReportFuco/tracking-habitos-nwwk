import { z } from "zod"

// Adapter FE-ZOD-001 (ver docs/auditoria/PLAN_FRONTEND.md y lib/api-schema.ts): la
// respuesta del backend se valida contra estos schemas antes de entrar al cache, y los
// tipos de `types/catalogo.ts` se derivan de ellos en vez de declararse por separado.
export const marcaResponseSchema = z.object({
  id_marca: z.number().int(),
  nombre_marca: z.string(),
  created_at: z.string(),
})

export const marcasListResponseSchema = z.array(marcaResponseSchema)

export const productoResponseSchema = z.object({
  id_producto: z.number().int(),
  id_marca: z.number().int().nullable(),
  nombre_marca: z.string().nullable(),
  id_categoria: z.number().int().nullable(),
  categoria: z.string().nullable(),
  id_subcategoria: z.number().int().nullable(),
  subcategoria: z.string().nullable(),
  nombre_producto: z.string(),
  codigo_barra: z.string().nullable(),
  sabor: z.string().nullable(),
  formato: z.string().nullable(),
  contenido_neto: z.number().nullable(),
  unidad_contenido: z.string().nullable(),
  activo: z.boolean(),
  created_at: z.string(),
})

export const productosListResponseSchema = z.array(productoResponseSchema)

export type MarcaResponse = z.infer<typeof marcaResponseSchema>
export type ProductoResponse = z.infer<typeof productoResponseSchema>
