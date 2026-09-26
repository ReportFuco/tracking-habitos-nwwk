import Link from "next/link"
import { ArrowRight, Apple, Dumbbell, ShoppingBag, Wallet } from "lucide-react"
import { BrandMark } from "@/components/brand/brand-mark"
import { BRAND } from "@/lib/brand"

const modules = [
  {
    key: "finanzas",
    title: "Finanzas",
    description: "Cuentas, gastos e ingresos. Sabes cuanto te queda antes de fin de mes.",
    icon: Wallet,
    sample: "$605.000",
    sampleLabel: "balance del mes",
  },
  {
    key: "entrenamientos",
    title: "Fuerza",
    description: "Cada serie con su carga y repeticiones, incluso sin senal en el gimnasio.",
    icon: Dumbbell,
    sample: "3 sesiones",
    sampleLabel: "esta semana",
  },
  {
    key: "nutricion",
    title: "Nutricion",
    description: "Comidas, metas y peso para ver la tendencia, no solo el dia.",
    icon: Apple,
    sample: "78,4 kg",
    sampleLabel: "ultimo registro",
  },
  {
    key: "compras",
    title: "Compras",
    description: "Tickets por local y cadena, con el total que se va al supermercado.",
    icon: ShoppingBag,
    sample: "$86.990",
    sampleLabel: "compras del mes",
  },
] as const

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-10 sm:py-6">
        <Link href="/" aria-label={`${BRAND.name}, inicio`}>
          <BrandMark size="sm" />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold text-foreground transition-colors hover:bg-[color:var(--surface-low)]"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:px-4"
          >
            Crear cuenta
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pt-6 pb-12 sm:px-10 sm:pt-14 sm:pb-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-14">
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-sm bg-highlight px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-[0.16em] text-highlight-foreground">
            Tracker personal
          </span>
          <h1 className="font-display text-[2.6rem] leading-[0.95] text-balance sm:text-7xl lg:text-8xl">
            {BRAND.tagline}
          </h1>
          <p className="max-w-lg text-base text-muted-foreground sm:text-lg">
            Finanzas, fuerza, nutricion y compras en una sola app. Registras en segundos desde el
            telefono y ves como va tu mes de un vistazo.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Empezar a registrar
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-md border border-foreground px-6 text-sm font-semibold text-foreground transition-colors hover:bg-foreground hover:text-background"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </div>

        {/* Cartel: los cuatro bloques de color. Cifras de ejemplo, no datos reales. */}
        <div className="grid grid-cols-2 gap-2" aria-label="Ejemplo de lo que ves en tu inicio">
          {modules.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.key}
                className="flex aspect-square flex-col justify-between rounded-2xl p-4 sm:p-5"
                style={{ background: `var(--module-${item.key}-fill)`, color: `var(--module-${item.key}-on)` }}
              >
                <span className="inline-flex size-9 items-center justify-center rounded-md bg-black/15">
                  <Icon className="size-[1.1rem]" aria-hidden />
                </span>
                <div>
                  <p className="font-display text-xl leading-none sm:text-2xl">{item.sample}</p>
                  <p className="mt-1 text-xs opacity-85">{item.sampleLabel}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="bg-[color:var(--sidebar)] px-4 py-14 text-[color:var(--sidebar-foreground)] sm:px-10 sm:py-20">
        <div className="mx-auto w-full max-w-6xl">
          <h2 className="max-w-2xl font-display text-3xl leading-[1.02] text-balance sm:text-5xl">
            Cuatro areas. Un color cada una.
          </h2>
          <div className="mt-10 grid gap-px bg-[color:var(--sidebar-border)] sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((item) => (
              <article key={item.key} className="flex flex-col gap-3 bg-[color:var(--sidebar)] py-6 pr-6 sm:p-6">
                <span className="h-2 w-10" style={{ background: `var(--module-${item.key}-fill)` }} aria-hidden />
                <h3 className="font-display text-xl">{item.title}</h3>
                <p className="text-sm leading-6 text-[color:var(--sidebar-muted)]">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:px-10">
        <BrandMark size="sm" />
        <Link href="/login" className="font-semibold hover:text-foreground">
          Iniciar sesion
        </Link>
      </footer>
    </main>
  )
}
