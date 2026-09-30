import { PageHeader } from "@/components/shell/page-header"
import { DeudaDetailView } from "@/modules/finanzas/components/deuda-detail-view"
import { FinanzasMenuLinks } from "@/modules/finanzas/components/menu-links"

export default async function DeudaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader eyebrow="Finanzas" title="Deuda" className="pb-0" />
      <FinanzasMenuLinks />
      <DeudaDetailView idDeuda={Number(id)} />
    </div>
  )
}
