import { BrandGlyph } from "@/components/brand/brand-mark"
import { BRAND } from "@/lib/brand"

type LoaderAccent = "olive" | "brick" | "secondary"

interface FullScreenLoaderProps {
  /** Se conserva por compatibilidad con los consumidores; Ritmo usa siempre el sol. */
  accent?: LoaderAccent
  label?: string
  mode?: "boot" | "session"
}

// Cuatro barras con los colores de los modulos que "laten" en secuencia.
const BARS = [
  "var(--module-finanzas-fill)",
  "var(--module-entrenamientos-fill)",
  "var(--module-nutricion-fill)",
  "var(--module-compras-fill)",
]

export function FullScreenLoader({
  label = "Cargando tu espacio...",
  mode = "boot",
}: FullScreenLoaderProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="flex w-full max-w-xs flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-14 items-center justify-center rounded-lg bg-primary text-primary-foreground dark:bg-highlight dark:text-highlight-foreground">
            <BrandGlyph className="size-8" />
          </span>
          {mode === "boot" ? <span className="font-display text-3xl">{BRAND.name}</span> : null}
        </div>

        <div className="flex h-10 items-end gap-1.5" aria-hidden>
          {BARS.map((color, index) => (
            <span
              key={color}
              className="block w-3 origin-bottom rounded-sm motion-safe:animate-[ritmo-beat_1.1s_ease-in-out_infinite]"
              style={{ background: color, height: "100%", animationDelay: `${index * 0.12}s` }}
            />
          ))}
        </div>

        <p className="text-sm text-muted-foreground" role="status">
          {label}
        </p>
      </section>
    </main>
  )
}
