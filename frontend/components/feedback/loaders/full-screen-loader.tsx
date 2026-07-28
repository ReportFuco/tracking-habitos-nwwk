import { cn } from "@/lib/utils"

type LoaderAccent = "olive" | "brick" | "secondary"

interface FullScreenLoaderProps {
  accent?: LoaderAccent
  label?: string
  mode?: "boot" | "session"
}

const accentVar: Record<LoaderAccent, string> = {
  olive: "var(--primary)",
  brick: "var(--tertiary)",
  secondary: "var(--secondary)",
}

export function FullScreenLoader({
  accent = "olive",
  label = "Cargando tu espacio...",
  mode = "boot",
}: FullScreenLoaderProps) {
  const color = accentVar[accent]

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(66,81,47,0.12),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(132,49,31,0.08),transparent_28%)]" />

      <section className="relative flex w-full max-w-sm flex-col items-center text-center">
        <div
          className={cn(
            "flex items-center justify-center rounded-[1.5rem] bg-[color:var(--surface-lowest)] shadow-[var(--shadow-airy-lg)]",
            mode === "session" ? "size-20" : "h-20 w-44"
          )}
        >
          {mode === "session" ? (
            <div
              className="flex size-12 items-center justify-center rounded-full font-[family-name:var(--font-label)] text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--primary-foreground)]"
              style={{ background: color }}
            >
              AT
            </div>
          ) : (
            <span className="text-xl font-semibold tracking-tight">Atelier</span>
          )}
        </div>

        <div className="mt-6 h-3 w-full overflow-hidden rounded-full bg-[color:var(--surface-low)]">
          <div
            className="h-full w-1/2 animate-pulse rounded-full [animation-duration:1.6s]"
            style={{ background: color }}
          />
        </div>

        <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      </section>
    </main>
  )
}
