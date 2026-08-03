# Auditoria tecnica y plan de accion

Estado de esta documentacion: vigente desde 2026-08-02.

Esta carpeta es la fuente canonica para retomar la auditoria tecnica del proyecto. Las
auditorias que permanecen en `frontend/docs/` son historicas y pueden contener decisiones
ya implementadas o descripciones que no coinciden con el codigo actual.

## Documentos

- [`FRONTEND.md`](./FRONTEND.md): diagnostico, evidencia, fortalezas y riesgos.
- [`PLAN_FRONTEND.md`](./PLAN_FRONTEND.md): backlog ejecutable, ordenado por fases y con
  criterios de aceptacion.

## Estado comprobado

La ultima verificacion local se ejecuto el 2026-08-02:

```text
npm test            3 archivos, 12/12 pruebas
npm run lint        correcto
npx tsc --noEmit    correcto
npm run build       correcto, 42 rutas
node --check public/sw.js    correcto
npm audit --omit=dev         5 vulnerabilidades altas
```

Estos resultados describen compilacion y pruebas unitarias. No demuestran que el shell
PWA ni los formularios funcionen correctamente sin conexion.

## Orden recomendado

1. Seguridad documental y dependencias (`REPO-SEC-001`, `FE-SEC-001`).
2. Bloqueos offline y contrato de idempotencia (`FE-OFF-*`).
3. Shell PWA y pruebas end-to-end (`FE-PWA-*`).
4. Estabilizacion de TanStack Query (`FE-TQ-*`).
5. Contratos Zod de API (`FE-ZOD-*`).
6. Limites arquitectonicos y documentacion para agentes (`FE-ARCH-*`, `FE-DOC-*`).
7. Normalizacion visual y accesibilidad (`FE-UI-*`).

No se debe comenzar una fase posterior si modifica el mismo flujo que una tarea P0 aun
abierta.

## Flujo para un agente

Antes de editar:

1. Leer este archivo, `FRONTEND.md` y la tarjeta elegida en `PLAN_FRONTEND.md`.
2. Comprobar `git status --short` y conservar cambios ajenos.
3. Confirmar las lineas actuales: los numeros citados son evidencia del 2026-08-02 y el
   codigo puede haberse movido.
4. Marcar una sola tarjeta como `[~]` y anotar agente/fecha. Evitar tomar dos tareas que
   compartan archivos.
5. Si aparece una decision de producto o un cambio de contrato backend, detenerse y
   registrar el bloqueo; no inventar la decision.

Durante la implementacion:

- Mantener el alcance de la tarjeta.
- Agregar o actualizar pruebas que fallen antes del arreglo.
- No introducir credenciales, tokens, URLs privadas ni datos personales en codigo, tests
  o documentacion.
- Para operaciones offline, no declarar soporte hasta comprobar recarga, cierre de la PWA,
  reconexion e idempotencia.
- Para respuestas HTTP, validar en el adapter antes de introducir datos en TanStack Query.
- En Tailwind 4, usar el theme CSS-first de `frontend/app/globals.css`; no crear un
  `tailwind.config.ts` salvo una necesidad demostrada.

Al terminar:

1. Ejecutar las verificaciones de la tarjeta.
2. Ejecutar como minimo, desde `frontend/`:

   ```bash
   npm run lint
   npx tsc --noEmit
   npm test
   npm run build
   ```

3. Cambiar `[~]` a `[x]` solamente si se cumplen todos los criterios de aceptacion.
4. Agregar bajo la tarjeta: fecha, archivos cambiados, pruebas y decisiones relevantes.
5. Si queda trabajo obligatorio, mantener `[ ]` o `[!]`; no declarar la tarea terminada.

## Convenciones de estado

- `[ ]`: pendiente.
- `[~]`: en progreso.
- `[x]`: completada y verificada.
- `[!]`: bloqueada por decision, contrato externo o acceso faltante.

## Reglas que no deben romperse

- El alta de usuario requiere conexion. No persistir contrasenas para reintento offline.
- Una mutacion encolable necesita key estable, funcion restaurable, actualizacion optimista,
  escritura durable e idempotencia en servidor.
- Una mutacion solo-online debe fallar rapido sin dejar el formulario en `isPaused`.
- El cache persistido pertenece al usuario autenticado y debe limpiarse al cambiar de
  identidad.
- `z.infer` debe ser la fuente de tipos cuando ya existe un schema equivalente.
- Los documentos historicos no tienen precedencia sobre el codigo ni sobre esta carpeta.

