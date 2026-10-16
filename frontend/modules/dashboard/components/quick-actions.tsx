import { Apple, ArrowDownLeft, Dumbbell, Wallet } from "lucide-react"
import { ActionTile, MenuGroup } from "@/components/shell/menu-group"

const ACTIONS = [
  { href: "/app/finanzas/registrar-movimiento", label: "Anotar gasto", icon: Wallet, module: "finanzas" },
  { href: "/app/entrenamientos/iniciar-fuerza", label: "Entrenar", icon: Dumbbell, module: "entrenamientos" },
  { href: "/app/nutricion/peso?nuevo=1", label: "Registrar peso", icon: Apple, module: "nutricion" },
  { href: "/app/finanzas/registrar-movimiento?tipo=ingreso", label: "Anotar ingreso", icon: ArrowDownLeft, module: "compras" },
] as const

/** Atajos a lo que se registra todos los dias; van primero para no tener que bajar a buscarlos. */
export function QuickActions() {
  return (
    <MenuGroup title="Registrar">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {ACTIONS.map((action) => (
          <ActionTile key={action.href} {...action} />
        ))}
      </div>
    </MenuGroup>
  )
}
