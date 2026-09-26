import Link from "next/link"
import { RefreshCw } from "lucide-react"
import { BrandMark } from "@/components/brand/brand-mark"

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 text-foreground">
      <section className="flex w-full max-w-md flex-col items-start gap-5">
        <BrandMark size="sm" />
        <span className="rounded-sm bg-highlight px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-highlight-foreground">
          Sin conexion
        </span>
        <h1 className="font-display text-4xl leading-[1.02]">Sin senal, pero no perdiste nada.</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Los gastos y las series que anotes sin internet quedan guardados en el telefono y se
          envian solos cuando vuelva la conexion.
        </p>
        <Link
          href="/app/dashboard"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          <RefreshCw className="size-4" aria-hidden />
          Reintentar
        </Link>
      </section>
    </main>
  )
}
