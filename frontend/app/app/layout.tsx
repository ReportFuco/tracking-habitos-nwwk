"use client"

import { ReactNode } from "react"
import { AuthGuard } from "@/components/auth/auth-guard"
import { AppShell } from "@/components/shell/app-shell"

export default function UserAppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AppShell variant="user">{children}</AppShell>
    </AuthGuard>
  )
}
