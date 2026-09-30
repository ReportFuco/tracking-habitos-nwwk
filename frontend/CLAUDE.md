# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Development server
npm run build      # Production build
npm run lint       # ESLint
npx tsc --noEmit   # Type checking
npm test           # Vitest (una pasada)
npm run test:watch # Vitest en modo watch
```

### Tests

Vitest con entorno `jsdom`, en `tests/`. `tests/setup.ts` instala `fake-indexeddb`,
porque jsdom no implementa IndexedDB y la persistencia del cache se apoya en ella.
El alias `@/` está replicado en `vitest.config.ts` para que los tests importen los
módulos reales en lugar de una copia.

La cobertura es deliberadamente acotada al comportamiento offline, que es difícil de
comprobar a mano y fácil de romper sin darse cuenta:

- `tests/query-persistence.test.ts` — qué se persiste y qué no, que el logout no deje
  datos del usuario anterior, y que el `buster` descarte cachés de versiones viejas.
- `tests/entrenamientos-offline.test.ts` — la cola offline del entreno activo:
  actualización optimista, supervivencia a una recarga y reenvío **en orden**.

## Architecture

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Zod + react-hook-form, Axios, Radix UI, Sonner (toasts).

**Environment:** `NEXT_PUBLIC_API_URL` is the only required env var (see `.env.example`).

### Route structure

- `/login`, `/register` — public auth pages
- `/app/<module>/**` — protected app routes
- `/administrador/**` — legacy routes, all redirect to `/app/**` via `next.config.ts`

### Module pattern

Each feature lives in `modules/<feature>/` with:
- `api/<feature>.api.ts` — all API calls via the shared `lib/api.ts` Axios instance
- `hooks/use<Feature>.tsx` — React hooks (some use Context providers)
- `types/`, `schemas/` — TypeScript types and Zod validation schemas
- `components/` — feature-specific components

Modules: `auth`, `finanzas`, `catalogo`, `entrenamientos`, `nutricion`, `usuario`, `dashboard`.
Lo que se compra en un gasto se detalla como productos del movimiento (finanzas +
catalogo); el antiguo modulo `compras` ya no existe.

### Data flow

1. Pages/components call hooks (`use<Feature>`)
2. Hooks call API methods from `modules/<feature>/api/`
3. API methods use the Axios instance at `lib/api.ts`

### Authentication

Browser/PWA auth uses a revocable opaque session in an `HttpOnly` cookie through `/auth/session/*`. Axios sends credentials, retains legacy bearer injection only for migration/API compatibility, and redirects to `/login?next=<path>` on authenticated 401 responses. Route protection is done via `components/auth/auth-guard.tsx`, which confirms the session with `GET /api/usuarios/perfil`; successful profile validation renews the idle session.

### Layout / Shell

Protected pages are wrapped in `components/shell/app-shell.tsx`, which renders:
- Desktop: sidebar (`sidebar-nav.tsx`) + topbar
- Mobile: bottom navigation (`mobile-bottom-nav.tsx`)

Page-level layout uses `PageHeader` and `ContextNav` (breadcrumbs) from `components/shell/`.

### Styling conventions

Marca **Ritmo** (nombre, textos y colores de sistema en `lib/brand.ts`; logo en
`components/brand/brand-mark.tsx`). Estilo de cartel suizo: bloques de color solidos,
esquinas casi rectas, sin sombras difusas, tipografia Archivo (ancha y pesada en titulos).

- Tokens en `app/globals.css` (Tailwind 4 CSS-first, sin `tailwind.config.ts`). `:root` es
  el tema claro y `.dark` el oscuro; se activa con `lib/theme.ts` (script en `<head>` que
  evita el destello, selector en Perfil y en la topbar).
- Cada modulo tiene tres roles de color: `--module-X` (tinta legible sobre superficies y
  fondo de boton junto a `--module-X-foreground`) y `--module-X-fill` / `--module-X-on`
  (bloque solido de la marca y su texto). No usar `--module-X` como fondo con otro color
  de texto.
- Radios: usar la escala `rounded-sm..4xl` (aplanada en `@theme`), nunca `rounded-[..rem]`.
  `rounded-full` solo para avatares, puntos y controles circulares.
- `font-display` (utilidad propia) para h1, cifras protagonistas y la marca; ocupa ~25%
  mas de ancho, usarla con mesura en movil.
- Nada de colores literales ni `white`/`black` fijos: todo sale de tokens para que el
  modo oscuro funcione. Graficos en `components/charts/`; series con `--serie-*`.
- Mobile-first con overrides `sm:`. Usa `p-4 sm:p-5`, evita `text-3xl` en movil.

### Forms

All forms use `react-hook-form` + `zodResolver`. Validation schemas live in `modules/<feature>/schemas/`. Reusable form primitives are in `components/forms/` and `components/ui/`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
