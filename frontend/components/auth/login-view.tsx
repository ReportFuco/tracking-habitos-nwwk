"use client"

import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"
import { toast } from "sonner"
import { AuthSessionCard } from "@/components/auth/auth-session-card"
import { AuthShell } from "@/components/auth/auth-shell"
import { FullScreenLoader } from "@/components/feedback/loaders/full-screen-loader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { logUbicacionUsuario } from "@/lib/geolocation"
import { useAuth } from "@/modules/auth/hooks/useAuth"
import { authLoginSchema } from "@/modules/auth/schemas/auth.schema"

const initialLogin = {
  username: "",
  password: "",
}

export function LoginView() {
  const router = useRouter()
  const { profile, loadingProfile, submitting, isAuthenticated, login, logout } = useAuth()
  const [loginForm, setLoginForm] = useState(initialLogin)
  const [redirecting, setRedirecting] = useState(false)

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const parsed = authLoginSchema.safeParse(loginForm)

    if (!parsed.success) {
      toast.error("Revisa el formulario", {
        description: parsed.error.issues[0]?.message ?? "Completa los datos para iniciar sesion.",
      })
      return
    }

    void logUbicacionUsuario("login")
    const result = await login(parsed.data)

    if (result.ok) {
      setLoginForm(initialLogin)
      toast.success("Sesion iniciada", {
        description: "Bienvenido de nuevo.",
      })
      setRedirecting(true)
      const nextPath =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next")
          : null
      // Solo rutas internas: "//dominio" o "/\dominio" sacarian al usuario de la app.
      const esRutaInterna = /^\/(?![/\\])/.test(nextPath ?? "")
      router.push(esRutaInterna && nextPath ? nextPath : "/app/dashboard")
      return
    }

    toast.error("No pudimos iniciar sesion", {
      description: result.message,
    })
  }

  return (
    <>
      {redirecting ? (
        <div className="fixed inset-0 z-50">
          <FullScreenLoader accent="olive" label="Abriendo tu panel..." mode="session" />
        </div>
      ) : null}

      <AuthShell
        eyebrow="Acceso"
        title="Vuelve a tu ritmo."
        description="Tus cuentas, entrenos, comidas y compras te esperan donde los dejaste."
        accent="olive"
        secondaryCta={{
          href: "/register",
          label: "Crear cuenta",
          description: "Si aun no tienes cuenta, puedes registrarte desde aqui.",
        }}
      >
        {isAuthenticated ? (
          <AuthSessionCard
            profile={profile}
            loadingProfile={loadingProfile}
            submitting={submitting}
            onLogout={logout}
          />
        ) : (
          <div className="space-y-5 sm:space-y-6">
          <div className="space-y-2 sm:space-y-3">
            <p className="font-label text-[11px] uppercase tracking-[0.26em] text-muted-foreground sm:text-xs">
              Iniciar sesion
            </p>
            <h2 className="font-display text-2xl text-foreground sm:text-3xl">
              Entrar
            </h2>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              Con tu usuario o correo y tu clave.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="font-label text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Usuario o email
              </label>
              <Input
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((prev) => ({ ...prev, username: event.target.value }))
                }
                placeholder="usuario o correo"
                className="h-13 rounded-lg border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="font-label text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  Password
                </label>
                <span className="text-xs text-muted-foreground">Minimo 6 caracteres</span>
              </div>
              <Input
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="••••••••"
                className="h-13 rounded-lg border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
              />
            </div>

            <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-sm" disabled={submitting}>
              {submitting ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          </div>
        )}
      </AuthShell>
    </>
  )
}
