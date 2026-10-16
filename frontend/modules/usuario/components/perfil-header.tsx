import { ModuleHeader } from "@/components/shell/module-header"

/** Encabezado de una subpagina de Perfil: volver a la portada y titulo, sin accion. */
export function PerfilHeader({ title, description }: { title: string; description?: string }) {
  return (
    <ModuleHeader back={{ href: "/app/perfil", label: "Perfil" }} title={title} description={description} action={null} />
  )
}
