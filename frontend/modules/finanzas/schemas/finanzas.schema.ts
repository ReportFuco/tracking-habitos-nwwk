import { z } from "zod"

export const TIPOS_MOVIMIENTO = ["gasto", "ingreso"] as const
export const TIPOS_GASTO = ["variable", "fijo"] as const

const tipoMovimientoSchema = z.enum(TIPOS_MOVIMIENTO)
const tipoGastoSchema = z.enum(TIPOS_GASTO)

export type TipoMovimiento = z.infer<typeof tipoMovimientoSchema>
export type TipoGasto = z.infer<typeof tipoGastoSchema>

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
    tipo_movimiento: tipoMovimientoSchema,
    tipo_gasto: tipoGastoSchema,
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

// Adapter validado (FE-ZOD-001/002, item 3: movimientos paginados y cuentas): estas dos
// son las queries persistidas de finanzas, con la cola offline idempotente por
// client_request_id (ver modules/finanzas/offline/movimientos-offline.ts).
export const cuentaResponseSchema = z.object({
  id_cuenta: z.number().int(),
  nombre_cuenta: z.string(),
  nombre_banco: z.string().nullish(),
  nombre_producto: z.string(),
  id_producto_financiero: z.number().int(),
  created_at: z.string(),
})

export const cuentasListResponseSchema = z.array(cuentaResponseSchema)

const compraVinculadaResumenSchema = z.object({
  id_compra: z.number().int(),
})

export const movimientoResponseSchema = z.object({
  id_transaccion: z.number().int(),
  client_request_id: z.string().nullish(),
  tipo_movimiento: tipoMovimientoSchema,
  tipo_gasto: tipoGastoSchema,
  categoria: z.string().nullish(),
  nombre_cuenta: z.string().nullish(),
  compras_vinculadas: z.array(compraVinculadaResumenSchema).optional(),
  total_compras_vinculadas: z.number().nullish(),
  diferencia_total_compras: z.number().nullish(),
  monto: z.number(),
  descripcion: z.string().nullable(),
  en_lugar_compra: z.boolean(),
  latitud: z.number().nullish(),
  longitud: z.number().nullish(),
  precision_ubicacion: z.number().nullish(),
  created_at: z.string(),
  // Campo solo-cliente: la cola offline lo agrega sobre el movimiento optimista
  // (ver isMovimientoPendiente en movimientos-offline.ts). El backend nunca lo manda.
  pendiente_sincronizacion: z.boolean().optional(),
})

export const movimientosPageResponseSchema = z.object({
  items: z.array(movimientoResponseSchema),
  offset: z.number().int(),
  limit: z.number().int(),
  total_gasto_mensual: z.number(),
})

export type CuentaResponse = z.infer<typeof cuentaResponseSchema>
export type MovimientoResponse = z.infer<typeof movimientoResponseSchema>
export type MovimientosPageResponse = z.infer<typeof movimientosPageResponseSchema>
