"use client"

import { PageHeader } from "@/components/shell/page-header"
import { formatLongToday } from "@/lib/dates"
import { useProfile } from "@/modules/auth/hooks/useProfile"
import { DashboardHero } from "@/modules/dashboard/components/dashboard-hero"
import { ModuleBlocks } from "@/modules/dashboard/components/module-blocks"
import { QuickActions } from "@/modules/dashboard/components/quick-actions"

export default function DashboardPage() {
  const { data: profile } = useProfile()
  const nombre = profile?.nombre?.trim()

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader
        eyebrow={formatLongToday()}
        title={nombre ? `Hola, ${nombre}` : "Tu ritmo"}
        className="pb-2 sm:pb-4"
      />
      <DashboardHero />
      <ModuleBlocks />
      <QuickActions />
    </div>
  )
}
