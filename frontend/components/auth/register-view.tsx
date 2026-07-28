"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"
import { ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { AuthSessionCard } from "@/components/auth/auth-session-card"
import { AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/modules/auth/hooks/useAuth"
import { authRegisterSchema } from "@/modules/auth/schemas/auth.schema"

const initialRegister = {
  email: "",
  password: "",
  username: "",
  nombre: "",
  apellido: "",
  telefono: "",
}

export function RegisterView() {
  const router = useRouter()
  const { profile, loadingProfile, submitting, isAuthenticated, register, logout } = useAuth()
  const [registerForm, setRegisterForm] = useState(initialRegister)

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const parsed = authRegisterSchema.safeParse(registerForm)

    if (!parsed.success) {
      toast.error("Revisa el formulario", {
        description: parsed.error.issues[0]?.message ?? "Completa los datos del registro.",
      })
      return
    }

    const result = await register(parsed.data)

    if (result.ok) {
      setRegisterForm(initialRegister)
      toast.success("Usuario registrado", {
        description: "Tu cuenta fue creada correctamente. Ahora puedes iniciar sesion.",
      })
      router.push("/login")
      return
    }

    toast.error("No pudimos completar el registro", {
      description: result.message,
    })
  }

  return (
    <AuthShell
      eyebrow="Registro"
      title="Crea tu cuenta con una experiencia mas dedicada."
      description="Completa tus datos y deja lista tu entrada a la app. Luego podras iniciar sesion desde tu acceso principal."
      accent="brick"
      secondaryCta={{
        href: "/login",
        label: "Ir a login",
        description: "Si ya tienes cuenta, puedes volver a la pantalla de acceso.",
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
              Crear cuenta
            </p>
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl sm:tracking-[-0.03em]">
              Empieza con una base simple y personal.
            </h2>
            <p className="hidden max-w-md text-sm leading-6 text-muted-foreground sm:block">
              Este registro crea tu usuario para autenticacion y deja lista la entrada al panel protegido.
            </p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="font-label text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  Nombre
                </label>
                <Input
                  value={registerForm.nombre}
                  onChange={(event) =>
                    setRegisterForm((prev) => ({ ...prev, nombre: event.target.value }))
                  }
                  placeholder="Valentina"
                  className="h-13 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-tertiary focus-visible:ring-0"
                />
              </div>
              <div className="space-y-2">
                <label className="font-label text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  Apellido
                </label>
                <Input
                  value={registerForm.apellido}
                  onChange={(event) =>
                    setRegisterForm((prev) => ({ ...prev, apellido: event.target.value }))
                  }
                  placeholder="Morales"
                  className="h-13 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-tertiary focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-label text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Username
              </label>
              <Input
                value={registerForm.username}
                onChange={(event) =>
                  setRegisterForm((prev) => ({ ...prev, username: event.target.value }))
                }
                placeholder="tu nombre de usuario"
                className="h-13 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-tertiary focus-visible:ring-0"
              />
            </div>

            <div className="space-y-2">
              <label className="font-label text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Correo
              </label>
              <Input
                type="email"
                value={registerForm.email}
                onChange={(event) =>
                  setRegisterForm((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="correo@dominio.com"
                className="h-13 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-tertiary focus-visible:ring-0"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-2">
                <label className="font-label text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  Telefono
                </label>
                <Input
                  value={registerForm.telefono}
                  onChange={(event) =>
                    setRegisterForm((prev) => ({ ...prev, telefono: event.target.value }))
                  }
                  placeholder="56912345678"
                  className="h-13 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-tertiary focus-visible:ring-0"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="font-label text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                    Password
                  </label>
                  <span className="text-xs text-muted-foreground">Entre 6 y 20 caracteres</span>
                </div>
                <Input
                  type="password"
                  value={registerForm.password}
                  onChange={(event) =>
                    setRegisterForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  placeholder="••••••••"
                  className="h-13 rounded-[1rem] border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-tertiary focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="hidden rounded-[1.5rem] bg-[color:var(--surface-low)] p-4 sm:block">
              <p className="text-sm leading-6 text-muted-foreground">
                Una vez creado el usuario, te llevamos al login para entrar con tu nueva cuenta y continuar al panel.
              </p>
            </div>

            <Button type="submit" size="lg" className="h-12 w-full rounded-xl bg-tertiary text-tertiary-foreground hover:bg-tertiary/90" disabled={submitting}>
              {submitting ? "Registrando..." : "Crear cuenta"}
            </Button>
          </form>

          <div className="hidden items-center justify-between rounded-[1.5rem] bg-[color:var(--surface-low)] px-4 py-4 sm:flex">
            <div>
              <p className="text-sm font-medium text-foreground">Ya tienes acceso?</p>
              <p className="text-sm text-muted-foreground">Puedes volver a la pantalla dedicada de ingreso.</p>
            </div>
            <Button asChild variant="ghost" className="rounded-full px-3">
              <Link href="/login">
                Iniciar sesion
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </AuthShell>
  )
}
