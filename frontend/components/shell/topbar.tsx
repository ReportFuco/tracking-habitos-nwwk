"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, LogOut, Menu, Shield } from "lucide-react"
import { toast } from "sonner"
import { FullScreenLoader } from "@/components/feedback/loaders/full-screen-loader"
import { Button } from "@/components/ui/button"
import { clearStoredSession } from "@/lib/auth-session"
import { AuthAPI } from "@/modules/auth/api/auth.api"
import type { UsuarioProfile } from "@/modules/auth/types/auth"

interface TopbarProps {
  profile: UsuarioProfile | null
  onMenu: () => void
  variant?: "user" | "admin"
  showMenuButton?: boolean
}

export function Topbar({
  profile,
  onMenu,
  variant = "user",
  showMenuButton = true,
}: TopbarProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [closingSession, setClosingSession] = useState(false)

  const handleLogout = async () => {
    setClosingSession(true)
    try {
      await AuthAPI.logout()
    } catch {
      // sesion local se limpia igualmente
    }
    clearStoredSession()
    queryClient.clear()
    toast.success("Sesion cerrada")
    router.replace("/login")
  }

  const initials = profile
    ? `${profile.nombre?.[0] ?? ""}${profile.apellido?.[0] ?? ""}`.toUpperCase() || "?"
    : "?"

  return (
    <>
      {closingSession ? (
        <div className="fixed inset-0 z-50">
          <FullScreenLoader accent="brick" label="Cerrando sesion..." mode="session" />
        </div>
      ) : null}

      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-transparent bg-[color:var(--background)] px-4 sm:bg-[color:var(--background)]/85 sm:backdrop-blur-md sm:px-8">
        {showMenuButton ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onMenu}
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
          </Button>
        ) : null}

        <div className="flex items-center gap-2">
          <Link
            href={variant === "admin" ? "/administrador" : "/app/dashboard"}
            className="font-semibold tracking-tight"
          >
            <span className="text-foreground">The Curated Life</span>
            {variant === "admin" ? (
              <span className="ml-2 rounded-md bg-[color:var(--tertiary-container)] px-2 py-0.5 font-[family-name:var(--font-label)] text-[0.65rem] uppercase tracking-wider text-[color:var(--tertiary)]">
                admin
              </span>
            ) : null}
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {variant === "admin" ? (
            <Link
              href="/app/dashboard"
              aria-label="Volver a la app"
              title="Volver a la app"
              className="flex size-9 items-center justify-center rounded-full bg-[color:var(--surface-low)] text-foreground transition hover:bg-[color:var(--surface-variant)]"
            >
              <ArrowLeft className="size-4" />
            </Link>
          ) : null}

          {profile ? (
            <div className="hidden items-center gap-3 sm:flex">
              <div className="text-right">
                <p className="text-sm font-medium leading-tight">
                  {profile.nombre} {profile.apellido}
                </p>
                <p className="font-[family-name:var(--font-label)] text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                  @{profile.username}
                </p>
              </div>
              <span
                className="flex size-9 items-center justify-center rounded-full bg-[color:var(--primary)] font-[family-name:var(--font-label)] text-xs font-medium text-[color:var(--primary-foreground)]"
                aria-hidden
              >
                {initials}
              </span>
            </div>
          ) : null}

          {profile?.is_superuser && variant === "user" ? (
            <Link
              href="/administrador"
              aria-label="Panel de administracion"
              title="Panel de administracion"
              className="flex size-9 items-center justify-center rounded-full bg-[color:var(--tertiary-container)] text-[color:var(--tertiary)] transition hover:opacity-80"
            >
              <Shield className="size-4" />
            </Link>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            disabled={closingSession}
            aria-label="Cerrar sesion"
            title="Cerrar sesion"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>
    </>
  )
}
