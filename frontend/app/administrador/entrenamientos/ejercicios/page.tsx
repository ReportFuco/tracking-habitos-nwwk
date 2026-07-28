import { PageHeader } from "@/components/shell/page-header"
import { ContextNav } from "@/components/shell/context-nav"
import { EjerciciosManager } from "@/modules/entrenamientos/components/ejercicios-manager"

export default function EjerciciosPage() {
  return (
    <div className="flex flex-col gap-6">
      <ContextNav
        crumbs={[
          { label: "Administracion", href: "/administrador" },
          { label: "Ejercicios" },
        ]}
      />
      <PageHeader
        eyebrow="Entrenamientos maestros"
        title="Ejercicios"
        description="Catalogo de ejercicios disponibles para registrar en sesiones."
      />
      <EjerciciosManager />
    </div>
  )
}
