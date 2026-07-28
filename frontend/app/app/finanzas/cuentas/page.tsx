import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { CuentasManager } from "@/modules/finanzas/components/cuentas-manager"
import { FinanzasMenuLinks } from "@/modules/finanzas/components/menu-links"
import { PageHeader } from "@/components/shell/page-header"

export default function CuentasPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Finanzas"
        title="Cuentas bancarias"
        description="Vista dedicada a revisar tus cuentas bancarias. El registro queda separado en su propio flujo."
        actions={
          <Link
            href="/app/finanzas/registrar-cuenta"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Registrar cuenta bancaria
            <ArrowRight className="size-4" />
          </Link>
        }
      />
      <FinanzasMenuLinks />

      <CuentasManager />
    </div>
  )
}
