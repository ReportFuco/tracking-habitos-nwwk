import Link from "next/link"
import {
  ArrowRight,
  Wallet,
  Dumbbell,
  Apple,
  ShoppingBag,
  Gauge,
  Sparkles,
} from "lucide-react"

const modules = [
  {
    title: "Finanzas",
    description: "Lleva tus cuentas, movimientos y gastos con claridad editorial.",
    icon: Wallet,
    color: "var(--module-finanzas)",
  },
  {
    title: "Entrenamientos",
    description: "Registra series y sesiones de fuerza como un diario de progreso.",
    icon: Dumbbell,
    color: "var(--module-entrenamientos)",
  },
  {
    title: "Nutricion",
    description: "Consumos, metas y peso en un unico espacio calmado.",
    icon: Apple,
    color: "var(--module-nutricion)",
  },
  {
    title: "Compras",
    description: "Cada compra con su detalle, tus locales y tus precios.",
    icon: ShoppingBag,
    color: "var(--module-compras)",
  },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-10 sm:py-6">
        <Link href="/" className="text-sm font-semibold tracking-tight sm:text-base">
          The Curated Life
        </Link>
        <nav className="flex items-center gap-2 text-sm sm:gap-4">
          <Link
            href="/login"
            className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
          >
            Iniciar sesion
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center rounded-lg bg-[color:var(--primary)] px-3 text-xs font-medium text-[color:var(--primary-foreground)] transition-colors hover:bg-[color:var(--primary)]/90 sm:px-4 sm:text-sm"
          >
            Crear cuenta
          </Link>
        </nav>
      </header>

      <section className="relative overflow-hidden px-4 pt-4 pb-10 sm:px-10 sm:pt-16 sm:pb-28">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 top-0 hidden h-[520px] w-[520px] rounded-full opacity-40 blur-3xl sm:block"
          style={{ background: "radial-gradient(circle, var(--module-nutricion), transparent 70%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 bottom-0 hidden h-[420px] w-[420px] rounded-full opacity-30 blur-3xl sm:block"
          style={{ background: "radial-gradient(circle, var(--module-entrenamientos), transparent 70%)" }}
        />

        <div className="relative mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          <div className="flex flex-col gap-5 sm:gap-8">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[color:var(--surface-lowest)] px-3 py-1.5 font-[family-name:var(--font-label)] text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground shadow-[var(--shadow-airy)] sm:px-4 sm:text-[0.7rem]">
              <Sparkles className="size-3" aria-hidden />
              Mindful editorial
            </span>

            <h1 className="text-balance text-3xl font-semibold leading-[1.1] tracking-tight sm:text-6xl sm:leading-[1.05] lg:text-7xl">
              Tu vida,{" "}
              <span className="italic text-[color:var(--secondary)]">organizada</span>
              <br />
              con calma.
            </h1>

            <p className="max-w-xl text-sm text-muted-foreground sm:text-lg">
              Un espacio personal para seguir finanzas, entrenamientos, compras y nutricion.
              Sobrio, calido y sin ruido. Pensado como un diario premium, no como una hoja de
              calculo.
            </p>

            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:pt-2">
              <Link
                href="/register"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] px-6 text-sm font-medium text-[color:var(--primary-foreground)] shadow-[var(--shadow-airy)] transition-all hover:shadow-[var(--shadow-airy-lg)] sm:h-11"
              >
                Empezar a registrar
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-[color:var(--surface-lowest)] px-6 text-sm font-medium text-foreground shadow-[var(--shadow-airy)] transition-colors hover:bg-[color:var(--accent)] sm:h-11"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>

          <div className="relative hidden flex-col gap-5 lg:flex lg:pt-6">
            <div className="surface-card flex items-start gap-4">
              <span className="flex size-11 items-center justify-center rounded-lg bg-[color:var(--module-finanzas)]/10 text-[color:var(--module-finanzas)]">
                <Gauge className="size-5" />
              </span>
              <div className="flex-1">
                <p className="font-[family-name:var(--font-label)] text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                  Resumen del mes
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">$ 1.284.900</p>
                <p className="text-sm text-muted-foreground">
                  Ingresos netos despues de gastos fijos.
                </p>
              </div>
            </div>

            <div
              className="surface-card ml-8 flex items-start gap-4"
              style={{ background: "var(--tertiary-container)" }}
            >
              <span className="flex size-11 items-center justify-center rounded-lg bg-[color:var(--tertiary)]/15 text-[color:var(--tertiary)]">
                <Dumbbell className="size-5" />
              </span>
              <div className="flex-1">
                <p className="font-[family-name:var(--font-label)] text-[0.7rem] uppercase tracking-wider text-[color:var(--tertiary)]">
                  Sesion activa
                </p>
                <p className="mt-1 text-lg font-semibold">Pecho y triceps</p>
                <p className="text-sm text-[color:var(--tertiary)]/80">
                  6 series registradas, Smart Fit Oeste.
                </p>
              </div>
            </div>

            <div className="surface-card flex items-start gap-4">
              <span className="flex size-11 items-center justify-center rounded-lg bg-[color:var(--module-nutricion)]/10 text-[color:var(--module-nutricion)]">
                <Apple className="size-5" />
              </span>
              <div className="flex-1">
                <p className="font-[family-name:var(--font-label)] text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                  Meta nutricional
                </p>
                <p className="mt-1 text-lg font-semibold">2.200 kcal / dia</p>
                <p className="text-sm text-muted-foreground">Proteina objetivo 160 g.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-14 sm:px-10 sm:pb-24">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-6 flex flex-col gap-2 sm:mb-10">
            <span className="font-[family-name:var(--font-label)] text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground sm:text-[0.7rem]">
              Modulos
            </span>
            <h2 className="max-w-2xl text-xl font-semibold tracking-tight sm:text-4xl">
              Cada area de tu vida, con un color propio dentro de la misma familia.
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            {modules.map((item) => {
              const Icon = item.icon
              return (
                <article
                  key={item.title}
                  className="surface-card flex h-full flex-col gap-4 transition-transform hover:-translate-y-1"
                >
                  <span
                    className="flex size-11 items-center justify-center rounded-lg"
                    style={{ background: `color-mix(in oklch, ${item.color} 14%, transparent)`, color: item.color }}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold tracking-tight">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <footer className="border-t-0 bg-[color:var(--surface-low)] px-4 py-6 sm:px-10 sm:py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
          <p>The Curated Life. Un diario digital para tu vida diaria.</p>
          <div className="flex items-center gap-5">
            <Link href="/administrador" className="hover:text-foreground">
              Panel admin
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Iniciar sesion
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
