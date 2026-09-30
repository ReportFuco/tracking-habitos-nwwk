"use client"

import Link from "next/link"
import { ReactNode } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { BrandMark } from "@/components/brand/brand-mark"
import { cn } from "@/lib/utils"

interface AuthShellProps {
  eyebrow: string
  title: string
  description: string
  /** olive = acceso (sol), brick = registro (tomate). Se mantienen los nombres por compatibilidad. */
  accent?: "olive" | "brick"
  secondaryCta?: {
    href: string
    label: string
    description?: string
  }
  children: ReactNode
}

const accentChip = {
  olive: "bg-highlight text-highlight-foreground",
  brick: "bg-[color:var(--module-entrenamientos-fill)] text-[color:var(--module-entrenamientos-on)]",
}

// Los cuatro modulos como bloques de color: el "cartel" de la marca.
const MODULE_BLOCKS = [
  { label: "Finanzas", detail: "Cuentas y gastos", fill: "--module-finanzas-fill", on: "--module-finanzas-on" },
  { label: "Fuerza", detail: "Series y cargas", fill: "--module-entrenamientos-fill", on: "--module-entrenamientos-on" },
  { label: "Nutricion", detail: "Comidas y peso", fill: "--module-nutricion-fill", on: "--module-nutricion-on" },
  { label: "Compras", detail: "Productos y precios", fill: "--module-compras-fill", on: "--module-compras-on" },
]

export function AuthShell({
  eyebrow,
  title,
  description,
  accent = "olive",
  secondaryCta,
  children,
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="lg:hidden">
        <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-3 sm:px-6">
          <Link href="/" aria-label="Volver al inicio">
            <BrandMark size="sm" />
          </Link>
          <span
            className={cn(
              "inline-flex rounded-sm px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
              accentChip[accent],
            )}
          >
            {eyebrow}
          </span>
        </div>
        <div className="px-4 pb-5 sm:px-6">
          <h1 className="font-display text-[1.7rem] leading-[1.05] sm:text-4xl">{title}</h1>
        </div>
      </div>

      <div className="mx-auto grid min-h-screen w-full max-w-7xl items-stretch gap-6 px-4 pb-6 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-6">
        <section className="hidden min-h-[320px] flex-col justify-between gap-10 rounded-4xl bg-[color:var(--sidebar)] p-12 text-[color:var(--sidebar-foreground)] lg:flex">
          <div className="flex items-start justify-between gap-4">
            <BrandMark size="md" tone="inverse" />
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-md border border-[color:var(--sidebar-border)] px-3 py-2 text-xs font-medium text-[color:var(--sidebar-muted)] transition hover:border-[color:var(--sidebar-foreground)] hover:text-[color:var(--sidebar-foreground)]"
            >
              <ArrowLeft className="size-3.5" />
              Inicio
            </Link>
          </div>

          <div className="max-w-xl space-y-5">
            <span
              className={cn(
                "inline-flex rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                accentChip[accent],
              )}
            >
              {eyebrow}
            </span>
            <h1 className="font-display text-5xl leading-[0.98] text-balance xl:text-6xl">{title}</h1>
            <p className="max-w-md text-lg leading-7 text-[color:var(--sidebar-muted)]">{description}</p>
          </div>

          <ul className="grid grid-cols-4 gap-2" aria-label="Modulos de la app">
            {MODULE_BLOCKS.map((block) => (
              <li
                key={block.label}
                className="flex aspect-[3/4] flex-col justify-end gap-1 rounded-lg p-3"
                style={{ background: `var(${block.fill})`, color: `var(${block.on})` }}
              >
                <span className="font-display text-sm leading-none">{block.label}</span>
                <span className="text-xs opacity-80">{block.detail}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex items-start justify-center lg:items-center lg:justify-end">
          <div className="w-full max-w-xl rounded-3xl bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:rounded-4xl sm:p-6 lg:p-8">
            {children}

            {secondaryCta ? (
              <div className="mt-6 flex flex-col gap-3 rounded-xl bg-[color:var(--surface-low)] px-4 py-4 sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:rounded-2xl">
                <p className="text-sm text-muted-foreground">
                  {secondaryCta.description ?? "Continuar con otra opcion de acceso"}
                </p>
                <Link
                  href={secondaryCta.href}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-foreground underline-offset-4 transition hover:underline"
                >
                  {secondaryCta.label}
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}
