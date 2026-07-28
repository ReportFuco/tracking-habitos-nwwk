# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Development server
npm run build    # Production build
npm run lint     # ESLint
npx tsc --noEmit # Type checking
```

No test suite is configured.

## Architecture

**Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, Zod + react-hook-form, Axios, Radix UI, Sonner (toasts).

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

Modules: `auth`, `finanzas`, `entrenamientos`, `compras`, `nutricion`, `usuario`.

### Data flow

1. Pages/components call hooks (`use<Feature>`)
2. Hooks call API methods from `modules/<feature>/api/`
3. API methods use the Axios instance at `lib/api.ts`

### Authentication

JWT stored in `localStorage` (`auth_token` key). The Axios instance in `lib/api.ts` auto-injects `Authorization: Bearer <token>` on every request and redirects to `/login?next=<path>` on 401 responses. Route protection is done via `components/auth/auth-guard.tsx`, which validates the token locally then confirms with `GET /api/usuarios/perfil`.

### Layout / Shell

Protected pages are wrapped in `components/shell/app-shell.tsx`, which renders:
- Desktop: sidebar (`sidebar-nav.tsx`) + topbar
- Mobile: bottom navigation (`mobile-bottom-nav.tsx`)

Page-level layout uses `PageHeader` and `ContextNav` (breadcrumbs) from `components/shell/`.

### Styling conventions

CSS variables drive per-module theming (e.g., `--module-finanzas`, `--surface-lowest`). Design tokens follow the "Digital Atelier" system: olive/brick palette, border-radius 1.25–1.75rem, airy shadows. Tailwind classes use `sm:` breakpoints for desktop overrides (mobile-first). Use `p-4 sm:p-5`, avoid `text-3xl` on mobile — prefer `text-xl` scaling up.

### Forms

All forms use `react-hook-form` + `zodResolver`. Validation schemas live in `modules/<feature>/schemas/`. Reusable form primitives are in `components/forms/` and `components/ui/`.
