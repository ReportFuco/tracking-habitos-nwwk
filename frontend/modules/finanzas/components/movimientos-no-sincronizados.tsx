"use client"

import { BandejaNoSincronizados } from "@/components/feedback/bandeja-no-sincronizados"
import { useFinanzas } from "@/modules/finanzas/hooks/useFinanzas"
import type { MovimientoCreate } from "@/modules/finanzas/types/finanzas"

/** Movimientos que la cola offline no logro sincronizar, visibles en todo el modulo. */
export function MovimientosNoSincronizados() {
  const { reintentarMovimiento } = useFinanzas()

  return (
    <BandejaNoSincronizados<MovimientoCreate>
      tipo="movimiento"
      titulo={(cantidad) =>
        cantidad === 1
          ? "1 movimiento sin sincronizar"
          : `${cantidad} movimientos sin sincronizar`
      }
      onReintentar={reintentarMovimiento}
    />
  )
}
