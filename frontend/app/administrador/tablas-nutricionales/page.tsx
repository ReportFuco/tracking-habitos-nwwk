import { PageHeader } from "@/components/shell/page-header"
import { ContextNav } from "@/components/shell/context-nav"
import { TablasAdminManager } from "@/modules/nutricion/components/tablas-admin-manager"

export default function TablasNutricionalesPage() {
  return (
    <div className="flex flex-col gap-6">
      <ContextNav
        crumbs={[
          { label: "Administracion", href: "/administrador" },
          { label: "Tablas nutricionales" },
        ]}
      />
      <PageHeader
        eyebrow="Nutricion maestra"
        title="Tablas nutricionales"
        description="Perfil de calorias y macros por porcion de cada producto."
      />
      <TablasAdminManager />
    </div>
  )
}
