import Link from "next/link"
import { Apple, ArrowDownLeft, Dumbbell, Plus, Wallet } from "lucide-react"

const ACTIONS = [
  { href: "/app/finanzas/registrar-movimiento", label: "Anotar gasto", icon: Wallet, module: "finanzas" },
  { href: "/app/entrenamientos/iniciar-fuerza", label: "Entrenar", icon: Dumbbell, module: "entrenamientos" },
  { href: "/app/nutricion/peso", label: "Registrar peso", icon: Apple, module: "nutricion" },
  { href: "/app/finanzas/registrar-movimiento?tipo=ingreso", label: "Anotar ingreso", icon: ArrowDownLeft, module: "compras" },
] as const

/** Atajos a lo que se registra todos los dias; pensados para el pulgar en la PWA. */
export function QuickActions() {
  return (
    <section aria-labelledby="acciones-rapidas" className="flex flex-col gap-3">
      <h2 id="acciones-rapidas" className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Registrar
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {ACTIONS.map(({ href, label, icon: Icon, module }) => (
          <Link
            key={href}
            href={href}
            className="group flex min-h-14 items-center gap-3 rounded-xl bg-[color:var(--surface-lowest)] px-3 text-sm font-semibold shadow-[var(--shadow-airy)] transition-colors hover:bg-[color:var(--surface-low)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md"
              style={{ background: `var(--module-${module}-fill)`, color: `var(--module-${module}-on)` }}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 leading-tight">{label}</span>
            <Plus className="size-4 text-muted-foreground transition group-hover:text-foreground" aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  )
}
