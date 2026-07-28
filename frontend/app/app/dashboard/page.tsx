import Link from "next/link"
import { ArrowRight, Dumbbell, ReceiptText, Salad } from "lucide-react"
import { PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { FinanzasKpiOverview } from "@/modules/finanzas/components/finanzas-kpi-overview"

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader
        eyebrow="Inicio"
        title="Dashboard"
        description="Tu resumen diario consolidado empieza aqui. Abrimos con finanzas y dejamos lista la base para sumar el resto de la app."
        actions={
          <Button
            asChild
            className="bg-[color:var(--module-finanzas)] text-[color:var(--primary-foreground)] hover:bg-[color:var(--module-finanzas)]/90"
          >
            <Link href="/app/finanzas">
              Ir a finanzas
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />

      <FinanzasKpiOverview />

      <section className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Dumbbell className="size-4 text-[color:var(--module-entrenamientos)]" />
            Entrenamientos
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Luego sumamos estado de sesion activa, ultimas series y actividad reciente.
          </p>
        </article>

        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ReceiptText className="size-4 text-[color:var(--module-compras)]" />
            Compras
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Tambien queda espacio para compras recientes, total mensual y locales frecuentes.
          </p>
        </article>

        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Salad className="size-4 text-[color:var(--module-nutricion)]" />
            Nutricion
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Mas adelante podemos integrar metas del dia, peso reciente y consumos en curso.
          </p>
        </article>
      </section>
    </div>
  )
}
