// Derivados de los schemas Zod en modules/finanzas/schemas/finanzas.schema.ts (FE-ZOD-002):
// el schema es la fuente de verdad, esto es solo el punto de import. Se importan (no solo
// re-exportan) porque este archivo tambien los usa mas abajo.
import type {
  CuentaResponse,
  MovimientoResponse,
  MovimientosPageResponse,
  TipoGasto,
  TipoMovimiento,
} from "@/modules/finanzas/schemas/finanzas.schema"

export type {
  AnaliticaDiariaResponse,
  AnaliticaDistribucionCategoriasResponse,
  AnaliticaDistribucionCuentasResponse,
  AnaliticaResumenResponse,
  AnaliticaTendenciaMensualItem,
  AnaliticaTendenciaMensualResponse,
} from "@/modules/finanzas/schemas/finanzas.schema"

export type {
  CuentaResponse,
  MovimientoResponse,
  MovimientosPageResponse,
  TipoGasto,
  TipoMovimiento,
}

export interface BancoCreate {
  nombre_banco: string
}

export interface BancoResponse {
  id_banco: number
  nombre_banco: string
  created_at: string
}

export interface ProductoFinancieroCreate {
  id_banco: number
  nombre_producto: string
  descripcion?: string | null
}

export interface ProductoFinancieroPatch {
  nombre_producto?: string | null
  descripcion?: string | null
  activo?: boolean | null
}

export interface ProductoFinancieroResponse {
  id_producto_financiero: number
  id_banco: number
  nombre_producto: string
  descripcion?: string | null
  nombre_banco?: string | null
  activo?: boolean
  created_at: string
}

export interface CategoriaCreate {
  nombre: string
}

export interface CategoriaPatch {
  nombre: string | null
}

export interface CategoriaResponse {
  id_categoria: number
  nombre: string
  created_at: string
}

export interface CuentaCreate {
  id_producto_financiero: number
  nombre_cuenta: string
}

export interface CuentaPatch {
  nombre_cuenta?: string | null
}

export interface MovimientoCreate {
  client_request_id?: string
  id_categoria: number
  id_cuenta: number
  tipo_movimiento: TipoMovimiento
  tipo_gasto: TipoGasto
  monto: number
  descripcion?: string | null
  en_lugar_compra?: boolean
  latitud?: number | null
  longitud?: number | null
  precision_ubicacion?: number | null
  created_at?: string
}

// El backend rechaza null explicito en estos campos (columnas NOT NULL): omitir = no cambiar.
export interface MovimientoPatch {
  id_categoria?: number
  id_cuenta?: number
  tipo_movimiento?: TipoMovimiento
  tipo_gasto?: TipoGasto
  monto?: number
  /** null borra la nota. */
  descripcion?: string | null
  /** YYYY-MM-DDTHH:mm:ss, hora de Chile. */
  created_at?: string
}

export interface MovimientosFiltros {
  year?: number
  month?: number
  tipo_movimiento?: TipoMovimiento
  id_categoria?: number
  id_cuenta?: number
  q?: string
}

