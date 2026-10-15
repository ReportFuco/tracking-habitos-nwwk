"use client"

import { BandejaNoSincronizados } from "@/components/feedback/bandeja-no-sincronizados"
import { useEntrenamientos } from "@/modules/entrenamientos/hooks/useEntrenamientos"
import type { SerieFuerzaCreate } from "@/modules/entrenamientos/types/entrenamientos"

/** Series que la cola offline no logro sincronizar, visibles en todo el modulo. */
export function SeriesNoSincronizadas() {
  const { reintentarSerieFuerza } = useEntrenamientos()

  return (
    <BandejaNoSincronizados<SerieFuerzaCreate>
      tipo="serie"
      titulo={(cantidad) =>
        cantidad === 1 ? "1 serie sin sincronizar" : `${cantidad} series sin sincronizar`
      }
      onReintentar={reintentarSerieFuerza}
    />
  )
}
