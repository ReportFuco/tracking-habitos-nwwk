"use client"

import { Apple, ClipboardList, Scale, Target } from "lucide-react"
import { ActionTile, MenuGroup, MenuList, MenuRow } from "@/components/shell/menu-group"
import { ResumenDiario } from "@/modules/nutricion/components/resumen-diario"
import { useNutricion } from "@/modules/nutricion/hooks/useNutricion"
import { fechaLocal, metaVigente } from "@/modules/nutricion/lib/calorias"

/**
 * Portada de nutricion en dos grupos: registrar (consumo y peso, lo del dia a dia) y
 * consultar, donde cada fila trae su dato del momento en vez de una tarjeta aparte.
 */
export function NutricionHomeOverview() {
  const { consumos, metas, pesos, loading } = useNutricion()

  const today = fechaLocal()
  const consumosHoy = consumos.filter((c) => c.fecha_consumo.slice(0, 10) === today).length
  const ultimoPeso = pesos[0]?.peso_kg ?? null
  const metaActiva = metaVigente(metas, today) ?? metas[0]

  return (
    <div className="flex flex-col gap-5">
      <ResumenDiario />

      <MenuGroup title="Registrar">
        <div className="grid grid-cols-2 gap-2">
          <ActionTile href="/app/nutricion/consumos?nuevo=1" icon={Apple} label="Anotar comida" module="nutricion" />
          <ActionTile href="/app/nutricion/peso?nuevo=1" icon={Scale} label="Registrar peso" module="nutricion" />
        </div>
      </MenuGroup>

      <MenuGroup title="Consultar">
        <MenuList>
          <MenuRow
            href="/app/nutricion/consumos"
            icon={Apple}
            title="Comidas"
            detail={loading ? "Cargando..." : `${consumosHoy} ${consumosHoy === 1 ? "comida" : "comidas"} hoy`}
            module="nutricion"
          />
          <MenuRow
            href="/app/nutricion/peso"
            icon={Scale}
            title="Peso corporal"
            detail={loading ? "Cargando..." : ultimoPeso ? `Ultimo: ${ultimoPeso} kg` : "Sin registros aun"}
            module="nutricion"
          />
          <MenuRow
            href="/app/nutricion/metas"
            icon={Target}
            title="Metas"
            detail={
              loading
                ? "Cargando..."
                : metaActiva?.calorias_objetivo
                  ? `Meta activa: ${metaActiva.calorias_objetivo} kcal`
                  : "Sin meta activa"
            }
            module="nutricion"
          />
          <MenuRow
            href="/app/nutricion/tabla"
            icon={ClipboardList}
            title="Tabla nutricional"
            detail="Macros y porciones por producto"
            module="nutricion"
          />
        </MenuList>
      </MenuGroup>
    </div>
  )
}
