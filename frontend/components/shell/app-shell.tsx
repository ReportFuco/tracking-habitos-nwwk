"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useProfile } from "@/modules/auth/hooks/useProfile"
import { MobileBottomNav } from "./mobile-bottom-nav"
import { SidebarNav } from "./sidebar-nav"
import { Topbar } from "./topbar"
import { adminBottomNavItems, adminNavSections, userNavSections, type NavSection } from "./nav-items"

interface AppShellProps {
  children: React.ReactNode
  variant?: "user" | "admin"
  sections?: NavSection[]
}

export function AppShell({ children, variant = "user", sections }: AppShellProps) {
  const [open, setOpen] = useState(false)
  const { data: profile = null } = useProfile()

  const navSections = sections ?? (variant === "admin" ? adminNavSections : userNavSections)
  const mobileNavItems = navSections.flatMap((section) => section.items)
  const isUser = variant === "user"
  const isAdmin = variant === "admin"
  const asideClassName = isUser
    ? "hidden w-72 shrink-0 bg-[color:var(--sidebar)] lg:sticky lg:top-0 lg:z-10 lg:flex lg:h-screen lg:flex-col"
    : cn(
        "fixed inset-y-0 left-0 z-40 w-72 shrink-0 bg-[color:var(--sidebar)] transition-transform duration-200 md:sticky md:top-0 md:z-10 md:flex md:h-screen md:flex-col md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )
  const usesMobileBottomNav = isUser

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1400px]">
        <aside className={asideClassName} aria-label="Navegacion principal">
          <div className="flex h-16 items-center justify-between px-5">
            <span className="font-semibold tracking-tight">Atelier</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menu"
            >
              <X className="size-5" />
            </Button>
          </div>
          <SidebarNav sections={navSections} onNavigate={() => setOpen(false)} />
        </aside>

        {open ? (
          <div
            className="fixed inset-0 z-30 bg-black/30 md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            profile={profile}
            onMenu={() => setOpen(true)}
            variant={variant}
            showMenuButton={!usesMobileBottomNav}
          />
          <main
            className={cn(
              "flex-1 px-4 py-6 sm:px-8 sm:py-10",
              isUser
                ? "pb-[calc(env(safe-area-inset-bottom)+5.25rem)] md:pb-[calc(env(safe-area-inset-bottom)+6rem)] lg:pb-10"
                : isAdmin
                  ? "pb-[calc(env(safe-area-inset-bottom)+5.25rem)] md:pb-10"
                  : "pb-10"
            )}
          >
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>

      {usesMobileBottomNav ? <MobileBottomNav items={mobileNavItems} /> : null}
      {isAdmin ? (
        <MobileBottomNav items={adminBottomNavItems} className="md:hidden" />
      ) : null}
    </div>
  )
}
