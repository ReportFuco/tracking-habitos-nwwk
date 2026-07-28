# Auditoria tecnica del frontend

Fecha: 2026-04-30

## Alcance

Se reviso el frontend Next.js ubicado en `frontend`, con foco en:

- seguridad de dependencias, configuracion y sesion;
- arquitectura de modulos, APIs, hooks y React Query;
- hidratacion, rendimiento, accesibilidad y experiencia de usuario;
- estado de tooling, lint, build y pruebas.

La auditoria se hizo con revision local y subagentes especializados en UX/accesibilidad y datos/mantenibilidad. Tambien se contrastaron hallazgos con `npm audit`, `npm run lint` y `npm run build`.

## Estado actual

Fortalezas detectadas:

- La aplicacion esta bien separada por modulos (`auth`, `finanzas`, `entrenamientos`, `compras`, `nutricion`, `usuario`).
- Existe un cliente Axios centralizado en `lib/api.ts`.
- Las claves de React Query estan centralizadas en `lib/query-keys.ts`.
- Hay schemas Zod para formularios y tipos TypeScript por dominio.
- Hay loading states por rutas y componentes skeleton en varios modulos.
- `npm audit` queda en 0 vulnerabilidades despues del override de `postcss`.
- `npm run build` pasa correctamente con Next.js 16.2.4.

Cambios ya aplicados durante esta sesion:

- Se corrigieron vulnerabilidades npm con actualizacion de lockfile y override de `postcss`.
- Se fijo `turbopack.root` en `next.config.ts` para eliminar el warning por lockfile en carpeta padre.
- Se corrigio el hydration mismatch inicial de `app/providers.tsx` evitando que `localStorage` cambie el arbol del primer render.

## Hallazgos prioritarios

### 1. Sesion y auth dependen demasiado de `localStorage`

Archivos:

- `lib/auth-session.ts`
- `lib/api.ts`
- `modules/auth/hooks/useAuth.tsx`
- `modules/auth/hooks/useProfile.ts`
- `components/auth/auth-guard.tsx`

Riesgo:

El token se lee desde `localStorage` en varios puntos: interceptor Axios, hook de auth, hook de perfil y guards. Funciona, pero puede producir estados intermedios raros en login/logout, renders distintos entre servidor y cliente, y mayor exposicion ante XSS por usar storage accesible desde JavaScript.

Recomendacion:

- Centralizar la sesion en un unico store/hook.
- Hacer que `useProfile` dependa del estado central, no de lecturas ad hoc.
- Evaluar migrar a cookie `HttpOnly` si el backend lo permite.
- Mantener `localStorage` solo como solucion transitoria y documentar el riesgo.

Prioridad: Alta.

### 2. Persistencia de React Query puede guardar datos sensibles

Archivos:

- `app/providers.tsx`
- `modules/finanzas/hooks/useFinanzas.tsx`
- `modules/compras/hooks/useCompras.tsx`
- `modules/entrenamientos/hooks/useEntrenamientos.tsx`
- `modules/nutricion/hooks/useNutricion.tsx`

Riesgo:

La persistencia usa `localStorage` y actualmente persiste queries marcadas con `meta.persist === true`. Aunque no todas son sensibles, algunas pueden contener datos personales o de catalogos privados. Si la sesion se comparte en el navegador o hay XSS, esos datos quedan disponibles.

Recomendacion:

- Revisar cada query con `persistMeta` y clasificarla como publica, semi-publica o privada.
- Persistir solo catalogos realmente no sensibles.
- Incluir versionado por usuario en `QUERY_CACHE_STORAGE_KEY` o limpiar cache al cambiar de usuario.
- Considerar `sessionStorage` o no persistir datos de finanzas/nutricion.

Prioridad: Alta.

### 3. Pantallas admin usan estado local en vez de React Query

Archivos:

- `modules/catalogo/components/productos-manager.tsx`
- `modules/compras/components/cadenas-manager.tsx`
- `modules/nutricion/components/tablas-admin-manager.tsx`

Riesgo:

Estas pantallas llaman APIs directamente con `useEffect/useState`. Eso duplica cache fuera de React Query y no invalida las vistas que si dependen de query cache. Por ejemplo, editar tablas nutricionales o productos desde admin puede dejar vistas de usuario con datos antiguos.

Recomendacion:

- Crear hooks React Query para catalogo, tablas nutricionales y maestros de compras.
- Agregar query keys de raiz para esos recursos.
- Invalidar queries relacionadas despues de crear, editar o borrar.

Prioridad: Alta.

### 4. Invalidaciones incompletas en finanzas

