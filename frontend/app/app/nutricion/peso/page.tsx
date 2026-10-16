import { NutricionHeader } from "@/modules/nutricion/components/nutricion-header"
import { PesoManager } from "@/modules/nutricion/components/peso-manager"

export default async function PesoPage({ searchParams }: { searchParams: Promise<{ nuevo?: string }> }) {
  const { nuevo } = await searchParams
  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <NutricionHeader title="Peso corporal" description="Registra tu peso con fecha y revisa la tendencia a lo largo del tiempo." action={{ href: "/app/nutricion/peso?nuevo=1", label: "Anotar" }} />
      <PesoManager key={nuevo ?? "lista"} abrirFormulario={nuevo === "1"} />
    </div>
  )
}
