import {
  LayoutDashboard,
  Wallet,
  Dumbbell,
  Apple,
  UserCircle,
  Users,
  Building2,
  Tag,
  Package,
  ClipboardList,
  Gauge,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  moduleColor?: string
  /** Bloque de color de la marca y su texto (item activo en la navegacion). */
  moduleFill?: string
  moduleOn?: string
  /** Prefijos de ruta que tambien marcan el item como activo (por defecto, su href). */
  activePrefix?: string | string[]
  exactMatch?: boolean
}

export interface NavSection {
  title?: string
  items: NavItem[]
}

export const userNavSections: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
      {
        label: "Finanzas",
        href: "/app/finanzas",
        icon: Wallet,
        moduleColor: "var(--module-finanzas)",
        moduleFill: "var(--module-finanzas-fill)",
        moduleOn: "var(--module-finanzas-on)",
      },
      {
        label: "Entrenamientos",
        href: "/app/entrenamientos",
        icon: Dumbbell,
        moduleColor: "var(--module-entrenamientos)",
        moduleFill: "var(--module-entrenamientos-fill)",
        moduleOn: "var(--module-entrenamientos-on)",
      },
      {
        label: "Nutricion",
        href: "/app/nutricion",
        icon: Apple,
        moduleColor: "var(--module-nutricion)",
        moduleFill: "var(--module-nutricion-fill)",
        moduleOn: "var(--module-nutricion-on)",
      },
    ],
  },
  {
    title: "Cuenta",
    items: [{ label: "Perfil", href: "/app/perfil", icon: UserCircle }],
  },
]

export const adminNavSections: NavSection[] = [
  {
    items: [
      { label: "Resumen", href: "/administrador", icon: Gauge },
      { label: "Usuarios", href: "/administrador/usuarios", icon: Users },
    ],
  },
  {
    title: "Finanzas maestras",
    items: [
      { label: "Bancos", href: "/administrador/finanzas/bancos", icon: Building2 },
      { label: "Categorias", href: "/administrador/finanzas/categorias", icon: Tag },
    ],
  },
  {
    title: "Catalogo",
    items: [
      { label: "Marcas", href: "/administrador/marcas", icon: Tag },
      { label: "Productos", href: "/administrador/productos", icon: Package },
      {
        label: "Tablas nutricionales",
        href: "/administrador/tablas-nutricionales",
        icon: ClipboardList,
      },
    ],
  },
  {
    title: "Entrenamientos maestros",
    items: [
      { label: "Gimnasios", href: "/administrador/entrenamientos/gimnasios", icon: Dumbbell },
      { label: "Ejercicios", href: "/administrador/entrenamientos/ejercicios", icon: Dumbbell },
    ],
  },
]

export const adminBottomNavItems: NavItem[] = [
  { label: "Resumen", href: "/administrador", icon: Gauge, exactMatch: true },
  { label: "Usuarios", href: "/administrador/usuarios", icon: Users },
  { label: "Finanzas", href: "/administrador/finanzas/bancos", icon: Building2, activePrefix: "/administrador/finanzas" },
  {
    label: "Catalogo",
    href: "/administrador/marcas",
    icon: Package,
    activePrefix: ["/administrador/marcas", "/administrador/productos", "/administrador/tablas-nutricionales"],
  },
]
