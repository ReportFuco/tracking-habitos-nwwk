import { z } from "zod"

export const TIPOS_MOVIMIENTO = ["gasto", "ingreso"] as const
export const TIPOS_GASTO = ["variable", "fijo"] as const

export const cuentaCreateSchema = z.object({
  id_producto_financiero: z
    .number({ message: "Selecciona un producto financiero" })
    .int()
    .positive("Selecciona un producto financiero"),
  nombre_cuenta: z.string().min(2, "El nombre de la cuenta debe tener al menos 2 caracteres"),
})

export const movimientoCreateSchema = z.object({
  id_categoria: z.number().int().positive(),
  id_cuenta: z.number().int().positive(),
  tipo_movimiento: z.enum(TIPOS_MOVIMIENTO),
  tipo_gasto: z.enum(TIPOS_GASTO),
  monto: z.number().int().positive("El monto debe ser mayor a 0"),
  descripcion: z.string().trim().max(250).optional().or(z.literal("")),
  created_at: z
    .string()
    .trim()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/,
      "La fecha debe tener formato valido"
    )
    .optional()
    .or(z.literal("")),
})

export type CuentaCreateForm = z.infer<typeof cuentaCreateSchema>
export type MovimientoCreateForm = z.infer<typeof movimientoCreateSchema>
