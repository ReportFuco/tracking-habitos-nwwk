import { describe, expect, it } from "vitest"
import { esProductoCredito, revisarSaldo, saldoTrasMovimiento } from "@/modules/finanzas/saldo"
import type { CuentaResponse } from "@/modules/finanzas/types/finanzas"

const cuenta = (extra: Partial<CuentaResponse> = {}): CuentaResponse => ({
  id_cuenta: 3,
  nombre_cuenta: "Falabella Fuco",
  nombre_banco: "Falabella",
  nombre_producto: "cuenta corriente",
  id_producto_financiero: 1,
  saldo_inicial: 10000,
  fecha_saldo_inicial: "2026-10-15",
  saldo_actual: 10000,
  created_at: "2026-01-01T00:00:00",
  ...extra,
})

const gasto = (monto: number, fecha = "2026-10-17") => ({ tipo: "gasto" as const, monto, fecha })

describe("saldo de las cuentas al anotar", () => {
  it("no deja anotar en una cuenta sin saldo declarado", () => {
    expect(revisarSaldo(cuenta({ saldo_actual: null }), gasto(100))).toEqual({ tipo: "sin_saldo" })
    expect(revisarSaldo(cuenta({ saldo_actual: null }), { ...gasto(100), tipo: "ingreso" })).toEqual({ tipo: "sin_saldo" })
  })

  it("no deja gastar mas de lo que hay, pero si justo lo que hay", () => {
    expect(revisarSaldo(cuenta(), gasto(10001))).toEqual({ tipo: "no_alcanza", disponible: 10000 })
    expect(revisarSaldo(cuenta(), gasto(10000))).toBeNull()
    expect(revisarSaldo(cuenta(), { ...gasto(50000), tipo: "ingreso" })).toBeNull()
  })

  it("en una tarjeta de credito comprar solo sube la deuda", () => {
    const tarjeta = cuenta({ nombre_producto: "crédito CMR", saldo_actual: -5000 })
    expect(esProductoCredito(tarjeta.nombre_producto)).toBe(true)
    expect(revisarSaldo(tarjeta, gasto(99999))).toBeNull()
    expect(saldoTrasMovimiento(tarjeta, gasto(1000))).toBe(`debes ${(6000).toLocaleString("es-CL", { style: "currency", currency: "CLP" })}`)
  })

  it("un gasto anterior al saldo declarado no lo mueve ni se bloquea", () => {
    expect(revisarSaldo(cuenta({ saldo_actual: -200 }), gasto(5000, "2026-10-10"))).toBeNull()
    expect(saldoTrasMovimiento(cuenta(), gasto(5000, "2026-10-15"))).toBe(saldoTrasMovimiento(cuenta(), gasto(0)))
  })
})
