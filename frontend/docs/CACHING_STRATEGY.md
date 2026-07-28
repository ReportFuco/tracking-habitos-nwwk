# Plan de Caching y Reducción de llamadas a la API

Fecha: 2026-04-25
Estado: Propuesta — pendiente de implementación

## 1. TL;DR

Hoy **no existe ninguna capa de caché** en el frontend. Cada montaje de componente, cada navegación entre rutas y cada acción CRUD dispara peticiones HTTP nuevas, incluso para datos que prácticamente no cambian (bancos, categorías, ejercicios, perfil del usuario).

Las redundancias más caras detectadas:

- **`AuthAPI.getProfile()` se llama 3 veces por cada navegación a una ruta protegida** ([useAuth.tsx:21](../modules/auth/hooks/useAuth.tsx#L21), [auth-guard.tsx:34](../components/auth/auth-guard.tsx#L34), [app-shell.tsx:38](../components/shell/app-shell.tsx#L38)).
- **`FinanzasProvider` recarga 4 endpoints en paralelo** ([useFinanzas.tsx:42-82](../modules/finanzas/hooks/useFinanzas.tsx#L42-L82)) cada vez que el usuario abre una página del módulo, porque el provider vive a nivel de page, no de layout.
- **`runAction()` refetch-ea TODO el catálogo después de crear UN movimiento** ([useFinanzas.tsx:103-114](../modules/finanzas/hooks/useFinanzas.tsx#L103-L114)) — hoy son 4 GET extra para invalidar 1 cache que no existe.

Sobre Redis: **no aplica directamente a este frontend** en su arquitectura actual. Redis es caché server-side y este Next.js App es prácticamente todo client-side (JWT en `localStorage`, axios directo desde el browser). Redis solo tendría sentido si introducimos un BFF (Route Handlers de Next que proxyen al backend). Detalle en sección 8.

La solución correcta y proporcional al tamaño del proyecto es **TanStack Query** (React Query) + **mover providers al layout** + **persistir catálogos rara-vez-cambiantes en `localStorage`**. Ningún Redis necesario.

## 2. Diagnóstico actual

### 2.1 Patrón general

Todas las páginas siguen el mismo flujo:

1. Componente client se monta.
2. Llama un hook (`useAuth`, `useFinanzas`, `useEntrenamientos`, etc.).
3. El hook ejecuta `useEffect` → axios → API → `setState`.
4. No hay deduplicación, ni TTL, ni invalidación selectiva.

Verificable en [useFinanzas.tsx:168-171](../modules/finanzas/hooks/useFinanzas.tsx#L168-L171), [useAuth.tsx:84-98](../modules/auth/hooks/useAuth.tsx#L84-L98), y replicado en `useEntrenamientos`, `useNutricion`, `useCompras`, `useUsuarios`, `usePerfil`.

### 2.2 Redundancias críticas

**A) Profile triple-fetch en cada navegación protegida**

Al entrar, por ejemplo, a `/app/finanzas/movimientos`:

| Origen | Llamada | Necesidad real |
|---|---|---|
| [auth-guard.tsx:34](../components/auth/auth-guard.tsx#L34) | `getProfile()` | Validar token vivo |
| [app-shell.tsx:38](../components/shell/app-shell.tsx#L38) | `getProfile()` | Mostrar nombre/avatar en topbar |
| [useAuth.tsx:21](../modules/auth/hooks/useAuth.tsx#L21) (si la página usa el hook) | `getProfile()` | Estado de auth en UI |

→ 3 requests idénticos en milisegundos, sin razón.

**B) Catálogos finanzas se recargan en cada page-view**

Cada page de `/app/finanzas/**` que necesita el provider hace `<FinanzasProvider>` a nivel de page (`movimientos/page.tsx`, `cuentas/page.tsx`, etc.). Al navegar `movimientos → cuentas → registrar-cuenta`, el provider se desmonta y se vuelve a montar 3 veces, lo que dispara `fetchCatalogos()` 3 veces × 4 endpoints = **12 requests** para datos que no cambiaron.

**C) Refetch total post-mutación**

[useFinanzas.tsx:103-114](../modules/finanzas/hooks/useFinanzas.tsx#L103-L114): después de crear/editar/eliminar UN movimiento, se llama `fetchCatalogos()` que recarga bancos + categorías + cuentas + movimientos. Solo `movimientos` necesitaba refresh.

**D) Catálogos casi-estáticos sin persistencia**

`bancos`, `categorias`, `ejercicios`, `gimnasios`, `marcas`, `cadenas`, `tablas-nutricionales`, `productos`: son datos administrativos que cambian rara vez (no varias veces al día). Hoy se piden a la API en cada montaje. Candidatos perfectos para `localStorage` con TTL.

**E) `FinanzasKpiOverview` aislado**

[finanzas-kpi-overview.tsx:89-91](../modules/finanzas/components/finanzas-kpi-overview.tsx#L89-L91) hace su propio `getAnaliticaResumen()` sin compartir estado con `FinanzasProvider`. Si entras al dashboard y luego a finanzas, se piden datos relacionados dos veces.

## 3. Estrategia recomendada

Tres capas, en orden de impacto:

### Capa 1 — TanStack Query (impacto alto, ~1 día de trabajo)

Es la herramienta estándar para esto en React. Aporta:

- **Deduplicación automática**: 3 componentes pidiendo `getProfile()` al mismo tiempo → 1 sola request.
- **Stale-while-revalidate**: muestra datos del caché instantáneamente, refetch en background si están "stale".
- **Invalidación quirúrgica**: después de crear un movimiento, invalidas solo `["movimientos"]`, no todo.
- **Refetch on window focus**: opcional, útil para datos sensibles a frescura.
- **Retry con backoff**: ya viene resuelto.
- **Estados `isLoading`, `isFetching`, `isError`, `data`**: reemplazan la maraña de `useState` actual.

Razón por la que **no** propongo SWR o Zustand+custom: TanStack Query tiene mejor invalidación, mejor DevTools, y es lo que ya conoce todo el ecosistema React 19. El proyecto ya tiene Zod + react-hook-form (escogió las opciones canónicas), así que mantiene esa línea.

### Capa 2 — Mover providers a layouts (impacto alto, costo bajo)

Convención App Router: el provider va lo más arriba posible en el árbol donde TODOS los hijos lo necesitan.

```
app/app/finanzas/
├── layout.tsx          # ← FinanzasProvider VIVE AQUÍ
├── page.tsx
├── movimientos/page.tsx
├── cuentas/page.tsx
└── ...
```

Resultado: navegar entre páginas del módulo **no desmonta el provider**, no recarga catálogos. Solo los `loading.tsx` (ver [LOADING_Y_SKELETONS.md](./LOADING_Y_SKELETONS.md)) cubren el segmento intermedio.

Aplica también a:
- `EntrenamientosProvider` → `app/app/entrenamientos/layout.tsx`
- `NutricionProvider` → `app/app/nutricion/layout.tsx`
- `ComprasProvider` → `app/app/compras/layout.tsx`
- Un `SessionProvider` con `profile` en `app/app/layout.tsx` (raíz protegida) — elimina el triple-fetch.

### Capa 3 — Persistencia de catálogos en `localStorage` (impacto medio, costo bajo)

Para los catálogos casi-estáticos: usar el plugin oficial `@tanstack/query-sync-storage-persister`. Configuras qué queries persistir y por cuánto tiempo (`gcTime`).

```ts
// queries con TTL largo y persistencia
useQuery({
  queryKey: ["finanzas", "bancos"],
  queryFn: FinanzasAPI.getBancos,
  staleTime: 1000 * 60 * 60 * 24, // 24h
  gcTime: 1000 * 60 * 60 * 24 * 7, // 7 días en localStorage
})
```

Esto da una experiencia tipo "app nativa": la primera vez que abres el navegador en el día, lees del disco; en background revalida.

## 4. Mapa de queries propuesto

### Auth / Sesión
| queryKey | staleTime | persist | Origen actual |
|---|---|---|---|
| `["auth", "profile"]` | 5 min | no | 3 lugares hoy → 1 |

### Finanzas
| queryKey | staleTime | persist | Notas |
|---|---|---|---|
| `["finanzas", "bancos"]` | 24h | sí | Catálogo estático |
| `["finanzas", "categorias"]` | 24h | sí | Catálogo estático |
| `["finanzas", "cuentas"]` | 5 min | no | Cambia con CRUD del usuario |
| `["finanzas", "movimientos", { offset, limit }]` | 1 min | no | Paginación; usar `useInfiniteQuery` |
| `["finanzas", "analitica", { year, month }]` | 5 min | no | Reemplaza fetch suelto del KPI overview |
| `["finanzas", "productos", { idBanco }]` | 24h | sí | Por banco |

### Entrenamientos
| queryKey | staleTime | persist |
|---|---|---|
| `["entrenamientos", "ejercicios"]` | 24h | sí |
| `["entrenamientos", "gimnasios"]` | 6h | sí |
| `["entrenamientos", "fuerza", "lista"]` | 1 min | no |
| `["entrenamientos", "fuerza", "activo"]` | 0 (siempre fresco) | no |

### Nutrición / Compras / Catálogos admin
Mismo patrón: tablas nutricionales, marcas, cadenas, locales, productos → 24h + persist. Listados del usuario → 1-5 min.

## 5. Invalidación post-mutación

Reemplazar el "refetch total" por invalidaciones específicas:

```ts
const queryClient = useQueryClient()

const crearMovimiento = useMutation({
  mutationFn: FinanzasAPI.createMovimiento,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["finanzas", "movimientos"] })
    queryClient.invalidateQueries({ queryKey: ["finanzas", "analitica"] })
    // bancos, categorías, cuentas NO se tocan
  },
})
```

Esto solo elimina la causa raíz del problema D del diagnóstico.

## 6. Roadmap por fases

### Fase 0 — Setup (medio día)
- [ ] `npm i @tanstack/react-query @tanstack/react-query-devtools`
- [ ] Crear `app/providers.tsx` con `QueryClientProvider` y defaults globales (staleTime: 30s, retry: 1, refetchOnWindowFocus: false).
- [ ] Envolver `app/layout.tsx` raíz.
- [ ] Habilitar Devtools solo en dev.

### Fase 1 — Sesión y profile (medio día)
- [ ] Crear `useProfile()` con TanStack Query.
- [ ] Crear `app/app/layout.tsx` (layout protegido) con `<AuthGuard>` + provider de sesión.
- [ ] Eliminar `getProfile()` duplicados de `auth-guard`, `app-shell` y `useAuth`. Todos consumen el mismo `useProfile()`.
- [ ] Migrar `useAuth` a `useMutation` para login/register/logout.

### Fase 2 — Finanzas (1 día)
- [ ] Mover `FinanzasProvider` (refactorizado) o sus hooks individuales a `app/app/finanzas/layout.tsx`.
- [ ] Convertir `useFinanzas` en hooks atómicos: `useBancos`, `useCategorias`, `useCuentas`, `useMovimientos`, `useAnaliticaResumen`.
- [ ] Convertir `crear*`/`editar*`/`eliminar*` en `useMutation` con invalidación quirúrgica.
- [ ] Reemplazar fetch inline de [finanzas-kpi-overview.tsx:89-91](../modules/finanzas/components/finanzas-kpi-overview.tsx#L89-L91).

### Fase 3 — Entrenamientos (1 día)
- [ ] Mismo patrón. Especial: `entrenamiento_activo` con `staleTime: 0` y `refetchOnWindowFocus: true`.

### Fase 4 — Nutrición + Compras + Usuario (1 día)
- [ ] Migrar los 3 hooks de módulo restantes.

### Fase 5 — Persistencia (medio día)
- [ ] `npm i @tanstack/query-sync-storage-persister @tanstack/react-query-persist-client`.
- [ ] Configurar persistencia selectiva (solo queries con `meta: { persist: true }`).
- [ ] Definir busting del cache cuando cambia versión de la app o el usuario hace logout.

### Fase 6 — Limpieza (medio día)
- [ ] Borrar `useState` huérfanos que ya no se usan.
- [ ] Borrar `useEffect` de fetching reemplazados.
- [ ] Verificar Network tab en DevTools: navegar `dashboard → finanzas → movimientos → cuentas → finanzas → dashboard` no debería disparar más de ~5 requests totales (vs ~25 actuales).

## 7. Métricas de éxito

Antes de empezar, capturar baseline en DevTools Network (filtro XHR) navegando un flow estándar:

1. Login.
2. Dashboard.
3. Finanzas → Movimientos → Crear movimiento → Cuentas → Volver a Finanzas.
4. Entrenamientos → Activo.
5. Logout.

Métricas:
- Total de requests al backend: hoy ~30-40 estimado, objetivo < 12.
- `getProfile()` en el flow: hoy 6+, objetivo 1.
- `getBancos()` / `getCategorias()` por sesión: hoy 4-6, objetivo 1.
- Tiempo de transición entre páginas del mismo módulo: hoy ~400-800ms, objetivo < 50ms (instantáneo desde cache).

## 8. ¿Y Redis? — discusión honesta

Redis es un store key-value en memoria que vive **en un servidor**. En la arquitectura actual:

```
Browser (Next App, axios) ──► Backend (FastAPI/Django/etc.) ──► DB
```

El frontend habla directo al backend con JWT. Para que Redis aporte algo aquí hay tres caminos:

### Opción A — Redis en el backend (no es este repo)
El backend cachea respuestas costosas (analíticas, agregaciones) en Redis. **Esto es lo correcto** si el cuello de botella es la DB, pero vive en otro repo, no en este. Vale la pena proponérselo al backend si `getAnaliticaResumen` es lento.

### Opción B — BFF en Next.js + Redis (over-engineering hoy)
Convertir las llamadas client → backend en client → Route Handler de Next → backend, con Redis (vía Upstash, por ejemplo) cacheando en el medio. Beneficios:
- Cache compartido entre todos los usuarios (no por-browser).
- Permite SSR/RSC porque oculta el JWT del cliente (cookie httpOnly).
- Edge caching.

Costo:
- Reescribir el patrón de auth (JWT en localStorage → cookies httpOnly).
- Pagar Upstash o levantar Redis.
- Añadir un layer entero de routes en `app/api/**`.

**Recomendación: NO hacerlo ahora.** El proyecto es personal, single-user (Francisco), client-heavy. El beneficio no compensa el costo. Reservar para cuando: (a) haya múltiples usuarios reales, (b) el backend sea lento y no se pueda tocar, (c) se quiera SEO/SSR de partes con datos.

### Opción C — IndexedDB / localStorage como "Redis del browser"
Es lo que TanStack Query Persister hace (sección 3, capa 3). Para esta app es la opción **correcta y suficiente**. Da el 80% del beneficio de Redis (lecturas instantáneas, menos requests) sin la infraestructura.

### Resumen Redis
| Escenario | ¿Redis tiene sentido? |
|---|---|
| Hoy, frontend-only, single-user | **No** — usar TanStack Query + persistencia local |
| Mañana, si el backend cachea analíticas pesadas | Sí, **en el backend**, no aquí |
| Pasado mañana, si se vuelve multi-user con SSR | Sí, **vía BFF**, evaluar Upstash |

## 9. Decisiones a confirmar antes de Fase 0

1. **¿TanStack Query o SWR?** Recomendación firme: TanStack Query (mejor invalidación, mutaciones nativas, devtools).
2. **`refetchOnWindowFocus`**: ¿on u off por defecto? Recomendación: off global, on solo para `entrenamientos/activo`.
3. **¿Migrar `localStorage` JWT a cookie?** Hoy axios lee de `localStorage` ([api.ts:18](../lib/api.ts#L18)). Si en el futuro se quiere SSR, esto bloquea. No urgente.
4. **¿Persistir cache entre sesiones de logout?** Recomendación: limpiar todo el cache de queries en `logout()` — evita filtrar datos del usuario A al usuario B en el mismo browser.

## 10. Definition of Done

Una fase está terminada cuando:

- [ ] El flow de prueba (sección 7) muestra reducción de requests al objetivo.
- [ ] No hay `useEffect` con fetch en el componente migrado.
- [ ] Las mutaciones invalidan solo las queries relacionadas.
- [ ] `npx tsc --noEmit` y `npm run lint` pasan.
- [ ] DevTools de TanStack Query muestra el árbol de queries esperado.

## 11. Referencias dentro del repo

- API instance: [lib/api.ts](../lib/api.ts).
- Hook ejemplo del problema: [modules/finanzas/hooks/useFinanzas.tsx](../modules/finanzas/hooks/useFinanzas.tsx).
- Triple fetch del profile: [components/auth/auth-guard.tsx](../components/auth/auth-guard.tsx), [components/shell/app-shell.tsx](../components/shell/app-shell.tsx), [modules/auth/hooks/useAuth.tsx](../modules/auth/hooks/useAuth.tsx).
- Fetch inline aislado: [modules/finanzas/components/finanzas-kpi-overview.tsx](../modules/finanzas/components/finanzas-kpi-overview.tsx).
- Plan complementario: [docs/LOADING_Y_SKELETONS.md](./LOADING_Y_SKELETONS.md).
