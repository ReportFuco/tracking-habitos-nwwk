"use client"

import { usePathname } from "next/navigation"
import { ContextNav } from "@/components/shell/context-nav"

export function NutricionMenuLinks() {
  const pathname = usePathname() ?? ""
  const currentLabel = pathname.startsWith("/app/nutricion/consumos")
    ? "Consumos"
    : pathname.startsWith("/app/nutricion/peso")
      ? "Peso"
      : pathname.startsWith("/app/nutricion/metas")
        ? "Metas"
        : pathname.startsWith("/app/nutricion/tabla")
          ? "Tabla nutricional"
          : "Resumen"

  return (
    <ContextNav
      crumbs={[
        { label: "Inicio", href: "/app/dashboard" },
        { label: "Nutricion", href: "/app/nutricion" },
        ...(pathname === "/app/nutricion" ? [] : [{ label: currentLabel }]),
      ]}
    />
  )
}
