import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { EntrenamientoActivoCard } from "@/modules/entrenamientos/components/entrenamiento-activo-card"

export default function EntrenoActivoPage() {
  return (
    <div className="flex flex-col gap-4 pb-4 sm:gap-6 sm:pb-0">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-label text-[0.68rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Modo entrenamiento
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-2xl">
            Entrenamiento activo
          </h1>
        </div>

        <Link
          href="/app/entrenamientos"
          className="inline-flex min-h-11 shrink-0 touch-manipulation items-center gap-2 rounded-full bg-surface-low px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-variant focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" aria-hidden />
          <span className="hidden min-[390px]:inline">Resumen</span>
          <span className="sr-only min-[390px]:hidden">Volver al resumen</span>
        </Link>
      </header>

      <EntrenamientoActivoCard />
    </div>
  )
}
