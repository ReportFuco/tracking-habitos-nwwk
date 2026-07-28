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
