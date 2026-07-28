# Avances de la auditoria

Seguimiento de las tareas definidas en `docs/AUDITORIA_PROYECTO.md`.

Convenciones de estado:
- [ ] pendiente
- [~] en progreso
- [x] hecho
- [!] bloqueado / requiere decision del usuario

Cada tarea pequena debe poder cerrarse en una sola sesion y dejar el proyecto compilando (`npm run lint`, `npx tsc --noEmit`, `npm run build`).

---

## Fase 1: estabilizacion inmediata

### 1.1 Corregir warnings de lint en `entrenamiento-activo-card.tsx`
- Estado: [x] hecho (2026-04-30)
- Archivo: `modules/entrenamientos/components/entrenamiento-activo-card.tsx`
- Cambio aplicado: se elimino el `useEffect` de prefill con `eslint-disable react-hooks/exhaustive-deps` y se movio la logica al nuevo handler `handleEjercicioChange`, que se conecta al `onChange` del combobox de ejercicio. El prefill ahora corre solo cuando el usuario elige un ejercicio (no en cada re-render con la misma id), evitando deps faltantes y posibles loops de `setForm`.
- Verificacion: `npm run lint` limpio, `npx tsc --noEmit` sin errores.

### 1.2 Agregar `aria-current="page"` en navegacion
- Estado: [x] hecho (2026-04-30)
- Archivos: `components/shell/sidebar-nav.tsx`, `components/shell/mobile-bottom-nav.tsx`.
- Cambio aplicado: el link activo expone `aria-current="page"` (sidebar y bottom nav). Ademas se anadio `aria-label="Navegacion principal"` al `<nav>` en ambos componentes para diferenciarlos como landmarks.
- Verificacion: `npm run lint` limpio, `npx tsc --noEmit` sin errores.

### 1.3 Revisar queries persistidas y retirar persistencia de datos privados
- Estado: [x] hecho (2026-04-30)
- Archivos: `modules/finanzas/hooks/useFinanzas.tsx`, `modules/entrenamientos/hooks/useEntrenamientos.tsx`, `modules/auth/hooks/useAuth.tsx`.
- Clasificacion aplicada:
  - Persist conservado (catalogos publicos): `compras.cadenas`, `compras.locales`, `entrenamientos.ejercicios`, `entrenamientos.tiposMusculares`, `nutricion.tablas`, `finanzas.bancos`.
  - Persist retirado (datos del usuario o dudosos): `finanzas.categorias`, `finanzas.productos(idBanco)`, `entrenamientos.gimnasios` (incluido el `fetchQuery` imperativo).
- Cambio adicional: en login (`useAuth.onSuccess`) se llama `queryClient.clear()` antes de setear el token, para evitar que un usuario nuevo herede el cache persistido del anterior en el mismo navegador. En logout ya se limpiaba (clearStoredSession + queryClient.clear).
- Verificacion: `npm run lint` limpio, `npx tsc --noEmit` sin errores.
- Pendiente fuera de alcance de esta tarea: versionado de `QUERY_CACHE_STORAGE_KEY` por usuario (a evaluar en Fase 3.5).

### 1.4 Helper centralizado de parseo numerico
- Estado: [x] hecho (2026-04-30)
- Archivos: `lib/parse-numeric.ts` (nuevo), `modules/nutricion/components/tablas-admin-manager.tsx`.
- Cambio aplicado:
  - Nuevo helper `parseOptionalNumber` (string vacio -> null, numero finito -> number incluyendo 0, invalido -> lanza `InvalidNumericInputError`) y `parseRequiredNumber`.
  - Reemplazados todos los usos de `Number(x) || null` y `f.x ? Number(f.x) : null` en `toCreatePayload` y `toPatchPayload`.
  - El `catch` de `handleSubmit` distingue `InvalidNumericInputError` para mostrar un toast descriptivo en lugar del genérico.
- Verificacion: `npm run lint` limpio, `npx tsc --noEmit` sin errores. Test manual pendiente del usuario.

### 1.5 Actualizar README con comandos y notas de entorno
- Estado: [x] hecho (2026-04-30)
- Archivo: `README.md`.
- Cambio aplicado: README reescrito con stack real (Next.js 16, React 19, TanStack Query, etc.), comandos `npm` reales, tabla de variables de entorno, notas de auth/localStorage, politica de persistencia de cache, links a `CLAUDE.md` y a los docs de auditoria, y checklist de PR.

