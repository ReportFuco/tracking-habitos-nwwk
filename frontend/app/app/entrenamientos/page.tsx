import { Dumbbell } from "lucide-react"
import { ContextNav } from "@/components/shell/context-nav"
import { PageHeader } from "@/components/shell/page-header"
import { EntrenamientosHomeOverview } from "@/modules/entrenamientos/components/entrenamientos-home-overview"

export default function EntrenamientosHomePage() {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <ContextNav
        crumbs={[
          { label: "Inicio", href: "/app/dashboard" },
          { label: "Entrenamientos" },
        ]}
      />

      <PageHeader
        eyebrow="Modulo"
        title="Entrenamientos"
        description="Tres frentes simples: registrar tu sesion, revisar tus gimnasios y consultar tu historico."
      />

      <EntrenamientosHomeOverview />

      <aside className="flex items-start gap-3 rounded-[1.25rem] bg-[color:var(--surface-low)] p-4 sm:items-center sm:gap-4 sm:rounded-[1.5rem] sm:p-5">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-[0.9rem] sm:size-11"
          style={{
            background: "color-mix(in oklch, var(--module-entrenamientos) 14%, transparent)",
            color: "var(--module-entrenamientos)",
          }}
        >
          <Dumbbell className="size-4 sm:size-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-label text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-[0.7rem] sm:tracking-wider">
            Nota
          </p>
          <p className="text-sm leading-6 text-foreground">
            Solo puedes tener una sesion activa a la vez. El flujo principal es abrirla y desde ahi administrar las series.
          </p>
        </div>
      </aside>
    </div>
  )
}
