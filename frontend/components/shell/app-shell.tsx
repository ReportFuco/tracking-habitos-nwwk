"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useProfile } from "@/modules/auth/hooks/useProfile"
import { BrandMark } from "@/components/brand/brand-mark"
import { MobileBottomNav, userBottomNavOrder } from "./mobile-bottom-nav"
import { SidebarNav } from "./sidebar-nav"
import { Topbar } from "./topbar"
import { adminBottomNavItems, adminNavSections, userNavSections, type NavSection } from "./nav-items"

interface AppShellProps {
  children: React.ReactNode
  variant?: "user" | "admin"
  sections?: NavSection[]
}

/**
 * Entrada suave del contenido en cada cambio de ruta, en toda la app.
 *
 * Se anima el contenedor con la Web Animations API en vez de remontarlo con una `key` o
 * un template: asi no se reinician los layouts de modulo ni sus providers, y cubre
 * cualquier navegacion (un template solo se remonta cuando cambia su propio segmento, y
 * no veria pasar de Historial a Activo dentro de Entrenamientos). La primera carga no se
 * anima: de eso se encargan el loader y RetomarRuta.
 */
function useEntradaDeRuta() {
  const pathname = usePathname()
  const contenidoRef = useRef<HTMLDivElement | null>(null)
  const rutaPrevia = useRef(pathname)

  useEffect(() => {
    if (rutaPrevia.current === pathname) return
    rutaPrevia.current = pathname

    const contenido = contenidoRef.current
    if (
      !contenido ||
      typeof contenido.animate !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return
    }

    // Mismo movimiento que .ritmo-entrada (globals.css). Sin fill: al terminar no queda
    // ningun transform aplicado que afecte a los elementos fixed de la pagina.
    const animacion = contenido.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 320, easing: "cubic-bezier(0.32, 0.72, 0, 1)" },
    )
    return () => animacion.cancel()
  }, [pathname])

  return contenidoRef
}

export function AppShell({ children, variant = "user", sections }: AppShellProps) {
  const [open, setOpen] = useState(false)
  const contenidoRef = useEntradaDeRuta()
  const { data: profile = null } = useProfile()

  const navSections = sections ?? (variant === "admin" ? adminNavSections : userNavSections)
  const mobileNavItems = navSections.flatMap((section) => section.items)
  const isUser = variant === "user"
  const isAdmin = variant === "admin"
  const asideClassName = isUser
    ? "hidden w-72 shrink-0 bg-[color:var(--sidebar)] text-[color:var(--sidebar-foreground)] pt-[env(safe-area-inset-top)] lg:sticky lg:top-0 lg:z-10 lg:flex lg:h-screen lg:flex-col"
    : cn(
        "fixed inset-y-0 left-0 z-40 w-72 shrink-0 bg-[color:var(--sidebar)] text-[color:var(--sidebar-foreground)] pt-[env(safe-area-inset-top)] transition-transform duration-200 md:sticky md:top-0 md:z-10 md:flex md:h-screen md:flex-col md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )
  const usesMobileBottomNav = isUser

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1400px]">
        <aside className={asideClassName} aria-label="Navegacion principal">
          <div className="flex h-16 items-center justify-between px-5">
            <BrandMark size="md" tone="inverse" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-[color:var(--sidebar-foreground)] hover:bg-[color:var(--sidebar-accent)] hover:text-[color:var(--sidebar-foreground)] md:hidden"
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
          {/* Ocupa el lugar del header mientras es fixed (ver topbar.tsx). */}
          <div aria-hidden className={cn("h-(--app-header-h) shrink-0", isAdmin ? "md:hidden" : "lg:hidden")} />
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
            <div ref={contenidoRef} className="mx-auto w-full max-w-6xl">
              {children}
            </div>
          </main>
        </div>
      </div>

      {usesMobileBottomNav ? <MobileBottomNav items={mobileNavItems} preferredOrder={userBottomNavOrder} /> : null}
      {isAdmin ? (
        <MobileBottomNav items={adminBottomNavItems} className="md:hidden" />
      ) : null}
    </div>
  )
}
