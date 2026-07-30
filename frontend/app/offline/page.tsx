import Link from "next/link"
import { CloudOff, RefreshCw } from "lucide-react"

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-md rounded-[2rem] bg-[color:var(--surface-lowest)] p-8 text-center shadow-[var(--shadow-airy-lg)]">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CloudOff className="size-6" aria-hidden />
        </span>
        <p className="mt-6 font-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Sin conexion
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Tu espacio sigue aqui.
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Cuando recuperes internet, vuelve a intentar para sincronizar y consultar tus datos.
        </p>
        <Link
          href="/app/dashboard"
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          <RefreshCw className="size-4" aria-hidden />
          Reintentar
        </Link>
      </section>
    </main>
  )
}
