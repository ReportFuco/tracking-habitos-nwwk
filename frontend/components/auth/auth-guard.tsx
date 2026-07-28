"use client"

import { usePathname, useRouter } from "next/navigation"
import { ReactNode, useEffect, useRef } from "react"
import { FullScreenLoader } from "@/components/feedback/loaders/full-screen-loader"
import { getValidStoredToken } from "@/lib/auth-session"
import { useProfile } from "@/modules/auth/hooks/useProfile"

interface AuthGuardProps {
  children: ReactNode
  redirectTo?: string
}

export function AuthGuard({ children, redirectTo = "/login" }: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const initialPathnameRef = useRef(pathname)
  const token = getValidStoredToken()
  const profileQuery = useProfile({ enabled: Boolean(token) })

  useEffect(() => {
    const next = initialPathnameRef.current
      ? `?next=${encodeURIComponent(initialPathnameRef.current)}`
      : ""

    if (!token || profileQuery.isError) {
      router.replace(`${redirectTo}${next}`)
    }
  }, [profileQuery.isError, redirectTo, router, token])

  if (!profileQuery.data) {
    return <FullScreenLoader accent="olive" label="Validando acceso..." mode="session" />
  }

  return <>{children}</>
}
