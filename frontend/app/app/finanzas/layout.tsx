import { FinanzasProvider } from "@/modules/finanzas/hooks/useFinanzas"

export default function FinanzasLayout({ children }: { children: React.ReactNode }) {
  return <FinanzasProvider>{children}</FinanzasProvider>
}
