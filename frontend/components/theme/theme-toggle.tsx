"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ThemePreference } from "@/lib/theme"
import { useThemePreference } from "./use-theme"

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
]

/** Selector de tema segmentado. `compact` muestra solo iconos (topbar). */
export function ThemeToggle({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { preference, setPreference } = useThemePreference()

  return (
    <div
      role="radiogroup"
      aria-label="Tema de la app"
      className={cn("inline-flex rounded-lg bg-surface-low p-1", className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = preference === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={compact ? label : undefined}
            title={compact ? label : undefined}
            onClick={() => setPreference(value)}
            className={cn(
              "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              compact && "min-w-9 px-2",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {compact ? null : label}
          </button>
        )
      })}
    </div>
  )
}
