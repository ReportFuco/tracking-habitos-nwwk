export type TipoComida = "desayuno" | "colacion" | "almuerzo" | "once" | "cena" | "snack"

// Derivados de los schemas Zod en modules/nutricion/schemas/nutricion.schema.ts
// (FE-ZOD-001): el schema es la fuente de verdad, esto es solo el punto de import para
// el resto del modulo.
export type {
  ConsumoDetalleResponse,
  ConsumoResponse,
  MetaNutricionalResponse,
  PesoResponse,
  TablaNutricionalResponse,
} from "@/modules/nutricion/schemas/nutricion.schema"

export interface ConsumoCreate {
  fecha_consumo: string
  tipo_comida: TipoComida
  observacion?: string | null
}

export interface ConsumoPatch {
  fecha_consumo?: string | null
  tipo_comida?: TipoComida | null
  observacion?: string | null
}

export interface ConsumoDetalleCreate {
  id_consumo: number
  id_producto: number
  cantidad_consumida: number
  unidad_consumida: string
}

export interface ConsumoDetallePatch {
  id_producto?: number | null
  cantidad_consumida?: number | null
  unidad_consumida?: string | null
}

export interface MetaNutricionalCreate {
  fecha_inicio: string
  fecha_fin: string
  calorias_objetivo: number
  proteinas_objetivo: number
  carbohidratos_objetivo: number
  grasas_objetivo: number
}

export interface MetaNutricionalPatch {
  fecha_inicio?: string | null
  fecha_fin?: string | null
  calorias_objetivo?: number | null
  proteinas_objetivo?: number | null
  carbohidratos_objetivo?: number | null
  grasas_objetivo?: number | null
}

export interface PesoCreate {
  fecha_registro: string
  peso_kg: number
}

export interface PesoPatch {
  fecha_registro?: string | null
  peso_kg?: number | null
}

export interface TablaNutricionalCreate {
  id_producto: number
  porcion_cantidad: number
  porcion_unidad: string
  calorias: number
  proteinas: number
  carbohidratos: number
  grasas: number
  azucares?: number | null
  sodio?: number | null
  fibra?: number | null
}

export interface TablaNutricionalPatch {
  porcion_cantidad?: number | null
  porcion_unidad?: string | null
  calorias?: number | null
  proteinas?: number | null
  carbohidratos?: number | null
  grasas?: number | null
  azucares?: number | null
  sodio?: number | null
  fibra?: number | null
}
