import { PageHeader } from "@/components/shell/page-header"
import { ContextNav } from "@/components/shell/context-nav"
import { ComprasManager } from "@/modules/compras/components/compras-manager"

export default function ComprasPage() {
  return (
    <div className="flex flex-col gap-5">
      <ContextNav
        crumbs={[
          { label: "Inicio", href: "/app/dashboard" },
          { label: "Compras" },
        ]}
      />
      <PageHeader
        eyebrow="Modulo"
        title="Compras"
        description="Registra compras por local y consulta tu historial."
      />

      <ComprasManager />
    </div>
  )
}
