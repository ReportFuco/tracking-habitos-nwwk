import { cn } from "@/lib/utils"
import { BRAND } from "@/lib/brand"

interface BrandMarkProps {
  /** Muestra solo el isotipo, sin el nombre. */
  iconOnly?: boolean
  size?: "sm" | "md" | "lg"
  /** "auto" sigue el tema; "inverse" es para fondos negros fijos (sidebar, bloques). */
  tone?: "auto" | "inverse"
  className?: string
}

const sizes = {
  sm: { box: "size-7", glyph: "size-4", text: "text-base" },
  md: { box: "size-8", glyph: "size-[1.15rem]", text: "text-lg" },
  lg: { box: "size-12", glyph: "size-7", text: "text-3xl" },
}

/** Isotipo de Ritmo: un pulso sobre un bloque. Es el mismo trazo que el icono de la PWA. */
export function BrandGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
      <path
        d="M2.5 12.5h4.2l2.6-6.5 4.4 12 2.6-5.5h5.2"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  )
}

export function BrandMark({ iconOnly = false, size = "md", tone = "auto", className }: BrandMarkProps) {
  const s = sizes[size]

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md",
          s.box,
          tone === "inverse"
            ? "bg-highlight text-highlight-foreground"
            : "bg-primary text-primary-foreground dark:bg-highlight dark:text-highlight-foreground",
        )}
      >
        <BrandGlyph className={s.glyph} />
      </span>
      {iconOnly ? (
        <span className="sr-only">{BRAND.name}</span>
      ) : (
        <span className={cn("font-display leading-none", s.text)}>{BRAND.name}</span>
      )}
    </span>
  )
}
