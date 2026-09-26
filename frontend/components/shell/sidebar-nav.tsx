"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { NavSection } from "./nav-items"

interface SidebarNavProps {
  sections: NavSection[]
  onNavigate?: () => void
}

export function SidebarNav({ sections, onNavigate }: SidebarNavProps) {
  const pathname = usePathname() ?? ""

  return (
    <nav aria-label="Navegacion principal" className="flex flex-col gap-7 px-4 py-6">
      {sections.map((section, idx) => (
        <div key={section.title ?? idx} className="flex flex-col gap-2">
          {section.title ? (
            <p className="px-3 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--sidebar-muted)]">
              {section.title}
            </p>
          ) : null}
          <ul className="flex flex-col gap-1">
            {section.items.map((item) => {
              const isActive =
                item.href === "/app/dashboard"
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sidebar-ring)]",
                      isActive
                        ? "bg-[color:var(--sidebar-primary)] text-[color:var(--sidebar-primary-foreground)]"
                        : "text-[color:var(--sidebar-muted)] hover:bg-[color:var(--sidebar-accent)] hover:text-[color:var(--sidebar-accent-foreground)]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-md transition-colors",
                        isActive ? "bg-[color:var(--sidebar-primary-foreground)]" : "bg-transparent",
                      )}
                      style={
                        isActive
                          ? { color: item.moduleFill ?? "var(--sidebar-primary)" }
                          : undefined
                      }
                    >
                      <Icon className="size-4" />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
