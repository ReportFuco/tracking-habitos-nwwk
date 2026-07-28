import { EntrenamientosProvider } from "@/modules/entrenamientos/hooks/useEntrenamientos"

export default function EntrenamientosLayout({ children }: { children: React.ReactNode }) {
  return <EntrenamientosProvider>{children}</EntrenamientosProvider>
}
