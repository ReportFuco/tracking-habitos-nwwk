import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { CuentasManager } from "@/modules/finanzas/components/cuentas-manager"
import { FinanzasMenuLinks } from "@/modules/finanzas/components/menu-links"
import { PageHeader } from "@/components/shell/page-header"

export default function CuentasPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader
        eyebrow="Finanzas"
        title="Cuentas"
        className="pb-0"
        actions={
          <Link
            href="/app/finanzas/registrar-cuenta"
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Nueva cuenta
            <ArrowRight className="size-4" />
          </Link>
        }
      />
      <FinanzasMenuLinks />

      <CuentasManager />
    </div>
  )
}
