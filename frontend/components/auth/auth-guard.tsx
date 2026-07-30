"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ReactNode, useEffect, useRef } from "react"
import { CloudOff } from "lucide-react"
import { FullScreenLoader } from "@/components/feedback/loaders/full-screen-loader"
import { useProfile } from "@/modules/auth/hooks/useProfile"

interface AuthGuardProps {
  children: ReactNode
  redirectTo?: string
}

export function AuthGuard({ children, redirectTo = "/login" }: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const initialPathnameRef = useRef(pathname)
  const profileQuery = useProfile()

  useEffect(() => {
    const next = initialPathnameRef.current
      ? `?next=${encodeURIComponent(initialPathnameRef.current)}`
      : ""

    if (profileQuery.isError) {
      router.replace(`${redirectTo}${next}`)
    }
  }, [profileQuery.isError, redirectTo, router])

  if (!profileQuery.data && profileQuery.fetchStatus === "paused") {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-6 text-foreground">
        <section className="w-full max-w-md rounded-[2rem] bg-[color:var(--surface-lowest)] p-8 text-center shadow-[var(--shadow-airy-lg)]">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CloudOff className="size-6" aria-hidden />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">
            Necesitamos validar tu sesión.
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            No hay un perfil guardado en este dispositivo. Conéctate una vez para abrir tu espacio.
          </p>
          <Link
            href="/offline"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            Ver estado offline
          </Link>
        </section>
      </main>
    )
  }

  if (!profileQuery.data) {
    return <FullScreenLoader accent="olive" label="Validando acceso..." mode="session" />
  }

  return <>{children}</>
}
