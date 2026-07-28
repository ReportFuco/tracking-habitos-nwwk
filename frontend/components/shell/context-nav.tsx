"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ContextCrumb {
  label: string
  href?: string
}

export interface ContextLink {
  label: string
  href: string
}

interface ContextNavProps {
  crumbs: ContextCrumb[]
  className?: string
}

export function ContextNav({ crumbs, className }: ContextNavProps) {
  return (
    <div
      className={cn(
        "-mx-4 sticky top-16 z-20 border-b border-white/30 bg-background px-4 py-3 sm:-mx-8 sm:px-8 md:static md:top-auto md:z-auto md:m-0 md:border-0 md:bg-transparent md:px-0 md:py-0",
        className
      )}
    >
      <nav aria-label="Breadcrumb" className="overflow-x-auto">
        <ol className="flex min-w-max items-center gap-2 text-sm text-muted-foreground">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1
            return (
              <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                {crumb.href && !isLast ? (
                  <Link href={crumb.href} className="transition hover:text-foreground">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={isLast ? "font-medium text-foreground" : undefined}>
                    {crumb.label}
                  </span>
                )}
                {!isLast ? <ChevronRight className="size-3.5 text-muted-foreground/70" /> : null}
              </li>
            )
          })}
        </ol>
      </nav>
    </div>
  )
}
