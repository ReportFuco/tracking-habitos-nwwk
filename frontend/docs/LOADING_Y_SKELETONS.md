# Plan de Loading States y Skeletons — "Digital Atelier"

Fecha: 2026-04-25
Estado: Propuesta — pendiente de implementación

## 1. Objetivo

Hoy la app tiene dos puntos de fricción percibida en navegación:

1. **Auth**: el [auth-guard.tsx](../components/auth/auth-guard.tsx) muestra un texto plano "Validando sesion..." centrado, sin marca ni continuidad visual con el shell de la app.
2. **Rutas protegidas**: cada `page.tsx` dentro de `app/app/**` resuelve sus datos en cliente (axios + hooks). Mientras la promesa está en vuelo, la pantalla queda vacía o salta del shell al contenido sin transición. Solo [finanzas-kpi-overview.tsx:104-130](../modules/finanzas/components/finanzas-kpi-overview.tsx#L104-L130) tiene un skeleton propio y vive aislado.

Este plan define cómo unificar esos estados bajo el lenguaje "Digital Atelier" — papel cálido, tonos modulares, esquinas suaves, shadows airy, sin bordes — y cómo distribuirlos por segmento del App Router.

## 2. Principios de diseño

Antes de cualquier código, fijar estas reglas:

- **El loader nunca rompe el shell**. Si el usuario está dentro de `/app/**`, sigue viendo `app-shell` con sidebar/topbar/bottom nav. El skeleton vive en el slot de contenido.
- **El skeleton imita la silueta real**, no es un spinner. Bloques con la misma altura, padding y radio que el contenido final ([Cards: `rounded-[1.5rem]`, `bg-[color:var(--surface-lowest)]`, `shadow-[var(--shadow-airy)]`]).
- **Tonos del propio sistema**: usar `--surface-variant`, `--surface-low` y `--surface-lowest` ya definidos en [globals.css](../app/globals.css). Nunca grises neutros tipo `bg-gray-200` — rompen la calidez del paper.
- **Animación discreta**: `animate-pulse` de Tailwind con duración prolongada (`[animation-duration:1.6s]`) — evitar shimmers agresivos. El "Digital Atelier" pide quietud.
- **Tono modular**: el skeleton de una vista de finanzas insinúa `--module-finanzas` en el header (chip o eyebrow), igual que la vista real. Igual con entrenamientos (tertiary), nutrición (secondary), compras (tertiary-fixed).
- **Tipografía respeta jerarquía**: no skeletizar todo. Eyebrows, títulos cortos y descripciones pueden quedar como texto real ("Cargando finanzas...") cuando aporten contexto editorial.
- **Mobile-first**: respetar la regla del proyecto — bloques `text-xl` no `text-3xl`, `p-4 sm:p-5`, ocultar heros decorativos en mobile.

## 3. Inventario de estados de carga

Tres familias distintas, cada una con su patrón:

### 3.1 Loaders de pantalla completa (auth y boot)

Ocupan toda la viewport antes de que exista shell. Son momentos cortos pero "sagrados": primera impresión.

| Caso | Cuándo aparece | Patrón propuesto |
|---|---|---|
| Boot inicial (`app/page.tsx` → redirect) | Antes de decidir login vs dashboard | `FullScreenLoader` con logo "Atelier" + barra suave |
| Auth guard validando token | `auth-guard.tsx` mientras hace `getProfile()` | `FullScreenLoader` variante "session" — muestra avatar/skeleton mínimo |
| Login submitting | Botón "Entrar al panel" + redirect | Mantener loader inline en botón + overlay sutil de transición |
| Logout | Cierre de sesión | Fade rápido + `FullScreenLoader` brick |

### 3.2 Loaders de segmento (rutas protegidas)

Aprovechan `loading.tsx` del App Router. Aparecen en el slot `<main>` del [app-shell.tsx](../components/shell/app-shell.tsx) mientras Next resuelve el segmento. **No re-renderean el shell** — es la gran ventaja.

Hoy el proyecto **no tiene ningún `loading.tsx`** (verificado con glob). Cada ruta lo necesita.

### 3.3 Skeletons in-component

Estados de carga locales dentro de un componente client que hace fetch propio (ejemplo actual: `FinanzasKpiOverview`). Estos no se eliminan — siguen vivos para datos asíncronos posteriores a la primera pintura. Pero deben **homogeneizarse** con un set de primitivos compartidos.

## 4. Primitivos a construir

Crear `components/ui/skeleton.tsx` y `components/feedback/loaders/` con piezas reutilizables.

### 4.1 `Skeleton` (átomo)

Bloque base parametrizable. Reemplaza los `bg-[color:var(--surface-variant)]` sueltos.

```tsx
<Skeleton className="h-4 w-28 rounded-full" />
<Skeleton className="h-10 w-3/4 rounded-[1rem]" tone="lowest" />
```

Variantes: `tone="variant" | "low" | "lowest"`, animación `animate-pulse [animation-duration:1.6s]`.

### 4.2 `SkeletonCard` (molécula)

Card con padding y radio del sistema, lista para inyectar líneas. Usa exactamente las mismas clases que las cards reales para que el "salto" al contenido sea invisible.

### 4.3 `PageHeaderSkeleton`

Refleja el [page-header](../components/shell/page-header.tsx): eyebrow, título, descripción, slot de acciones. Acepta `module` para teñir el eyebrow chip con la variable correspondiente.

### 4.4 `ContextNavSkeleton`

Mini-skeleton de breadcrumbs para que no salten cuando el segmento se hidrata.

### 4.5 `FullScreenLoader`

Pantalla completa con:
- Fondo `bg-background` + radial wash igual al `auth-shell`.
- Logo o monograma "Atelier" centrado con fade in/out lento.
- Barra "monolith" delgada (1rem rounded, color `--module-*` según contexto) o anillo respiratorio — elegir UNA y usarla siempre.
- Texto opcional editorial ("Cargando tu espacio...", "Validando acceso...").

Variantes por accent: `olive`, `brick`, `secondary`. Reutilizables en login submit, logout y boot.

### 4.6 Skeletons específicos por módulo

Componer con los átomos. Cada uno vive con su módulo, no global:

- `modules/finanzas/components/skeletons/movimientos-skeleton.tsx`
- `modules/finanzas/components/skeletons/cuentas-skeleton.tsx`
- `modules/finanzas/components/skeletons/kpi-overview-skeleton.tsx` (extraer del actual inline)
- `modules/entrenamientos/components/skeletons/...`
- `modules/nutricion/components/skeletons/...`
- `modules/compras/components/skeletons/...`

## 5. Mapa de `loading.tsx` por segmento

Next.js renderiza el `loading.tsx` más cercano. Estrategia:

```
app/
├── loading.tsx                              # boot — FullScreenLoader olive
├── login/
│   └── loading.tsx                          # AuthShell skeleton (form blocks)
├── register/
│   └── loading.tsx                          # AuthShell skeleton
└── app/
    ├── loading.tsx                          # genérico para /app/* — PageHeader + grid skeleton
    ├── dashboard/
    │   └── loading.tsx                      # KPI skeleton + 3 tiles
    ├── finanzas/
    │   ├── loading.tsx                      # tiles del módulo (matcheable a finanzas/page.tsx)
    │   ├── movimientos/
    │   │   ├── loading.tsx                  # tabla/lista de movimientos
    │   │   └── [id]/loading.tsx             # detalle movimiento
    │   ├── cuentas/loading.tsx
    │   ├── registrar-movimiento/loading.tsx # form skeleton
    │   ├── registrar-cuenta/loading.tsx
    │   └── historico/loading.tsx
    ├── entrenamientos/
    │   ├── loading.tsx
    │   ├── activo/loading.tsx               # sesión activa — placeholder de timer
    │   ├── iniciar-fuerza/loading.tsx
    │   ├── registrar/loading.tsx
    │   ├── historico/loading.tsx
    │   └── gimnasios/loading.tsx
    ├── nutricion/
    │   ├── loading.tsx
    │   ├── peso/loading.tsx
    │   ├── consumos/loading.tsx
    │   ├── metas/loading.tsx
    │   └── tabla/loading.tsx
    ├── compras/loading.tsx
    └── perfil/loading.tsx
```

El segmento `app/administrador/**` está deprecado por [next.config.ts](../next.config.ts) (redirige a `/app/**`) — **no agregar loadings ahí**.

## 6. Roadmap por fases

### Fase 0 — Base (1 sesión)
- [ ] `components/ui/skeleton.tsx` (átomo + tono)
- [ ] `components/feedback/loaders/full-screen-loader.tsx` (3 variantes accent)
- [ ] `components/feedback/loaders/page-header-skeleton.tsx`
- [ ] `components/feedback/loaders/context-nav-skeleton.tsx`
- [ ] Documentar uso en este mismo archivo (ejemplos copy-paste)

### Fase 1 — Auth y boot (1 sesión)
- [ ] `app/loading.tsx` raíz (boot)
- [ ] Reemplazar el `<p>Validando sesion...</p>` de [auth-guard.tsx:46-49](../components/auth/auth-guard.tsx#L46-L49) por `FullScreenLoader` variante session
- [ ] `app/login/loading.tsx` con esqueleto del `AuthShell`
- [ ] `app/register/loading.tsx` análogo
- [ ] Overlay de transición durante login submit (post-`router.push`)

### Fase 2 — Genérico /app y dashboard (1 sesión)
- [ ] `app/app/loading.tsx` — fallback con `PageHeaderSkeleton` + grid tiles neutros
- [ ] `app/app/dashboard/loading.tsx` — extraer skeleton de `FinanzasKpiOverview` y reutilizarlo aquí
- [ ] Refactor `FinanzasKpiOverview` para consumir el skeleton extraído (no duplicar)

### Fase 3 — Finanzas completo (1-2 sesiones)
- [ ] `loading.tsx` de cada subruta listada en sección 5
- [ ] Skeletons específicos: tabla de movimientos, lista de cuentas, formularios
- [ ] Reemplazar estados de loading inline en `MovimientosManager` por los nuevos primitivos

### Fase 4 — Entrenamientos (1-2 sesiones)
- [ ] Mismo patrón. Especial atención a `/app/entrenamientos/activo` que tiene estado vivo (timer).

### Fase 5 — Nutrición y compras (1 sesión)
- [ ] Loadings de las 5 rutas de nutrición y la única de compras.

### Fase 6 — Perfil + pulido (medio día)
- [ ] `app/app/perfil/loading.tsx`
- [ ] Audit visual end-to-end: navegar entre rutas con throttling 3G, verificar que ningún flash blanco aparezca.
- [ ] Confirmar que `app-shell` nunca re-renderiza durante navegación intra-app.

## 7. Decisiones técnicas a confirmar

Antes de empezar Fase 0, alinear con Francisco:

1. **Animación**: ¿`animate-pulse` simple o agregar un shimmer custom con gradient? Recomendación: pulse simple, fiel al espíritu "quieto" del Digital Atelier.
2. **Logo del FullScreenLoader**: hoy el shell solo dice "Atelier" en texto ([app-shell.tsx:50](../components/shell/app-shell.tsx#L50)). ¿Usamos solo el wordmark, o creamos un monograma?
3. **Suspense boundaries adicionales**: `loading.tsx` cubre el segmento. Para fetches in-component que hoy usan `useEffect`, ¿migramos a Server Components + Suspense en alguna ruta donde el dato no dependa de localStorage? (Posible mejora futura, no bloqueante.)
4. **Mínimo de duración**: ¿forzar un `setTimeout` mínimo de 200-300ms para evitar flashes de skeleton en cargas instantáneas? Recomendación: no — usar el dato real, los flashes cortos son honestos.

## 8. Definition of Done

Una fase se considera terminada cuando:

- [ ] Cada ruta del scope navega sin pantalla blanca intermedia.
- [ ] El skeleton tiene la **misma silueta** que el contenido final (sin "saltos" de layout).
- [ ] Los tonos provienen de variables CSS del sistema, no colores hardcoded.
- [ ] El loader respeta mobile-first (verificado en viewport ≤ 414px).
- [ ] `npx tsc --noEmit` pasa.
- [ ] `npm run lint` pasa.

## 9. Referencias dentro del repo

- Design system: [docs/DESIGN.md](./DESIGN.md) — sección 4 (elevation), 5 (cards/inputs).
- Estado actual: [docs/ESTADO_ACTUAL_APP.md](./ESTADO_ACTUAL_APP.md).
- Shell y layout: [components/shell/app-shell.tsx](../components/shell/app-shell.tsx).
- Auth shell ya implementado: [components/auth/auth-shell.tsx](../components/auth/auth-shell.tsx).
- Ejemplo de skeleton inline a refactorizar: [modules/finanzas/components/finanzas-kpi-overview.tsx:104-130](../modules/finanzas/components/finanzas-kpi-overview.tsx#L104-L130).
- Auth guard a reemplazar: [components/auth/auth-guard.tsx:44-50](../components/auth/auth-guard.tsx#L44-L50).
