import { ModuleHeader, type ModuleHeaderAction } from "@/components/shell/module-header"

const ANOTAR: ModuleHeaderAction = { href: "/app/nutricion/consumos?nuevo=1", label: "Anotar" }

interface NutricionHeaderProps {
  title: string
  description?: string
  /** Reemplaza "Anotar" (consumo); `null` lo oculta. */
  action?: ModuleHeaderAction | null
}

export function NutricionHeader({ title, description, action = ANOTAR }: NutricionHeaderProps) {
  return (
    <ModuleHeader
      back={{ href: "/app/nutricion", label: "Nutricion" }}
      title={title}
      description={description}
      action={action}
    />
  )
}
