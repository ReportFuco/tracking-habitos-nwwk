"use client"

import { Mail, Phone, ShieldCheck, UserCheck, UserX } from "lucide-react"
import type { Usuario } from "@/modules/usuario/types/usuario"

interface PerfilSummaryCardProps {
  perfil: Usuario | null
  loading: boolean
}

const formatDate = (value: string) => {
  try {
    return new Date(value).toLocaleDateString("es-CL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  } catch {
    return value
  }
}

export function PerfilSummaryCard({ perfil, loading }: PerfilSummaryCardProps) {
  if (loading && !perfil) {
    return (
      <section className="rounded-[1.5rem] bg-[color:var(--surface-low)] p-6 sm:rounded-[1.75rem] sm:p-8">
        <p className="text-sm text-muted-foreground">Cargando tu perfil...</p>
      </section>
    )
  }

  if (!perfil) {
    return (
      <section className="rounded-[1.5rem] bg-[color:var(--surface-low)] p-6 sm:rounded-[1.75rem] sm:p-8">
        <p className="text-sm text-muted-foreground">
          No pudimos cargar tu perfil. Intenta recargar la pagina.
        </p>
      </section>
    )
  }

  const initials =
    `${perfil.nombre?.[0] ?? ""}${perfil.apellido?.[0] ?? ""}`.toUpperCase() || "?"

  return (
    <section className="overflow-hidden rounded-[1.5rem] bg-[color:var(--surface-low)] p-4 shadow-[var(--shadow-airy)] sm:rounded-[1.75rem] sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="relative overflow-hidden rounded-[1.4rem] bg-[color:var(--surface-lowest)] p-6 shadow-[var(--shadow-airy)] sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full blur-3xl"
            style={{
              background:
                "color-mix(in oklch, var(--primary) 16%, transparent)",
            }}
          />
          <div className="relative flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4 sm:gap-5">
                <span
                  className="flex size-16 shrink-0 items-center justify-center rounded-[1.2rem] bg-[color:var(--primary)] font-[family-name:var(--font-label)] text-lg font-medium text-[color:var(--primary-foreground)] shadow-[var(--shadow-airy)] sm:size-20 sm:text-xl"
                  aria-hidden
                >
                  {initials}
                </span>
                <div className="space-y-2">
                  <p className="font-label text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground">
                    Cuaderno personal
                  </p>
                  <div className="space-y-1">
                    <h2 className="text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
                      {perfil.nombre} {perfil.apellido}
                    </h2>
                    <p className="font-label text-[0.75rem] uppercase tracking-[0.18em] text-muted-foreground">
                      @{perfil.username}
                    </p>
                  </div>
                  <p className="max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                    Tu ficha central dentro de la app: identidad, contacto y estado actual de la cuenta.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-label text-[0.68rem] uppercase tracking-[0.16em] ${
                    perfil.is_active
                      ? "bg-[color:var(--tertiary-container)] text-[color:var(--tertiary)]"
                      : "bg-[color:var(--surface-low)] text-muted-foreground"
                  }`}
                >
                  {perfil.is_active ? (
                    <>
                      <UserCheck className="size-3" /> Activa
                    </>
                  ) : (
                    <>
                      <UserX className="size-3" /> Inactiva
                    </>
                  )}
                </span>
                {perfil.is_superuser ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--surface-low)] px-3 py-1.5 font-label text-[0.68rem] uppercase tracking-[0.16em] text-foreground">
                    <ShieldCheck className="size-3 text-[color:var(--primary)]" /> Superusuario
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.1rem] bg-[color:var(--surface-low)] p-4">
                <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                  Contacto principal
                </p>
                <div className="mt-3 flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 items-center justify-center rounded-full bg-[color:var(--surface-lowest)] text-[color:var(--primary)]">
                    <Mail className="size-4" />
                  </span>
                  <p className="min-w-0 text-sm leading-6 text-foreground">{perfil.email}</p>
                </div>
              </div>

              <div className="rounded-[1.1rem] bg-[color:var(--surface-low)] p-4">
                <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                  Telefono
                </p>
                <div className="mt-3 flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 items-center justify-center rounded-full bg-[color:var(--surface-lowest)] text-[color:var(--primary)]">
                    <Phone className="size-4" />
                  </span>
                  <p className="text-sm leading-6 text-foreground">
                    {perfil.telefono || "Aun no registras un telefono."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="rounded-[1.4rem] bg-[color:var(--surface-lowest)] p-6 shadow-[var(--shadow-airy)] sm:p-7">
          <p className="font-label text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
            Archivo
          </p>
          <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
            Señales de cuenta
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Un resumen rapido para ubicar tu estado actual antes de editar datos o tomar acciones sensibles.
          </p>

          <div className="mt-6 space-y-3">
            <div className="rounded-[1.1rem] bg-[color:var(--surface-low)] p-4">
              <p className="font-label text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
                Miembro desde
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">{formatDate(perfil.created_at)}</p>
            </div>
            <div className="rounded-[1.1rem] bg-[color:var(--surface-low)] p-4">
              <p className="font-label text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
                Username publico
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">@{perfil.username}</p>
            </div>
            <div className="rounded-[1.1rem] bg-[color:var(--surface-low)] p-4">
              <p className="font-label text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
                Rol
              </p>
              <p className="mt-2 text-sm text-foreground">
                {perfil.is_superuser ? "Acceso ampliado como superusuario." : "Cuenta personal de usuario."}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}
