import { BancosManager } from "@/modules/finanzas/components/bancos-manager"
import { FinanzasProvider } from "@/modules/finanzas/hooks/useFinanzas"
import { PageHeader } from "@/components/shell/page-header"
import { ContextNav } from "@/components/shell/context-nav"

export default function BancosPage() {
  return (
    <div className="flex flex-col gap-6">
      <ContextNav
        crumbs={[
          { label: "Administracion", href: "/administrador" },
          { label: "Bancos" },
        ]}
      />
      <PageHeader
        eyebrow="Finanzas maestras"
        title="Bancos"
        description="Crea, edita y elimina los bancos del catalogo maestro."
      />

      <FinanzasProvider>
        <BancosManager />
      </FinanzasProvider>
    </div>
  )
}
