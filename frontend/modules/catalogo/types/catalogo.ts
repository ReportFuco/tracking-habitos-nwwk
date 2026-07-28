export interface MarcaCreate {
  nombre_marca: string
}

export interface MarcaPatch {
  nombre_marca?: string | null
}

export interface MarcaResponse {
  id_marca: number
  nombre_marca: string
  created_at: string
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

export interface ProductoResponse {
  id_producto: number
  id_marca: number | null
  nombre_marca: string | null
  id_categoria: number | null
  categoria: string | null
  id_subcategoria: number | null
  subcategoria: string | null
  nombre_producto: string
  codigo_barra: string | null
  sabor: string | null
  formato: string | null
  contenido_neto: number | null
  unidad_contenido: string | null
  activo: boolean
  created_at: string
}
