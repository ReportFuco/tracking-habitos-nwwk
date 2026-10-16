import Link from "next/link"
import { ChevronRight, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type ModuleKey = "finanzas" | "entrenamientos" | "nutricion" | "compras"

interface MenuGroupProps {
  title: string
  children: React.ReactNode
  className?: string
}

/** Opciones de un modulo agrupadas bajo un titulo corto ("Registrar", "Consultar"). */
export function MenuGroup({ title, children, className }: MenuGroupProps) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

/** Lista de filas dentro de un mismo bloque, separadas por una linea. */
export function MenuList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl bg-[color:var(--surface-lowest)] shadow-[var(--shadow-airy)]">
      {children}
    </ul>
  )
}

interface MenuRowProps {
  href: string
  icon: LucideIcon
  title: string
  detail?: string
  /** Sin modulo (por ejemplo en Perfil) el icono va en tono neutro. */
  module?: ModuleKey
}

/** Fila de 56px: icono, nombre y una linea de contexto. Pensada para el pulgar. */
export function MenuRow({ href, icon: Icon, title, detail, module }: MenuRowProps) {
  return (
    <li>
      <Link
        href={href}
        className="group flex min-h-14 items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[color:var(--surface-low)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring active:bg-[color:var(--surface-low)]"
      >
        <span
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md"
          style={
            module
              ? {
                  background: `color-mix(in oklch, var(--module-${module}) 14%, transparent)`,
                  color: `var(--module-${module})`,
                }
              : { background: "var(--surface-low)", color: "var(--foreground)" }
          }
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {detail ? <span className="truncate text-xs text-muted-foreground">{detail}</span> : null}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" aria-hidden />
      </Link>
    </li>
  )
}

interface ActionTileProps {
  href: string
  icon: LucideIcon
  label: string
  module: ModuleKey
}

/** Acceso a registrar algo: icono sobre bloque de color del modulo y un verbo. */
export function ActionTile({ href, icon: Icon, label, module }: ActionTileProps) {
  return (
    <Link
      href={href}
      className="group flex min-h-14 items-center gap-3 rounded-xl bg-[color:var(--surface-lowest)] px-3 text-sm font-semibold shadow-[var(--shadow-airy)] transition-colors hover:bg-[color:var(--surface-low)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-[color:var(--surface-low)]"
    >
      <span
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md"
        style={{ background: `var(--module-${module}-fill)`, color: `var(--module-${module}-on)` }}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 leading-tight">{label}</span>
    </Link>
  )
}
