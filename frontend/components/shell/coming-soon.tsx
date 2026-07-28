import { PageHeader } from "./page-header"

interface ComingSoonProps {
  eyebrow: string
  title: string
  description: string
  bullets?: string[]
  accentColor?: string
}

export function ComingSoon({
  eyebrow,
  title,
  description,
  bullets,
  accentColor = "var(--primary)",
}: ComingSoonProps) {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />

      <section className="surface-section flex flex-col gap-4">
        <span
          className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 font-[family-name:var(--font-label)] text-[0.7rem] uppercase tracking-[0.18em]"
          style={{
            background: `color-mix(in oklch, ${accentColor} 14%, transparent)`,
            color: accentColor,
          }}
        >
          Proximamente
        </span>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          Esta vista esta en construccion. Pronto podras encontrar aqui todas las funciones
          descritas abajo.
        </p>
        {bullets && bullets.length ? (
          <ul className="flex flex-col gap-2 text-sm text-foreground">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2">
                <span
                  aria-hidden
                  className="mt-1 size-1.5 shrink-0 rounded-full"
                  style={{ background: accentColor }}
                />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
