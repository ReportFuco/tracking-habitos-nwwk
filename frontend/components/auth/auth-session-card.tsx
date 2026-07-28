"use client"

import Link from "next/link"
import { CalendarDays, LogOut, ShieldCheck, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { UsuarioProfile } from "@/modules/auth/types/auth"

interface AuthSessionCardProps {
  profile: UsuarioProfile | null
  loadingProfile: boolean
  submitting: boolean
  onLogout: () => Promise<void>
}

export function AuthSessionCard({
  profile,
  loadingProfile,
  submitting,
  onLogout,
}: AuthSessionCardProps) {
  const isSuperuser = Boolean(profile?.is_superuser)
  const createdAt = profile?.created_at
    ? new Intl.DateTimeFormat("es-CL", {
        dateStyle: "long",
      }).format(new Date(profile.created_at))
    : null

  return (
    <div className="space-y-6">
      <div className="rounded-[1.75rem] bg-[color:var(--surface-low)] p-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <ShieldCheck className="size-4" />
          Sesion activa
        </div>
        <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em]">Ya estas dentro.</h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Tu cuenta ya esta validada y lista para entrar al panel. Desde aqui tiene mas sentido ver tu informacion personal que exponer datos tecnicos de la sesion.
        </p>
      </div>

      <div className="rounded-[1.75rem] bg-[color:var(--surface-low)] p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary/12 text-primary">
            <UserRound className="size-5" />
          </div>
          <div>
            <p className="font-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Perfil
            </p>
            <p className="text-lg font-semibold text-foreground">Tu espacio personal</p>
          </div>
        </div>

        {loadingProfile ? (
          <p className="mt-5 text-sm text-muted-foreground">Cargando perfil...</p>
        ) : profile ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.25rem] bg-white/75 p-4">
              <p className="font-label text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Nombre
              </p>
              <p className="mt-2 text-base font-medium text-foreground">
                {profile.nombre} {profile.apellido}
              </p>
            </div>
            <div className="rounded-[1.25rem] bg-white/75 p-4">
              <p className="font-label text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Username
              </p>
              <p className="mt-2 text-base font-medium text-foreground">@{profile.username}</p>
            </div>
            <div className="rounded-[1.25rem] bg-white/75 p-4">
              <p className="font-label text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Correo
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground/80">{profile.email}</p>
            </div>
            <div className="rounded-[1.25rem] bg-white/75 p-4">
              <p className="font-label text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                Telefono
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground/80">{profile.telefono}</p>
            </div>
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">No se pudo cargar el perfil.</p>
        )}
      </div>

      {profile ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1.5rem] bg-[color:var(--surface-low)] p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CalendarDays className="size-4 text-primary" />
              Cuenta autenticada
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {createdAt
                ? `Perfil activo desde ${createdAt}.`
                : "Tu perfil ya quedo listo para seguir navegando."}
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-[color:var(--surface-low)] p-5">
            <p className="font-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Siguiente capa
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Aqui podremos mostrar proximamente un resumen de actividad, avances y accesos recientes del usuario.
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="h-12 rounded-xl px-6">
          <Link href="/app/dashboard">Ir a mi app</Link>
        </Button>
        {isSuperuser ? (
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 rounded-xl border-0 bg-[color:var(--surface-low)] px-6 shadow-none hover:bg-[color:var(--surface-variant)]"
          >
            <Link href="/administrador">Ir al panel admin</Link>
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="lg"
          className="h-12 rounded-xl border-0 bg-[color:var(--surface-low)] px-6 shadow-none hover:bg-[color:var(--surface-variant)]"
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
