import { NutricionProvider } from "@/modules/nutricion/hooks/useNutricion"

export default function NutricionLayout({ children }: { children: React.ReactNode }) {
  return <NutricionProvider>{children}</NutricionProvider>
}
