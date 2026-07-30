# Tracking de Habitos — Frontend

Aplicacion web para tracking de habitos (finanzas, entrenamientos, nutricion, compras). Construida sobre Next.js 16 (App Router) y React 19.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- TanStack Query (`@tanstack/react-query`) con persistencia selectiva en `localStorage`
- Axios (`lib/api.ts`) con interceptores de auth
- React Hook Form + Zod
- Radix UI + Sonner (toasts)

## Comandos

```bash
npm install
npm run dev       # Servidor de desarrollo (http://localhost:3000)
npm run build     # Build de produccion
npm start         # Servir build de produccion
npm run lint      # ESLint
npx tsc --noEmit  # Type check
```

No hay suite de tests configurada (ver `docs/AUDITORIA_PROYECTO.md` Fase 5).

## Variables de entorno

Copia `.env.example` a `.env.local` y completa:

| Variable               | Requerido | Uso                                                |
| ---------------------- | --------- | -------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`  | Si        | URL base del backend (consumida desde el navegador)|

Importante: cualquier variable con prefijo `NEXT_PUBLIC_` se inyecta en el bundle del cliente — no usar para secretos.

## Arquitectura

Resumen rapido (ver `CLAUDE.md` para detalles):

- Rutas publicas: `/login`, `/register`.
- Rutas protegidas: `/app/<modulo>/**` (auth-guard valida la cookie de sesión mediante el perfil remoto).
- Cada feature vive en `modules/<feature>/` con `api/`, `hooks/`, `types/`, `schemas/`, `components/`.
- Cliente Axios centralizado en `lib/api.ts` (envía credenciales `HttpOnly`, conserva compatibilidad bearer y redirige a `/login` ante 401).
- Query keys centralizadas en `lib/query-keys.ts`.

## Auth y sesion

El navegador usa una sesión opaca y revocable en cookie `HttpOnly`:

- Login/logout web: `/auth/session/login` y `/auth/session/logout`.
- La sesión se renueva al validar el perfil: 30 días de inactividad y 90 días como límite absoluto.
- JWT bearer permanece disponible para compatibilidad con clientes de API.
- En logout y login se limpia el cache persistido de React Query (`queryClient.clear()`) para evitar fuga de datos entre usuarios en el mismo navegador.

## Persistencia de cache

Solo se persisten queries marcadas con `meta: { persist: true }`. La politica vigente es persistir solo catalogos no sensibles (ej: bancos, ejercicios, tipos musculares, tablas nutricionales, cadenas/locales de compras). Datos del usuario (categorias, gimnasios, productos financieros) **no** se persisten.

## Documentacion adicional

- `CLAUDE.md` — guia para asistentes Claude Code que trabajan en este repo.
- `docs/AUDITORIA_PROYECTO.md` — auditoria tecnica (2026-04-30).
- `docs/AVANCES_AUDITORIA.md` — seguimiento de tareas de la auditoria.

## Checklist antes de PR

```bash
npm run lint
npx tsc --noEmit
npm run build
npm audit
```