Archivo:

- `modules/finanzas/hooks/useFinanzas.tsx`

Riesgo:

Mutaciones de categorias invalidan solo `categorias`; cuentas invalidan solo `cuentas`; bancos invalidan `bancos/productos`. Pero movimientos y analitica pueden mostrar nombres o datos denormalizados asociados. Despues de editar categorias, cuentas o bancos, listados/KPIs podrian quedar con informacion antigua.

Recomendacion:

- Al cambiar categorias, invalidar `categorias`, `movimientos` y `analitica`.
- Al cambiar cuentas, bancos o productos financieros, invalidar `cuentas`, `movimientos`, `analitica` y productos relacionados.
- Donde sea posible, actualizar cache con `setQueryData` para mejorar la respuesta visual.

Prioridad: Alta.

### 5. Respuestas del backend no se validan en runtime

Archivos:

- `modules/finanzas/api/finanzas.api.ts`
- `modules/nutricion/api/nutricion.api.ts`
- `modules/compras/api/compras.api.ts`
- `modules/entrenamientos/api/entrenamientos.api.ts`

Riesgo:

Los `Promise<T>` de Axios asumen que el backend respeta el contrato. Si cambia una propiedad, devuelve `null` o altera el shape, el error aparece tarde en render. En entrenamientos hay normalizadores, pero algunos devuelven `[]` silenciosamente ante payload inesperado, ocultando contratos rotos.

Recomendacion:

- Validar responses criticas con Zod o adaptadores por modulo.
- Diferenciar respuesta vacia valida de shape invalido.
- En desarrollo, lanzar error claro si el contrato no coincide.

Prioridad: Alta.

### 6. Accesibilidad incompleta en formularios

Archivos:

- `components/auth/login-view.tsx`
- `components/auth/register-view.tsx`
- `components/forms/editorial-form.tsx`
- formularios de managers en `modules/**/components`

Riesgo:

Varios labels son texto visual sin `htmlFor/id`. Los errores se muestran principalmente por toast, no asociados al campo. Lectores de pantalla y usuarios de teclado reciben menos contexto para corregir entradas.

Recomendacion:

- Agregar `id/htmlFor`, `aria-invalid` y `aria-describedby`.
- Mostrar mensajes inline por campo.
- Dejar toast como resumen global, no como unico canal de error.

Prioridad: Alta.

### 7. Combobox custom necesita patron ARIA correcto

Archivo:

- `components/forms/searchable-combobox.tsx`

Riesgo:

El trigger declara `aria-haspopup="listbox"`, pero el panel usa `role="dialog"`. Tambien hay un control con `role="button"` dentro de un `<button>`, lo que genera interaccion invalida. Esto puede romper navegacion por teclado y lectores de pantalla.

Recomendacion:

- Implementar patron combobox/listbox completo: `role="combobox"`, `aria-controls`, `aria-expanded`, `aria-activedescendant`, opciones con `role="option"`.
- Separar el boton de limpiar del trigger principal.
- Evaluar reemplazo por Radix/React Aria si se quiere reducir riesgo.

Prioridad: Alta.

### 8. Navegacion y drawer mobile con deuda de accesibilidad

Archivos:

- `components/shell/sidebar-nav.tsx`
- `components/shell/mobile-bottom-nav.tsx`
- `components/shell/app-shell.tsx`

Riesgo:

La navegacion activa se marca visualmente, pero no expone `aria-current="page"`. El drawer mobile usa overlay, pero no se observa focus trap, cierre con Escape ni restauracion de foco al boton.

Recomendacion:

- Agregar `aria-current` en links activos.
- Agregar labels especificos a landmarks de navegacion.
- Convertir el drawer mobile a `Dialog/Sheet` accesible o implementar focus trap, Escape y restore focus.

Prioridad: Media-Alta.

### 9. Providers por modulo precargan demasiados datos

Archivos:

- `modules/finanzas/hooks/useFinanzas.tsx`
- `modules/nutricion/hooks/useNutricion.tsx`
- `modules/entrenamientos/hooks/useEntrenamientos.tsx`

Riesgo:

Entrar a un modulo dispara varias queries aunque la vista actual no use todos esos datos. Esto aumenta latencia, ruido de errores y acoplamiento entre pantallas.

Recomendacion:

- Separar hooks por recurso: `useCuentas`, `useMovimientos`, `useMetas`, `useEjercicios`, etc.
- Usar `enabled` segun ruta o necesidad real.
- Dejar providers solo para estado compartido o acciones transversales.

Prioridad: Media.

