"use client"

import { ArrowDownLeft, ArrowLeftRight, HandCoins, Landmark, Tags, Target, Wallet } from "lucide-react"
import { ActionTile, MenuGroup, MenuList, MenuRow } from "@/components/shell/menu-group"
import { formatMonth } from "@/lib/dates"
import { formatCLP } from "@/lib/format"
import { useAnaliticaResumen, useFinanzas, useResumenSemanal } from "@/modules/finanzas/hooks/useFinanzas"
import { resumirSaldos } from "@/modules/finanzas/saldo"

/** Portada de finanzas: registrar (gasto o ingreso) y consultar, antes del resumen del mes. */
export function FinanzasHomeMenu() {
  const { data: resumen } = useAnaliticaResumen()
  const { data: semana } = useResumenSemanal()
  const { cuentas } = useFinanzas()
  const saldos = resumirSaldos(cuentas)

  return (
    <>
      <MenuGroup title="Registrar">
        <div className="grid grid-cols-2 gap-2">
          <ActionTile href="/app/finanzas/registrar-movimiento" icon={Wallet} label="Anotar gasto" module="finanzas" />
          <ActionTile
            href="/app/finanzas/registrar-movimiento?tipo=ingreso"
            icon={ArrowDownLeft}
            label="Anotar ingreso"
            module="compras"
          />
        </div>
      </MenuGroup>

      <MenuGroup title="Consultar">
        <MenuList>
          <MenuRow
            href="/app/finanzas/movimientos"
            icon={ArrowLeftRight}
            title="Movimientos"
            detail={
              resumen
                ? `${resumen.cantidad_movimientos} en ${formatMonth(resumen.year, resumen.month)}`
                : "Gastos e ingresos registrados"
            }
            module="finanzas"
          />
          <MenuRow
            href="/app/finanzas/metas"
            icon={Target}
            title="Metas de gasto"
            detail={semana?.meta_semanal ? `${formatCLP(semana.meta_semanal)} a la semana` : "Meta semanal y presupuestos"}
            module="finanzas"
          />
          <MenuRow href="/app/finanzas/deudas" icon={HandCoins} title="Deudas" detail="Lo que debes y lo que te deben" module="finanzas" />
          <MenuRow href="/app/finanzas/cuentas" icon={Landmark} title="Cuentas" detail={saldos.conSaldo > 0 ? `Disponible ${formatCLP(saldos.disponible)}` : "Bancos, tarjetas y efectivo"} module="finanzas" />
          <MenuRow href="/app/finanzas/categorias" icon={Tags} title="Categorias" detail="Como agrupas tus gastos" module="finanzas" />
        </MenuList>
      </MenuGroup>
    </>
  )
}
