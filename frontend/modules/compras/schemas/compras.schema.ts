import { z } from "zod"

export const UNIDADES_COMPRA = ["unidad", "kg", "g", "lt", "ml", "pack"] as const

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
