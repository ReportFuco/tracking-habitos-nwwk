import { NutricionHeader } from "@/modules/nutricion/components/nutricion-header"
import { MetasManager } from "@/modules/nutricion/components/metas-manager"

export default function MetasPage() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <NutricionHeader title="Metas nutricionales" description="Define metas por periodo con kcal y distribucion de macros." />
      <MetasManager />
    </div>
  )
}
