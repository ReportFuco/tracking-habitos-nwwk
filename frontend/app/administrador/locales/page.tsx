import { PageHeader } from "@/components/shell/page-header"
import { ContextNav } from "@/components/shell/context-nav"
import { LocalesManager } from "@/modules/compras/components/locales-manager"

export default function LocalesPage() {
  return (
    <div className="flex flex-col gap-6">
      <ContextNav
        crumbs={[
          { label: "Administracion", href: "/administrador" },
          { label: "Locales" },
        ]}
      />
      <PageHeader
        eyebrow="Compras maestras"
        title="Locales"
        description="Catalogo de locales y comercios asociados a cadenas o independientes."
      />
      <LocalesManager />
    </div>
  )
}
