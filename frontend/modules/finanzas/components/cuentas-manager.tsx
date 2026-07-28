"use client"

import { Building2, Landmark, Wallet } from "lucide-react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { CuentasSkeleton } from "@/modules/finanzas/components/skeletons/cuentas-skeleton"
import { useFinanzas } from "@/modules/finanzas/hooks/useFinanzas"

export function CuentasManager() {
  const { cuentas, loadingCatalogos } = useFinanzas()

  const productosAsociados = new Set(
    cuentas.map((cuenta) => cuenta.nombre_producto).filter(Boolean)
  ).size
  const bancosAsociados = new Set(cuentas.map((cuenta) => cuenta.nombre_banco).filter(Boolean)).size

  const formatDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat("es-CL", {
        dateStyle: "medium",
      }).format(new Date(value))
    } catch {
      return value
    }
  }

  const getCuentaTone = (nombreProducto: string | null | undefined) => {
    const normalized = (nombreProducto ?? "").toLocaleLowerCase("es")

    if (normalized.includes("corriente")) return "bg-[color:var(--module-finanzas)]"
    if (normalized.includes("ahorro")) return "bg-secondary"

    return "bg-[color:var(--primary-container)]"
  }

  if (loadingCatalogos && cuentas.length === 0) {
    return <CuentasSkeleton />
  }

  return (
    <section className="flex flex-col gap-4 sm:gap-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
        <article className="hidden rounded-[1.5rem] bg-[color:var(--surface-low)] p-4 sm:block sm:col-span-2 sm:p-6 lg:col-span-1">
          <p className="font-label text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
            Base financiera
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-2xl lg:text-3xl">
            Tus cuentas bancarias toman el protagonismo aqui.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-5 text-muted-foreground sm:leading-6">
            Esta vista se enfoca en revisar las cuentas disponibles dentro del modulo.
          </p>
        </article>

        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">
            <Wallet className="size-3.5 text-[color:var(--module-finanzas)] sm:size-4" />
            Total cuentas
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:mt-4 sm:text-3xl">
            {cuentas.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:mt-2 sm:text-sm">
            Disponibles para movimientos.
          </p>
        </article>

        <article className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-4 shadow-[var(--shadow-airy)] sm:p-5">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">
            <Building2 className="size-3.5 text-[color:var(--module-finanzas)] sm:size-4" />
            Bancos / productos
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:mt-4 sm:text-3xl">
            {bancosAsociados} / {productosAsociados}
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:mt-2 sm:text-sm">
            Bancos y productos distintos.
          </p>
        </article>
      </section>

      <section className="rounded-[1.75rem] bg-[color:var(--surface-low)] p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-label text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground">
              Registro actual
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Cuentas disponibles
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            En desktop se muestran como tabla. En pantallas pequenas, como cards editoriales.
          </p>
        </div>

        {cuentas.length === 0 ? (
          <div className="mt-6 rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-6 text-sm leading-6 text-muted-foreground shadow-[var(--shadow-airy)]">
            Aun no tienes cuentas bancarias registradas. Usa el flujo de <span className="font-medium text-foreground">Registrar cuenta bancaria</span> para crear la primera.
          </div>
        ) : (
          <>
            <div className="mt-6 hidden overflow-hidden rounded-[1.5rem] bg-[color:var(--surface-low)] shadow-[0_8px_48px_-12px_rgba(0,0,0,0.05)] lg:block">
              <Table>
                <TableHeader className="bg-[color:var(--primary)] text-[color:var(--primary-foreground)]">
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableHead className="px-8 py-5 font-label text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--primary-foreground)]">
                      Cuenta
                    </TableHead>
                    <TableHead className="px-6 py-5 font-label text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--primary-foreground)]">
                      Producto
                    </TableHead>
                    <TableHead className="px-6 py-5 font-label text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--primary-foreground)]">
                      Banco
                    </TableHead>
                    <TableHead className="px-6 py-5 font-label text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--primary-foreground)]">
                      Creacion
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:not(:last-child)]:border-b [&_tr:not(:last-child)]:border-[color:var(--border)]/30">
                  {cuentas.map((cuenta, index) => (
                    <TableRow
                      key={cuenta.id_cuenta}
                      className={cn(
                        "border-0 transition-colors hover:bg-primary/8",
                        index % 2 === 0
                          ? "bg-[color:var(--surface-lowest)]"
                          : "bg-[color:var(--surface-low)]"
                      )}
                    >
                      <TableCell className="px-8 py-6">
                        <div className="space-y-1">
                          <p className="text-base font-semibold text-[color:var(--primary)]">
                            {cuenta.nombre_cuenta}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            ID #{cuenta.id_cuenta}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-6">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", getCuentaTone(cuenta.nombre_producto))} />
                          <span>{cuenta.nombre_producto ?? "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-6">{cuenta.nombre_banco ?? "-"}</TableCell>
                      <TableCell className="px-6 py-6 text-sm text-muted-foreground">
                        {formatDate(cuenta.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <footer className="flex items-center justify-between border-t border-[color:var(--border)]/30 bg-[color:var(--surface-low)] px-8 py-4">
                <span className="font-label text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Mostrando {cuentas.length} cuenta{cuentas.length === 1 ? "" : "s"}
                </span>
                <Link
                  href="/app/finanzas/registrar-cuenta"
                  className="text-xs font-medium text-foreground transition hover:text-[color:var(--module-finanzas)]"
                >
                  Registrar otra cuenta
                </Link>
              </footer>
            </div>

            <div className="mt-6 grid gap-4 lg:hidden">
              {cuentas.map((cuenta) => (
                <article
                  key={cuenta.id_cuenta}
                  className="rounded-[1.5rem] bg-[color:var(--surface-lowest)] p-5 shadow-[var(--shadow-airy)]"
                >
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full bg-primary/12 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
                          {cuenta.nombre_producto ?? "Producto"}
                        </span>
                      </div>
                      <p className="text-lg font-semibold tracking-tight text-foreground">
                        {cuenta.nombre_cuenta}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.25rem] bg-[color:var(--surface-low)] p-4">
                        <p className="font-label text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
                          Banco
                        </p>
                        <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
                          <Landmark className="size-4 text-[color:var(--module-finanzas)]" />
                          {cuenta.nombre_banco ?? "-"}
                        </p>
                      </div>
                      <div className="rounded-[1.25rem] bg-[color:var(--surface-low)] p-4">
                        <p className="font-label text-[0.68rem] uppercase tracking-[0.2em] text-muted-foreground">
                          Creacion
                        </p>
                        <p className="mt-2 text-sm text-foreground">{formatDate(cuenta.created_at)}</p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </section>
  )
}
