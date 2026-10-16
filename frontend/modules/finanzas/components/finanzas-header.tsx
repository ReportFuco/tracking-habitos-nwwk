import { ModuleHeader, type ModuleHeaderAction } from "@/components/shell/module-header"

const NUEVO: ModuleHeaderAction = { href: "/app/finanzas/registrar-movimiento", label: "Nuevo" }

interface FinanzasHeaderProps {
  title: string
  description?: string
  /** A donde vuelve la flecha; por defecto, la portada de finanzas. */
  back?: { href: string; label: string }
  /** Reemplaza "Nuevo" (movimiento); `null` lo oculta, por ejemplo ya estando en el formulario. */
  action?: ModuleHeaderAction | null
}

export function FinanzasHeader({
  title,
  description,
  back = { href: "/app/finanzas", label: "Finanzas" },
  action = NUEVO,
}: FinanzasHeaderProps) {
  return <ModuleHeader back={back} title={title} description={description} action={action} />
}
