import { GimnasiosManager } from "@/modules/entrenamientos/components/gimnasios-manager"
import { EntrenamientosProvider } from "@/modules/entrenamientos/hooks/useEntrenamientos"
import { PageHeader } from "@/components/shell/page-header"
import { ContextNav } from "@/components/shell/context-nav"

export default function GimnasiosEntrenamientosPage() {
  return (
    <div className="flex flex-col gap-6">
      <ContextNav
        crumbs={[
          { label: "Administracion", href: "/administrador" },
          { label: "Gimnasios" },
        ]}
      />
      <PageHeader
        eyebrow="Entrenamientos maestros"
        title="Gimnasios"
        description="Crea, busca y administra los gimnasios asociados a los entrenamientos."
      />

      <EntrenamientosProvider>
        <GimnasiosManager />
      </EntrenamientosProvider>
    </div>
  )
}
