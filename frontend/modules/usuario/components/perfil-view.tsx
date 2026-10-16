"use client"

import { Bell, Bot, UserRound } from "lucide-react"
import { MenuGroup, MenuList, MenuRow } from "@/components/shell/menu-group"
import { PageHeader } from "@/components/shell/page-header"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { useProfile } from "@/modules/auth/hooks/useProfile"

/** Portada de Perfil: quien eres y un menu con cada ajuste en su propia pagina. */
export function PerfilView() {
  const { data: perfil } = useProfile()
  const initials = `${perfil?.nombre?.[0] ?? ""}${perfil?.apellido?.[0] ?? ""}`.toUpperCase() || "?"

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader title="Perfil" className="pb-0" />

      {perfil ? (
        <section className="flex items-center gap-3 rounded-xl bg-[color:var(--surface-lowest)] p-3 shadow-[var(--shadow-airy)] sm:p-4">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-md bg-highlight font-display text-lg text-highlight-foreground"
            aria-hidden
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">
              {perfil.nombre} {perfil.apellido}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              @{perfil.username} · {perfil.email}
            </p>
          </div>
        </section>
      ) : null}

      <MenuGroup title="Ajustes">
        <MenuList>
          <MenuRow href="/app/perfil/datos" icon={UserRound} title="Datos personales" detail="Nombre, email y telefono" />
          <MenuRow
            href="/app/perfil/notificaciones"
            icon={Bell}
            title="Notificaciones"
            detail="Recordatorios de entrenos y gastos"
          />
          <MenuRow
            href="/app/perfil/conexiones"
            icon={Bot}
            title="Conexiones con IA"
            detail="Claude, ChatGPT y claves de acceso"
          />
        </MenuList>
      </MenuGroup>

      <MenuGroup title="Apariencia">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[color:var(--surface-lowest)] p-3 shadow-[var(--shadow-airy)]">
          <span className="text-sm font-semibold">Tema</span>
          <ThemeToggle />
        </div>
      </MenuGroup>
    </div>
  )
}