---

## Fase 2: datos y cache

### 2.1 Hooks React Query para managers admin
- Estado: [x] hecho (2026-04-30)
- Archivos: `lib/query-keys.ts`, `modules/compras/components/cadenas-manager.tsx`, `modules/catalogo/components/productos-manager.tsx`, `modules/nutricion/components/tablas-admin-manager.tsx`.
- Cambio aplicado:
  - Nuevas query keys en `lib/query-keys.ts`: `catalogo.marcas`, `catalogo.productosRoot`, `catalogo.productos(params)`.
  - Los tres managers admin ahora consumen via `useQuery` y mutan via `useMutation`. Eliminado todo `useEffect`/`useState` para datos remotos. Los listados se actualizan invalidando query keys, no replicando estado local.
  - Invalidaciones cruzadas: `productos-manager` invalida `catalogo.productosRoot` y `nutricion.tablas` (las tablas muestran `nombre_producto` denormalizado). `cadenas-manager` invalida `compras.cadenas` y `compras.locales`. `tablas-admin-manager` invalida `nutricion.tablas`.
- Verificacion: `npm run lint` limpio, `npx tsc --noEmit` sin errores.

### 2.2 Invalidaciones cruzadas en finanzas
- Estado: [ ]
- Archivo: `modules/finanzas/hooks/useFinanzas.tsx`.

### 2.3 Query keys root por recurso editable
- Estado: [ ]
- Archivo: `lib/query-keys.ts`.

### 2.4 Validacion runtime con Zod en respuestas criticas
- Estado: [ ]
- Archivos: `modules/**/api/*.api.ts`.

### 2.5 Eliminar normalizaciones silenciosas en entrenamientos
- Estado: [ ]
- Archivo: `modules/entrenamientos/api/entrenamientos.api.ts`.

---

## Fase 3: auth y seguridad

### 3.1 Store/hook unico de sesion
- Estado: [ ]

### 3.2 Guards/interceptor/perfil leen del store central
- Estado: [ ]

### 3.3 Evaluar cookie HttpOnly para tokens
- Estado: [ ] (depende del backend)

### 3.4 Documentar `NEXT_PUBLIC_API_URL` por ambiente
- Estado: [ ]

### 3.5 Politica de limpieza de cache en logout/cambio de usuario
- Estado: [ ]

---

## Fase 4: accesibilidad y UX

### 4.1 Asociar labels con controles en formularios
- Estado: [ ]

### 4.2 Errores inline con `aria-describedby`
- Estado: [ ]

### 4.3 Rehacer `SearchableCombobox` con patron ARIA correcto
- Estado: [ ]

### 4.4 Drawer mobile a Dialog/Sheet accesible
- Estado: [ ]

### 4.5 Revision de flujos con teclado
- Estado: [ ]

---

## Fase 5: pruebas y CI local

### 5.1 Instalar Vitest + Testing Library
- Estado: [ ]

### 5.2 Scripts `test`, `test:watch`, `typecheck`
- Estado: [ ]

### 5.3 Cobertura inicial (auth-session, payload builders, hooks criticos, normalizadores, guards)
- Estado: [ ]

### 5.4 Checklist de PR
- Estado: [ ]

---

## Bitacora

- 2026-04-30: Creado este documento. Inicio en Fase 1.1.
- 2026-04-30: Cerrada Fase 1.1. `npm run lint` queda en 0 warnings y `npx tsc --noEmit` limpio.
- 2026-04-30: Cerrada Fase 1.2. `aria-current="page"` y `aria-label` en sidebar y bottom nav.
- 2026-04-30: Cerrada Fase 1.3. Persistencia de queries privadas retirada (categorias, productos finanzas, gimnasios). `queryClient.clear()` en login.
- 2026-04-30: Cerrada Fase 1.4. Helper `parseOptionalNumber/parseRequiredNumber` en `lib/parse-numeric.ts`, integrado en `tablas-admin-manager.tsx`.
- 2026-04-30: Cerrada Fase 1.5. README reescrito. **Fase 1 completa.**
- 2026-04-30: Cerrada Fase 2.1. Tres managers admin migrados a React Query. Invalidaciones cruzadas productos<->tablas y cadenas<->locales.
