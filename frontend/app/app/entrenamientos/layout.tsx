import { SeriesNoSincronizadas } from "@/modules/entrenamientos/components/series-no-sincronizadas"
import { EntrenamientosProvider } from "@/modules/entrenamientos/hooks/useEntrenamientos"

export default function EntrenamientosLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntrenamientosProvider>
      {/* En el layout y no en una pagina: una serie que no sincronizo tiene que verse
          aunque el entreno ya se haya cerrado. */}
      <div className="mb-4 empty:hidden sm:mb-6">
        <SeriesNoSincronizadas />
      </div>
      {children}
    </EntrenamientosProvider>
  )
}
