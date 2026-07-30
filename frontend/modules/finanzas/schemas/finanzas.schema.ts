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

export const movimientoCreateSchema = z
  .object({
    id_categoria: z.number().int().positive(),
    id_cuenta: z.number().int().positive(),
    tipo_movimiento: z.enum(TIPOS_MOVIMIENTO),
    tipo_gasto: z.enum(TIPOS_GASTO),
    monto: z.number().int().positive("El monto debe ser mayor a 0"),
    descripcion: z.string().trim().max(250).optional().or(z.literal("")),
    en_lugar_compra: z.boolean().default(false),
    latitud: z.number().finite().min(-90).max(90).optional(),
    longitud: z.number().finite().min(-180).max(180).optional(),
    precision_ubicacion: z.number().finite().nonnegative().optional(),
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
  .superRefine((value, context) => {
    const location = [value.latitud, value.longitud, value.precision_ubicacion]

    if (value.en_lugar_compra && value.tipo_movimiento !== "gasto") {
      context.addIssue({
        code: "custom",
        path: ["en_lugar_compra"],
        message: "La ubicacion del lugar de compra solo aplica a gastos",
      })
    }

    if (value.en_lugar_compra && location.some((item) => item === undefined)) {
      context.addIssue({
        code: "custom",
        path: ["en_lugar_compra"],
        message: "Primero permite capturar la ubicacion del lugar de compra",
      })
    }

    if (!value.en_lugar_compra && location.some((item) => item !== undefined)) {
      context.addIssue({
        code: "custom",
        path: ["en_lugar_compra"],
        message: "La ubicacion requiere confirmar que estas en el lugar de compra",
      })
    }
  })

export type CuentaCreateForm = z.infer<typeof cuentaCreateSchema>
export type MovimientoCreateForm = z.infer<typeof movimientoCreateSchema>
