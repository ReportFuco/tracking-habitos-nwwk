"use client"

import { AxiosError } from "axios"
import { usePathname, useRouter } from "next/navigation"
import { ReactNode, useEffect, useState } from "react"
import { api } from "@/lib/api"

interface AdminGuardProps {
  children: ReactNode
}

type AdminStatus = "checking" | "authorized" | "forbidden"

export function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [status, setStatus] = useState<AdminStatus>("checking")

  useEffect(() => {
    const timer = setTimeout(() => {
      const validateAdmin = async () => {
        try {
          // Endpoint protegido en backend por current_superuser.
          await api.get("/api/usuarios/")
          setStatus("authorized")
        } catch (error) {
          if (error instanceof AxiosError) {
            if (error.response?.status === 401) {
              const next = pathname ? `?next=${encodeURIComponent(pathname)}` : ""
              router.replace(`/login${next}`)
              return
            }

            if (error.response?.status === 403) {
              setStatus("forbidden")
              return
            }
          }

          setStatus("forbidden")
        }
      }

      void validateAdmin()
    }, 0)

    return () => clearTimeout(timer)
  }, [pathname, router])

  if (status === "checking") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Validando permisos de administrador...</p>
      </main>
    )
  }

  if (status === "forbidden") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center p-6">
        <div className="w-full rounded-xl border p-6 text-center">
          <h1 className="text-xl font-semibold">Acceso restringido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu usuario no tiene permisos de superusuario para entrar al panel administrador.
          </p>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
