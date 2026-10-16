"use client"

import Link from "next/link"
import { ArrowRight, LogOut, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UsuarioProfile } from "@/modules/auth/types/auth"

interface AuthSessionCardProps {
  profile: UsuarioProfile | null
  loadingProfile: boolean
  submitting: boolean
  onLogout: () => Promise<void>
}

/** Login o registro abiertos con la sesion ya iniciada: quien eres y por donde seguir. */
export function AuthSessionCard({
  profile,
  loadingProfile,
  submitting,
  onLogout,
}: AuthSessionCardProps) {
  const initials = profile
    ? `${profile.nombre?.[0] ?? ""}${profile.apellido?.[0] ?? ""}`.toUpperCase() || "?"
    : "?"

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="font-display text-2xl text-foreground sm:text-3xl">Ya estas dentro</h2>
        <p className="text-sm text-muted-foreground">Tienes una sesion activa en este dispositivo.</p>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-[color:var(--surface-low)] p-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-md bg-highlight font-display text-base text-highlight-foreground"
          aria-hidden
        >
          {initials}
        </span>
        <div className="min-w-0">
          {profile ? (
            <>
              <p className="truncate text-sm font-semibold text-foreground">
                {profile.nombre} {profile.apellido}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                @{profile.username} · {profile.email}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {loadingProfile ? "Cargando perfil..." : "No se pudo cargar el perfil."}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button asChild size="lg" className="h-12 rounded-xl px-6">
          <Link href="/app/dashboard">
            Ir a mi app
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        {profile?.is_superuser ? (
          <Button
            asChild
            variant="ghost"
            size="lg"
            className="h-12 rounded-xl bg-[color:var(--surface-low)] px-6 hover:bg-[color:var(--surface-variant)]"
          >
            <Link href="/administrador">
              <Shield className="size-4" />
              Panel admin
            </Link>
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="lg"
          className="h-12 rounded-xl px-6"
          onClick={() => void onLogout()}
          disabled={submitting}
        >
          <LogOut className="size-4" />
          {submitting ? "Cerrando..." : "Cerrar sesion"}
        </Button>
      </div>
    </div>
  )
}
