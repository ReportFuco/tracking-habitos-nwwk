import {
  LayoutDashboard,
  Wallet,
  Dumbbell,
  ShoppingBag,
  Apple,
  UserCircle,
  Users,
  Building2,
  Tag,
  Package,
  Store,
  MapPin,
  ClipboardList,
  Gauge,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  moduleColor?: string
  activePrefix?: string
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
      },
      {
        label: "Entrenamientos",
        href: "/app/entrenamientos",
        icon: Dumbbell,
        moduleColor: "var(--module-entrenamientos)",
      },
      {
        label: "Compras",
        href: "/app/compras",
        icon: ShoppingBag,
        moduleColor: "var(--module-compras)",
      },
      {
        label: "Nutricion",
        href: "/app/nutricion",
        icon: Apple,
        moduleColor: "var(--module-nutricion)",
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
    title: "Compras maestras",
    items: [
      { label: "Cadenas", href: "/administrador/cadenas", icon: Store },
      { label: "Locales", href: "/administrador/locales", icon: MapPin },
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
  { label: "Catalogo", href: "/administrador/marcas", icon: Package, activePrefix: "/administrador/marcas" },
  { label: "Compras", href: "/administrador/cadenas", icon: Store, activePrefix: "/administrador/cadenas" },
]
