"use client"

import { usePathname } from "next/navigation"
import { ContextNav } from "@/components/shell/context-nav"

export function FinanzasMenuLinks() {
  const pathname = usePathname()
  const currentLabel =
    pathname === "/app/finanzas/registrar-cuenta" || pathname === "/app/finanzas/cuentas"
      ? "Cuentas bancarias"
      : pathname === "/app/finanzas/registrar-movimiento"
        ? "Registrar movimientos"
        : pathname.startsWith("/app/finanzas/movimientos/")
          ? "Detalle de movimiento"
        : pathname === "/app/finanzas/movimientos"
          ? "Movimientos"
          : pathname === "/app/finanzas/historico"
            ? "Historico"
            : "Resumen"

  return (
    <ContextNav
      crumbs={[
        { label: "Inicio", href: "/app/dashboard" },
        { label: "Finanzas", href: "/app/finanzas" },
        ...(pathname === "/app/finanzas" ? [] : [{ label: currentLabel }]),
      ]}
    />
  )
}
