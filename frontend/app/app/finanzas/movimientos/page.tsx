import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { MovimientosManager } from "@/modules/finanzas/components/movimientos-manager"
import { FinanzasMenuLinks } from "@/modules/finanzas/components/menu-links"
import { PageHeader } from "@/components/shell/page-header"

export default function MovimientosPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Finanzas"
        title="Movimientos"
        description="Vista dedicada a revisar y editar tus movimientos. El alta queda separada en su propio flujo."
        actions={
          <Link
            href="/app/finanzas/registrar-movimiento"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Registrar movimientos
            <ArrowRight className="size-4" />
          </Link>
        }
      />
      <FinanzasMenuLinks />

      <MovimientosManager />
    </div>
  )
}
