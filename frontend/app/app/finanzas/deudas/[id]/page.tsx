import { DeudaDetailView } from "@/modules/finanzas/components/deuda-detail-view"
import { FinanzasHeader } from "@/modules/finanzas/components/finanzas-header"

export default async function DeudaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <FinanzasHeader title="Deuda" back={{ href: "/app/finanzas/deudas", label: "Deudas" }} />
      <DeudaDetailView idDeuda={Number(id)} />
    </div>
  )
}
