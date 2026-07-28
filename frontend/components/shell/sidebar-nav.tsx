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
            <p className="px-3 font-[family-name:var(--font-label)] text-[0.7rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
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
                      "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-[color:var(--surface-lowest)] text-foreground shadow-[var(--shadow-airy)]"
                        : "text-muted-foreground hover:bg-[color:var(--surface-lowest)]/60 hover:text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-md transition-colors",
                        isActive
                          ? "bg-[color:var(--accent)]"
                          : "bg-transparent group-hover:bg-[color:var(--accent)]/40"
                      )}
                      style={
                        item.moduleColor && isActive
                          ? { color: item.moduleColor }
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
