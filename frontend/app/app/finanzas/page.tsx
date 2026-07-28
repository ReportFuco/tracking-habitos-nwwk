import Link from "next/link"
import { ArrowRight, Landmark, Wallet, Receipt, History } from "lucide-react"
import { ContextNav } from "@/components/shell/context-nav"
import { PageHeader } from "@/components/shell/page-header"

const MODULE_COLOR = "var(--module-finanzas)"

const tiles = [
  {
    href: "/app/finanzas/registrar-movimiento",
    icon: Receipt,
    eyebrow: "Frente 01",
    title: "Registrar movimiento",
    description: "Anota gastos o ingresos con cuenta, categoria y monto.",
  },
  {
    href: "/app/finanzas/movimientos",
    icon: Wallet,
    eyebrow: "Revisar",
    title: "Ver movimientos",
    description: "Revisa tu diario financiero ordenado por fecha.",
  },
  {
    href: "/app/finanzas/registrar-cuenta",
    icon: Landmark,
    eyebrow: "Frente 02",
    title: "Registrar cuenta",
    description: "Agrega una cuenta bancaria con banco y tipo.",
  },
  {
    href: "/app/finanzas/cuentas",
    icon: History,
    eyebrow: "Revisar",
    title: "Ver cuentas",
    description: "Lista de cuentas disponibles para tus movimientos.",
  },
]

export default function FinanzasHomePage() {
  return (
    <div className="flex flex-col gap-5">
      <ContextNav
        crumbs={[
          { label: "Inicio", href: "/app/dashboard" },
          { label: "Finanzas" },
        ]}
      />

      <PageHeader
        eyebrow="Modulo"
        title="Finanzas"
        description="Dos frentes claros: cuentas bancarias y registro de movimientos."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <Link
              key={tile.href}
              href={tile.href}
              className="group flex flex-col gap-3 rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] transition active:scale-[0.99] sm:p-5"
            >
              <div className="flex items-center justify-between">
                <span
                  className="flex size-10 items-center justify-center rounded-full"
                  style={{
                    background: `color-mix(in oklch, ${MODULE_COLOR} 14%, transparent)`,
                    color: MODULE_COLOR,
                  }}
                >
                  <Icon className="size-4" />
                </span>
                <span className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                  {tile.eyebrow}
                </span>
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  {tile.title}
                </h2>
                <p className="text-sm leading-5 text-muted-foreground">{tile.description}</p>
              </div>
              <div
                className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium transition group-hover:translate-x-0.5"
                style={{ color: MODULE_COLOR }}
              >
                Entrar
                <ArrowRight className="size-4" />
              </div>
            </Link>
          )
        })}
      </div>

      <div className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
        <p className="font-label text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
          Nota
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          El historico y otras vistas quedan como apoyo secundario. El corazon del modulo son estos
          dos flujos.
        </p>
      </div>
    </div>
  )
}
