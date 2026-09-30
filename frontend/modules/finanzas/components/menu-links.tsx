"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "/app/finanzas", label: "Resumen", match: (p: string) => p === "/app/finanzas" },
  {
    href: "/app/finanzas/movimientos",
    label: "Movimientos",
    match: (p: string) => p.startsWith("/app/finanzas/movimientos") || p === "/app/finanzas/historico",
  },
  {
    href: "/app/finanzas/cuentas",
    label: "Cuentas",
    match: (p: string) => p === "/app/finanzas/cuentas" || p === "/app/finanzas/registrar-cuenta",
  },
  { href: "/app/finanzas/categorias", label: "Categorias", match: (p: string) => p === "/app/finanzas/categorias" },
]

/**
 * Pestañas del modulo de finanzas con el acceso a "Nuevo" siempre a mano. Reemplaza las
 * migas de pan: el menu lateral/inferior ya dice que estas en Finanzas.
 */
export function FinanzasMenuLinks() {
  const pathname = usePathname() ?? ""
  const enNuevo = pathname === "/app/finanzas/registrar-movimiento"

  return (
    <nav
      aria-label="Secciones de finanzas"
      className="-mx-4 flex items-center gap-2 border-b border-border px-4 sm:-mx-0 sm:px-0"
    >
      <ul className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => {
          const active = tab.match(pathname)
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-11 items-center px-2.5 text-sm font-semibold whitespace-nowrap sm:px-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {active ? <span aria-hidden className="absolute inset-x-2.5 -bottom-px h-[3px] bg-foreground sm:inset-x-3" /> : null}
              </Link>
            </li>
          )
        })}
      </ul>
      <Link
        href="/app/finanzas/registrar-movimiento"
        aria-current={enNuevo ? "page" : undefined}
        className={cn(
          "mb-1.5 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          enNuevo ? "bg-foreground text-background" : "bg-highlight text-highlight-foreground hover:opacity-90",
        )}
      >
        <Plus className="size-4" aria-hidden />
        Nuevo
      </Link>
    </nav>
  )
}
