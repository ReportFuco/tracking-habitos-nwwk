# Coordinacion de trabajo activo

Actualizado: 2026-08-03 (America/Santiago).

Este archivo evita que dos agentes editen al mismo tiempo el flujo critico de
entrenamiento activo. Antes de tocar archivos listados aqui, revisar `git status --short`
y esta reserva.

## Reserva UX-ACTIVO-001 — Rediseño responsive del entrenamiento activo

- Estado: `[x]` completado y verificado (2026-08-03, Codex `/root`).
- Responsable: Codex `/root` en la conversacion de rediseño UX.
- Skill: `ui-ux-pro-max`.
- Objetivo: simplificar la eleccion de ejercicio, el registro repetitivo de series y la
  lectura del progreso, con experiencia mobile-first y accesible.
- Archivos reservados:
  - `frontend/modules/entrenamientos/components/activo/ejercicio-picker.tsx`
  - `frontend/modules/entrenamientos/components/activo/registro-serie.tsx`
  - `frontend/modules/entrenamientos/components/activo/series-sesion.tsx`
  - `frontend/modules/entrenamientos/components/activo/shared.tsx`
  - `frontend/app/app/entrenamientos/activo/page.tsx`
  - `frontend/modules/entrenamientos/components/entrenamiento-activo-card.tsx`
  - `frontend/modules/entrenamientos/components/ejercicio-media.tsx`
  - nuevos componentes puramente visuales bajo
    `frontend/modules/entrenamientos/components/activo/`
- Fuera de alcance de este trabajo:
  - hooks, API, tipos, schemas, mutations y persistencia offline;
  - backend y migraciones;
  - `entreno-fuerza-form.tsx`;
  - contratos o estados nuevos dentro de `entrenamiento-activo-card.tsx`.

La alerta `sync_error` que ya estaba en el diff concurrente fue preservada. Tras comprobar
que ese diff permanecio estable durante la primera etapa del rediseño, el archivo
`entrenamiento-activo-card.tsx` pasa a esta reserva para integrar solo la distribucion
responsive. El agente offline no debe volver a editarlo sin dejar una nota aqui.

### Resultado UX-ACTIVO-001

- Se redujo el encabezado de pagina para priorizar la accion y se incorporo un modo
  movil con vistas `Registrar`/`Resumen`; desde `xl` se mantienen ambas columnas.
- La seleccion de ejercicio, el registro repetitivo y el resumen de series ahora usan
  pasos explicitos, controles tactiles de al menos 44 px, feedback visible y foco
  predecible.
- Se agrego confirmacion antes de eliminar una serie, soporte de movimiento reducido y
  una jerarquia visual coherente con la paleta existente. No se cambiaron contratos,
  hooks, API ni persistencia offline, y se preservo la alerta `sync_error`.
- Validacion: `npm run lint`, `npx tsc --noEmit`, `npm test` (25/25), `npm run build`
  (42 rutas), `npm audit --omit=dev` (0 vulnerabilidades), `node --check public/sw.js`
  y `git diff --check`, todos correctos.
- Pendiente no bloqueante: revision visual manual con una sesion autenticada en movil
  real; el repositorio no incluye Playwright ni un fixture reutilizable de sesion.
- Los archivos dejan de estar reservados al cerrar esta tarjeta. Antes de una nueva
  edicion, revisar el estado del worktree porque continúan cambios ajenos en el repo.

## Trabajo concurrente detectado — FE-OFF-004

- Estado: `[x]` terminado y commiteado (2026-08-03, claude — FE-OFF-003 y FE-OFF-004).
- Archivos que quedaron tocados:
  - `frontend/modules/entrenamientos/hooks/useEntrenamientos.tsx`
  - `frontend/modules/entrenamientos/offline/entrenamientos-offline.ts`
  - `frontend/modules/entrenamientos/types/entrenamientos.ts`
  - `frontend/modules/entrenamientos/components/entreno-fuerza-form.tsx`
  - `frontend/modules/entrenamientos/components/entrenamiento-activo-card.tsx`
  - `frontend/tests/entrenamientos-offline.test.ts`
  - backend: modelos/rutas/schemas/migracion de idempotencia de entrenamiento-fuerza,
    `backend/tests/test_entrenamiento_fuerza_idempotencia.py`.
- `entrenamiento-activo-card.tsx` ya no tiene cambios ajenos sin confirmar: queda libre
  para el rediseño UX-ACTIVO-001 si lo necesita. No se toco
  `ejercicio-picker.tsx`/`registro-serie.tsx`/`series-sesion.tsx`.
- Detalle en `docs/auditoria/PLAN_FRONTEND.md`, tarjetas `FE-OFF-003` y `FE-OFF-004`.

## Protocolo al terminar

1. El responsable valida sus archivos y cambia su reserva a `[x]`.
2. Si necesita un archivo reservado por el otro trabajo, deja una nota aqui antes de
   editarlo.
3. No se mezclan cambios de contratos/offline con cambios visuales en un mismo commit.
