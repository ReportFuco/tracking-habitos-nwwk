"use client"

import { SaldoCuentas } from "@/modules/finanzas/components/saldo-cuentas"

/** Cuentas del usuario con su saldo; cada una se puede ajustar para que calce con el banco. */
export function CuentasManager() {
  return (
    <section className="flex flex-col gap-3">
      <SaldoCuentas ajustable />
      <p className="text-xs leading-5 text-muted-foreground">
        El saldo parte de lo que declaraste y se mueve con cada gasto e ingreso que anotas en esa cuenta. Si un día no
        calza con tu banco, usa «Ajustar» y pon lo que dice el banco.
      </p>
    </section>
  )
}
