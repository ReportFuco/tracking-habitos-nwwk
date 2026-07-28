"use client"

import { ReactNode } from "react"
import { AuthGuard } from "@/components/auth/auth-guard"
import { AdminGuard } from "@/components/auth/admin-guard"
import { AppShell } from "@/components/shell/app-shell"

export default function AdministradorLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AdminGuard>
        <AppShell variant="admin">{children}</AppShell>
      </AdminGuard>
    </AuthGuard>
  )
}
