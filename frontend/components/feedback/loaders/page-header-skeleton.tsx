import type { CSSProperties } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type ModuleTone = "finanzas" | "entrenamientos" | "nutricion" | "compras" | "admin" | "neutral"

interface PageHeaderSkeletonProps {
  module?: ModuleTone
  hasActions?: boolean
  className?: string
}

const moduleVar: Record<ModuleTone, string> = {
  finanzas: "var(--module-finanzas)",
  entrenamientos: "var(--module-entrenamientos)",
  nutricion: "var(--module-nutricion)",
  compras: "var(--module-compras)",
  admin: "var(--module-admin)",
  neutral: "var(--primary)",
}

export function PageHeaderSkeleton({
  module = "neutral",
  hasActions = false,
  className,
}: PageHeaderSkeletonProps) {
  const accent = moduleVar[module]

  return (
    <div
      className={cn(
        "flex flex-col gap-4 pb-8 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-2">
        <div
          className="h-5 w-24 rounded-full"
          style={
            {
              background: `color-mix(in oklch, ${accent} 14%, transparent)`,
            } as CSSProperties
          }
        />
        <Skeleton className="h-9 w-48 max-w-full rounded-[1rem] sm:h-11 sm:w-64" />
        <Skeleton className="h-4 w-full max-w-xl rounded-full" />
        <Skeleton className="h-4 w-3/4 max-w-md rounded-full" />
      </div>
      {hasActions ? <Skeleton tone="lowest" className="h-11 w-36 rounded-xl shadow-[var(--shadow-airy)]" /> : null}
    </div>
  )
}
