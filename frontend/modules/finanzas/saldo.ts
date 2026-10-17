import { formatCLP } from "@/lib/format"
import type { CuentaResponse } from "@/modules/finanzas/types/finanzas"

const normalizar = (texto: string | null | undefined) =>
  (texto ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es")

/**
 * Tarjetas y lineas de credito: su saldo es lo que se debe (negativo en el backend). Se
 * pregunta "cuanto debes" y no suma a lo disponible.
 */
export function esProductoCredito(nombreProducto: string | null | undefined) {
  const nombre = normalizar(nombreProducto)
  return nombre.includes("credito") || nombre.includes("cmr")
}

/** "$362.875" o "debes $120.000"; null si la cuenta no tiene saldo declarado. */
export function textoSaldo(cuenta: CuentaResponse): string | null {
  const saldo = cuenta.saldo_actual
  if (saldo == null) return null
  return esProductoCredito(cuenta.nombre_producto) ? `debes ${formatCLP(Math.max(0, -saldo))}` : formatCLP(saldo)
}

/**
 * Como queda el saldo despues de un movimiento nuevo, para confirmarlo al tiro sin esperar
 * al servidor. Un movimiento con fecha anterior al saldo declarado no lo mueve: el banco ya
 * lo tenia descontado cuando el usuario lo declaro.
 */
export function saldoTrasMovimiento(cuenta: CuentaResponse, movimiento: MovimientoNuevo): string | null {
  const saldo = saldoNumericoTras(cuenta, movimiento)
  return saldo == null ? null : textoSaldo({ ...cuenta, saldo_actual: saldo })
}

interface MovimientoNuevo {
  tipo: "gasto" | "ingreso"
  monto: number
  /** YYYY-MM-DD (o con hora) del movimiento. */
  fecha: string
}

function saldoNumericoTras(cuenta: CuentaResponse, movimiento: MovimientoNuevo): number | null {
  if (cuenta.saldo_actual == null) return null
  const desde = cuenta.fecha_saldo_inicial?.slice(0, 10)
  const entra = !desde || movimiento.fecha.slice(0, 10) > desde
  const delta = entra ? (movimiento.tipo === "ingreso" ? movimiento.monto : -movimiento.monto) : 0
  return cuenta.saldo_actual + delta
}

export type ProblemaSaldo = { tipo: "sin_saldo" } | { tipo: "no_alcanza"; disponible: number }

/**
 * Lo que impide anotar un movimiento en la cuenta: que aun no tenga saldo declarado (asi
 * todas parten del saldo real) o, en una cuenta que no es de credito, gastar mas de lo que
 * hay. En una tarjeta de credito comprar solo sube la deuda.
 */
export function revisarSaldo(cuenta: CuentaResponse, movimiento: MovimientoNuevo): ProblemaSaldo | null {
  if (cuenta.saldo_actual == null) return { tipo: "sin_saldo" }
  if (movimiento.tipo !== "gasto" || esProductoCredito(cuenta.nombre_producto)) return null
  const saldo = saldoNumericoTras(cuenta, movimiento)
  // Un gasto anterior al saldo declarado no lo mueve: el banco ya lo habia descontado.
  if (saldo == null || saldo === cuenta.saldo_actual) return null
  return saldo < 0 ? { tipo: "no_alcanza", disponible: cuenta.saldo_actual } : null
}

export interface ResumenSaldos {
  /** Suma de las cuentas que no son de credito y tienen saldo declarado. */
  disponible: number
  /** Lo que se debe en tarjetas de credito con saldo declarado (positivo). */
  deudaTarjetas: number
  conSaldo: number
  sinSaldo: CuentaResponse[]
}

export function resumirSaldos(cuentas: CuentaResponse[]): ResumenSaldos {
  const resumen: ResumenSaldos = { disponible: 0, deudaTarjetas: 0, conSaldo: 0, sinSaldo: [] }
  for (const cuenta of cuentas) {
    if (cuenta.saldo_actual == null) {
      resumen.sinSaldo.push(cuenta)
      continue
    }
    resumen.conSaldo += 1
    if (esProductoCredito(cuenta.nombre_producto)) {
      resumen.deudaTarjetas += Math.max(0, -cuenta.saldo_actual)
    } else {
      resumen.disponible += cuenta.saldo_actual
    }
  }
  return resumen
}
