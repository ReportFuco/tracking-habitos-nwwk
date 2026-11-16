import { NutricionHeader } from "@/modules/nutricion/components/nutricion-header"
import { ConsumosManager } from "@/modules/nutricion/components/consumos-manager"

export default async function ConsumosPage({ searchParams }: { searchParams: Promise<{ nuevo?: string }> }) {
  const { nuevo } = await searchParams
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <NutricionHeader title="Comidas" description="Lo que comes cada dia y sus calorias." />
      <ConsumosManager key={nuevo ?? "lista"} abrirFormulario={nuevo === "1"} />
    </div>
  )
}