### 10. Warnings de hooks en entrenamiento activo

Archivo:

- `modules/entrenamientos/components/entrenamiento-activo-card.tsx`

Riesgo:

ESLint reporta un `eslint-disable` innecesario y dependencias faltantes en un `useEffect` que precarga peso/repeticiones. Si `ejercicios` o `entrenamientoActivo.series` llegan despues de seleccionar ejercicio, el formulario puede autocompletar con datos antiguos o no autocompletar.

Recomendacion:

- Eliminar el `eslint-disable` innecesario.
- Incluir dependencias reales o mover el prefill al handler de seleccion de ejercicio.
- Usar guards explicitos para evitar loops de `setForm`.

Prioridad: Media.

### 11. Conversion numerica con `|| null`

Archivo:

- `modules/nutricion/components/tablas-admin-manager.tsx`

Riesgo:

Expresiones como `Number(valor) || null` convierten `0` en `null`. Si `0` es valido para ciertos nutrientes, se pierde informacion; si no es valido, el error queda delegado al backend.

Recomendacion:

- Crear helper explicito: string vacio -> `null`, numero finito -> numero, invalido -> error de formulario.
- Validar con Zod antes de enviar.

Prioridad: Media.

### 12. Falta estrategia de tests

Archivo:

- `package.json`

Riesgo:

No hay script de tests ni archivos `*.test.*`, `*.spec.*` o `__tests__`. Las zonas con mayor riesgo son auth/guards, invalidaciones de React Query, adaptadores API, formularios numericos y flujo de entrenamiento activo.

Recomendacion:

- Agregar Vitest + Testing Library.
- Empezar por tests unitarios de normalizadores/payload builders.
- Agregar tests de hooks con `QueryClient` aislado.
- Agregar pruebas de accesibilidad basicas para formularios y combobox.

Prioridad: Media.

## Plan de accion

### Fase 1: estabilizacion inmediata

1. Corregir warnings de `npm run lint` en `entrenamiento-activo-card.tsx`.
2. Agregar `aria-current` a navegacion desktop/mobile.
3. Revisar queries persistidas y retirar persistencia de datos privados o dudosos.
4. Centralizar helper de parseo numerico para formularios.
5. Actualizar README con comandos reales, version actual de Next y notas de entorno.

### Fase 2: datos y cache

1. Migrar managers admin a React Query.
2. Completar invalidaciones cruzadas en finanzas, nutricion, compras y catalogo.
3. Definir `queryKeys` root por cada recurso editable.
4. Agregar validacion runtime para responses criticas del backend.
5. Evitar normalizaciones silenciosas que oculten contratos rotos.

### Fase 3: auth y seguridad

1. Crear un store/hook unico de sesion.
2. Hacer que guards, interceptor y perfil lean desde esa fuente central.
3. Evaluar cookie `HttpOnly` para tokens.
4. Revisar `NEXT_PUBLIC_API_URL` por ambiente y documentar configuracion esperada.
5. Agregar politica clara de limpieza de cache en logout/cambio de usuario.

### Fase 4: accesibilidad y UX

1. Asociar labels con controles en formularios.
2. Agregar errores inline con `aria-describedby`.
3. Rehacer `SearchableCombobox` con patron ARIA correcto o reemplazarlo por una primitiva accesible.
4. Convertir drawer mobile a Dialog/Sheet accesible.
5. Revisar flujos con teclado: login, registro, admin managers, entrenamiento activo.

### Fase 5: pruebas y CI local

1. Instalar Vitest + Testing Library.
2. Agregar scripts `test`, `test:watch` y opcionalmente `typecheck`.
3. Cubrir primero:
   - `auth-session`;
   - builders de payload numerico;
   - invalidaciones de hooks criticos;
   - normalizadores/adaptadores API;
   - guards de auth/admin.
4. Dejar una checklist de PR: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm audit`.

## Verificacion ejecutada

- `npm audit`: 0 vulnerabilidades.
- `npm run build`: OK.
- `npm run lint`: ejecuta, pero deja 2 warnings en `modules/entrenamientos/components/entrenamiento-activo-card.tsx`.

## Resumen ejecutivo

El proyecto esta en buen estado para una app en crecimiento: modular, tipado y con una estrategia clara de datos. La deuda mas importante no esta en compilacion sino en consistencia: sesion repartida, cache/invalidation incompleta, pantallas admin fuera de React Query, accesibilidad de formularios/combobox y ausencia de tests. El plan recomendado es estabilizar lint y persistencia primero, luego ordenar cache/datos, y despues robustecer auth, accesibilidad y pruebas.
