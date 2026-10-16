import Link from "next/link"
import { ChevronLeft, Plus, type LucideIcon } from "lucide-react"

export interface ModuleHeaderAction {
  href: string
  label: string
  icon?: LucideIcon
  /** Punto que late en vez del icono, para avisar que hay algo en curso. */
  live?: boolean
}

interface ModuleHeaderProps {
  back: { href: string; label: string }
  title: string
  description?: string
  action?: ModuleHeaderAction | null
}

/**
 * Encabezado de una seccion dentro de un modulo: volver a la portada, titulo y la accion
 * de registro a la derecha. La portada del modulo es el menu; aqui solo se sale o se registra.
 */
export function ModuleHeader({ back, title, description, action }: ModuleHeaderProps) {
  const ActionIcon = action?.icon ?? Plus

  return (
    <div className="flex flex-col gap-1">
      <Link
        href={back.href}
        className="-ml-1.5 inline-flex min-h-11 w-fit items-center gap-0.5 pr-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ChevronLeft className="size-5" aria-hidden />
        {back.label}
      </Link>
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 font-display text-[1.75rem] leading-[1.05] text-balance break-words sm:text-4xl">{title}</h1>
        {action ? (
          <Link
            href={action.href}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md bg-highlight px-3.5 text-sm font-semibold text-highlight-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {action.live ? (
              <span aria-hidden className="relative flex size-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60 motion-reduce:animate-none" />
                <span className="relative size-2 rounded-full bg-current" />
              </span>
            ) : (
              <ActionIcon className="size-4" aria-hidden />
            )}
            {action.label}
          </Link>
        ) : null}
      </div>
      {description ? (
        <p className="mt-1 hidden max-w-2xl text-base text-muted-foreground sm:block">{description}</p>
      ) : null}
    </div>
  )
}
