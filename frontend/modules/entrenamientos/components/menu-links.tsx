"use client"

import { usePathname } from "next/navigation"
import { ContextNav } from "@/components/shell/context-nav"

export function EntrenamientosMenuLinks() {
  const pathname = usePathname()
  const currentLabel =
    pathname === "/app/entrenamientos/registrar" || pathname === "/app/entrenamientos/iniciar-fuerza"
      ? "Registrar entrenamiento"
      : pathname === "/app/entrenamientos/activo"
        ? "Entrenamiento activo"
        : pathname === "/app/entrenamientos/gimnasios"
          ? "Gimnasios"
        : pathname === "/app/entrenamientos/historico"
          ? "Entrenamientos anteriores"
          : "Resumen"

  return (
    <ContextNav
      crumbs={[
        { label: "Inicio", href: "/app/dashboard" },
        { label: "Entrenamientos", href: "/app/entrenamientos" },
        ...(pathname === "/app/entrenamientos" ? [] : [{ label: currentLabel }]),
      ]}
    />
  )
}
