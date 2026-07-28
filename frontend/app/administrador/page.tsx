import Link from "next/link"
import {
  ArrowRight,
  Building2,
  Dumbbell,
  MapPin,
  Package,
  Store,
  Tag,
  Users,
  ClipboardList,
  type LucideIcon,
} from "lucide-react"
import { PageHeader } from "@/components/shell/page-header"

interface AdminCard {
  title: string
  description: string
  href: string
  icon: LucideIcon
  accentColor?: string
  ready?: boolean
}

const cards: AdminCard[] = [
  {
    title: "Usuarios",
    description: "Listado de usuarios, estado y permisos.",
    href: "/administrador/usuarios",
    icon: Users,
    accentColor: "var(--module-admin)",
    ready: true,
  },
  {
    title: "Bancos",
    description: "Catalogo maestro de bancos.",
    href: "/administrador/finanzas/bancos",
    icon: Building2,
    accentColor: "var(--module-finanzas)",
    ready: true,
  },
  {
    title: "Categorias",
    description: "Catalogo maestro de categorias de movimientos.",
    href: "/administrador/finanzas/categorias",
    icon: Tag,
    accentColor: "var(--module-finanzas)",
    ready: true,
  },
  {
    title: "Gimnasios",
    description: "Catalogo de gimnasios usados en entrenamientos.",
    href: "/administrador/entrenamientos/gimnasios",
    icon: Dumbbell,
    accentColor: "var(--module-entrenamientos)",
    ready: true,
  },
  {
    title: "Cadenas",
    description: "Catalogo de cadenas de tiendas.",
    href: "/administrador/cadenas",
    icon: Store,
    accentColor: "var(--module-compras)",
    ready: true,
  },
  {
    title: "Locales",
    description: "Catalogo de locales asociados a cadenas.",
    href: "/administrador/locales",
    icon: MapPin,
    accentColor: "var(--module-compras)",
    ready: true,
  },
  {
    title: "Marcas",
    description: "Catalogo de marcas para productos.",
    href: "/administrador/marcas",
    icon: Tag,
    accentColor: "var(--module-compras)",
    ready: true,
  },
  {
    title: "Productos",
    description: "Catalogo maestro de productos.",
    href: "/administrador/productos",
    icon: Package,
    accentColor: "var(--module-compras)",
    ready: true,
  },
  {
    title: "Tablas nutricionales",
    description: "Perfil nutricional por producto.",
    href: "/administrador/tablas-nutricionales",
    icon: ClipboardList,
    accentColor: "var(--module-nutricion)",
    ready: true,
  },
  {
    title: "Ejercicios",
    description: "Catalogo de ejercicios para sesiones de fuerza.",
    href: "/administrador/entrenamientos/ejercicios",
    icon: Dumbbell,
    accentColor: "var(--module-entrenamientos)",
    ready: true,
  },
]

export default function AdministradorPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Panel"
        title="Administracion"
        description="Catalogos maestros y gestion de usuarios del sistema."
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          const accent = card.accentColor ?? "var(--primary)"
          return (
            <Link
              key={card.href}
              href={card.href}
              className="surface-card flex h-full flex-col justify-between gap-5 transition-transform hover:-translate-y-1"
            >
              <div className="flex flex-col gap-4">
                <span
                  className="flex size-11 items-center justify-center rounded-lg"
                  style={{
                    background: `color-mix(in oklch, ${accent} 14%, transparent)`,
                    color: accent,
                  }}
                >
                  <Icon className="size-5" />
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold tracking-tight">{card.title}</h3>
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-wider text-muted-foreground">
                {card.ready ? "Abrir" : "En construccion"}
                <ArrowRight className="size-3" />
              </span>
            </Link>
          )
        })}
      </section>
    </div>
  )
}
