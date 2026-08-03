// Derivados de los schemas Zod en modules/compras/schemas/compras.schema.ts (FE-ZOD-001):
// el schema es la fuente de verdad, esto es solo el punto de import para el resto del
// modulo.
export type {
  CadenaCreate,
  CadenaPatch,
  CadenaResponse,
  CompraDetalleResponse,
  CompraResponse,
  LocalResponse,
} from "@/modules/compras/schemas/compras.schema"

export interface LocalCreate {
  id_cadena?: number | null
  nombre_local: string
  latitud?: number | null
  longitud?: number | null
  direccion?: string | null
}

export interface LocalPatch {
  id_cadena?: number | null
  nombre_local?: string | null
  latitud?: number | null
  longitud?: number | null
  direccion?: string | null
}

export interface CompraCreate {
  id_local: number
  fecha_compra: string
}

export interface CompraPatch {
  id_local?: number | null
  fecha_compra?: string | null
}

export interface CompraDetalleCreate {
  id_compra: number
  id_producto: number
  cantidad_comprada: number
  unidad_compra: string
  precio_unitario: number
  precio_total: number
  cantidad_unidades: number
}

export interface CompraDetallePatch {
  id_producto?: number | null
  cantidad_comprada?: number | null
  unidad_compra?: string | null
  precio_unitario?: number | null
  precio_total?: number | null
  cantidad_unidades?: number | null
}
