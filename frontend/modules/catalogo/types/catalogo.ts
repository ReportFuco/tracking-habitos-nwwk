// Derivados de los schemas Zod en modules/catalogo/schemas/catalogo.schema.ts (FE-ZOD-001):
// el schema es la fuente de verdad, esto es solo el punto de import para el resto del
// modulo.
export type { MarcaResponse, ProductoResponse } from "@/modules/catalogo/schemas/catalogo.schema"

export interface MarcaCreate {
  nombre_marca: string
}

export interface MarcaPatch {
  nombre_marca?: string | null
}

export interface ProductoCreate {
  id_marca?: number | null
  id_categoria?: number | null
  id_subcategoria?: number | null
  nombre_producto: string
  codigo_barra?: string | null
  sabor?: string | null
  formato?: string | null
  contenido_neto?: number | null
  unidad_contenido?: string | null
  activo?: boolean
}

export interface ProductoPatch {
  id_marca?: number | null
  id_categoria?: number | null
  id_subcategoria?: number | null
  nombre_producto?: string | null
  codigo_barra?: string | null
  sabor?: string | null
  formato?: string | null
  contenido_neto?: number | null
  unidad_contenido?: string | null
  activo?: boolean | null
}
