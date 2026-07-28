import { ComprasProvider } from "@/modules/compras/hooks/useCompras"

export default function ComprasLayout({ children }: { children: React.ReactNode }) {
  return <ComprasProvider>{children}</ComprasProvider>
}
