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

export interface MovimientoPatch {
  id_categoria?: number | null
  id_cuenta?: number | null
  tipo_movimiento?: TipoMovimiento | null
  tipo_gasto?: TipoGasto | null
  monto?: number | null
}

export interface AnaliticaResumenResponse {
  year: number
  month: number
  period_start: string
  period_end: string
  gasto_total: number
  ingreso_total: number
  balance_total: number
  gasto_fijo_total: number
  gasto_variable_total: number
  cantidad_movimientos: number
  ticket_promedio_gasto: number
  gasto_mayor: number
  tasa_ahorro_pct: number | null
  variacion_gasto_vs_mes_anterior: number | null
  variacion_gasto_vs_mes_anterior_pct: number | null
  proyeccion_gasto_fin_mes: number | null
}

export interface AnaliticaTendenciaMensualItem {
  year: number
  month: number
  gasto_total: number
  ingreso_total: number
  balance_total: number
}

export interface AnaliticaDistribucionItem {
  label: string
  total: number
  porcentaje: number
}
