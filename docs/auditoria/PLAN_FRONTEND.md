# Plan de accion del frontend

Actualizado: 2026-08-02.

Este backlog convierte los hallazgos de `FRONTEND.md` en unidades implementables. Los IDs
son estables: no renumerar tareas completadas; agregar nuevas tarjetas al final de la fase
correspondiente.

## Regla de priorizacion

- P0: riesgo de seguridad, perdida/duplicacion de datos o flujo bloqueante.
- P1: confiabilidad estructural necesaria antes de ampliar funcionalidades.
- P2: mantenibilidad, consistencia visual y deuda no bloqueante.

## Fase 0 — Seguridad inmediata

### REPO-SEC-001 — Rotar y retirar credenciales documentadas

- Estado: `[!]` requiere intervencion del usuario/operador.
- Prioridad: P0.
- Alcance: repositorio y entorno de produccion; no es una tarea solo frontend.
- Evidencia: `docs/PROGRESO.md` contiene credenciales en texto plano y documenta una
  exposicion previa.

Acciones:

1. Inventariar que servicios usan la credencial sin copiar su valor a tickets o chats.
2. Rotarla en el sistema propietario y actualizar los secretos de runtime.
3. Verificar backend y deploy.
4. Sustituir valores reales en documentacion por placeholders.
5. Evaluar limpieza de historial Git si el repositorio fue compartido.

Criterios de aceptacion:

- La credencial anterior deja de ser valida.
- Ningun archivo versionado contiene el nuevo secreto.
- Desarrollo y produccion arrancan desde variables seguras.
- Se registra fecha y responsable, nunca el valor.

No hacer:

- No automatizar una rotacion productiva sin autorizacion.
- No incluir el secreto en commits, logs ni evidencia de pruebas.

### FE-SEC-001 — Actualizar dependencias vulnerables

- Estado: `[x]`.
- Prioridad: P0.
- Archivos: `frontend/package.json`, `frontend/package-lock.json`.
- Dependencias relacionadas: Axios, FormData, Next.js, PostCSS y Sharp.

Acciones:

1. Ejecutar `npm audit --omit=dev` y guardar solo el resumen sin datos del entorno.
2. Revisar versiones corregidas y compatibilidad, especialmente el override de PostCSS.
3. Actualizar en grupos pequenos; alinear `next` y `eslint-config-next`.
4. Revisar el diff completo del lockfile.

Criterios de aceptacion:

- `npm audit --omit=dev` no reporta vulnerabilidades altas con fix disponible, o cada
  excepcion queda documentada con mitigacion y fecha de revision.
- Lint, typecheck, tests y build pasan.
- La app inicia y el service worker se sirve con headers correctos.

Verificacion:

```bash
cd frontend
npm audit --omit=dev
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Resultado (2026-08-02, claude):
- Archivos: `frontend/package.json`, `frontend/package-lock.json`.
- Decisiones:
  - `axios` `^1.13.2` -> `^1.19.0`, `next`/`eslint-config-next` `^16.2.1` -> `^16.2.12`.
  - Override de `postcss` `8.5.12` (vulnerable) -> `8.5.25`.
  - Se agrego override `sharp: 0.35.3`: es optionalDependency de `next` y no subia solo
    con `npm install`, quedaba fijo en `0.34.5` (vulnerable).
  - No se aplico `npm audit fix --force` para las 3 vulnerabilidades restantes
    (`@babel/core`, `brace-expansion`, `js-yaml`, transitivas de `eslint`/`eslint-config-next`,
    solo devDependencies): forzar el fix arrastraba bumps mayores no controlados de
    `typescript-eslint`. Sin exposicion en produccion. Revisar de nuevo si el proximo
    bump de `eslint-config-next` las resuelve.
- Pruebas: `npm audit --omit=dev` (0 vulnerabilidades), `npm run lint`, `npx tsc --noEmit`,
  `npm test` (3 archivos, 12/12), `npm run build` (42 rutas), `node --check public/sw.js`.
- Pendientes o riesgos residuales: 3 vulnerabilidades altas/bajas en devDependencies de
  lint (ver decision arriba). No se corrio `npm ci` limpio en un entorno separado.

## Fase 1 — Offline sin bloqueos ni duplicados

### FE-OFF-001 — Politica fail-fast para mutaciones solo-online

- Estado: `[x]`.
- Prioridad: P0.
- Archivos iniciales: `frontend/app/providers.tsx`,
  `frontend/modules/auth/hooks/useAuth.tsx`, hooks de cada dominio y
  `frontend/lib/error-messages.ts`.
- Independiente de: cambios de service worker.

Objetivo:

Una operacion no encolable debe responder inmediatamente si no hay red, en vez de quedar
`isPending/isPaused` hasta reconectar.

Acciones:

1. Definir un helper/politica comun que distinga `online-only` de `queueable`.
2. En alta de usuario, mostrar que crear cuenta requiere conexion.
3. Aplicar el mismo comportamiento a editar/borrar y CRUD no encolables.
4. Cubrir tambien "backend inaccesible" cuando `navigator.onLine` es `true`; un preflight
   del navegador no reemplaza el manejo de timeout/red de Axios.
5. No almacenar passwords ni payloads de registro en el persister.

Criterios de aceptacion:

- Un submit offline solo-online finaliza en menos de un segundo con mensaje comprensible.
- El boton vuelve a estar habilitado.
- No se crea una mutation persistida ni se guarda PII adicional.
- El mismo error no provoca redirect de auth indebido.

Pruebas minimas:

- Hook/test de alta usuario offline.
- Una mutation CRUD representativa offline.
- Axios timeout/backend caido con navegador online.

Resultado (2026-08-02, claude):
- Archivos: `frontend/lib/online-only.ts` (nuevo), `frontend/tests/online-only.test.ts`
  (nuevo), `frontend/modules/auth/hooks/useAuth.tsx`,
  `frontend/modules/finanzas/hooks/useFinanzas.tsx`,
  `frontend/modules/entrenamientos/hooks/useEntrenamientos.tsx`,
  `frontend/modules/compras/hooks/useCompras.tsx`,
  `frontend/modules/nutricion/hooks/useNutricion.tsx`.
- Decisiones:
  - Helper comun `runOnlineOnlyAction` (usa `onlineManager.isOnline()`): si no hay red,
    no llama la mutation y devuelve `{ ok: false, message }` al instante; si hay red,
    deja que Axios falle solo (timeout/backend caido no se intercepta).
  - Reemplazo el `runAction` local (sin gate) por este helper en todas las mutaciones sin
    cola offline: bancos/categorias/cuentas/editar-movimiento en finanzas; compras
    completo; nutricion completo (consumos, detalle, metas, pesos); gimnasios, iniciar
    entreno, editar/borrar serie en entrenamientos.
  - `useAuth.tsx`: login, register y logout chequean `isAppOffline()` antes de disparar
    la mutation. Logout offline limpia sesion/cache local igual que el catch existente,
    sin esperar la revocacion server-side (inalcanzable sin red).
  - No toque `cerrarEntrenoFuerzaActivo` ni `agregarSerieFuerza` (useEntrenamientos.tsx):
    esas dos usan mutations con defaults registrados para reconstruirse offline y deben
    terminar encolando (`mutate()` sin await), no fallando rapido; ese arreglo especifico
    es FE-OFF-002, que ademas comparte archivo. Quedo un comentario en el codigo
    explicando por que siguen con el `runAction` viejo.
  - No toque los managers admin (`productos-manager.tsx`, `cadenas-manager.tsx`,
    `tablas-admin-manager.tsx`) ni `ejercicios-catalogo.tsx`: llaman `mutateAsync`
    directo sin pasar por un hook de dominio y no estaban en el alcance inicial de la
    tarjeta. Mismo bug potencial, pendiente para una tarjeta aparte si se decide cubrir
    admin offline.
  - `usePerfil.tsx`/`useUsuarios.tsx` no usan TanStack mutations (Axios + `useState`
    directo), asi que no tienen el problema de `networkMode: "online"`; no se tocaron.
- Pruebas: `frontend/tests/online-only.test.ts` (4 casos: alta de usuario offline, CRUD
  representativo offline, timeout con navegador online no bloqueado, caso online
  exitoso). `npm run lint`, `npx tsc --noEmit`, `npm test` (4 archivos, 16/16),
  `npm run build` (42 rutas).
- Pendientes o riesgos residuales: managers admin y `ejercicios-catalogo.tsx` sin cubrir
  (ver arriba). No hay test de hook renderizado (React Testing Library no esta instalado
  todavia, ver Fase 5.1); la cobertura quedo a nivel del helper compartido.

### FE-OFF-002 — Desbloquear la cola ya existente de series y cierre

- Estado: `[ ]`.
- Prioridad: P0.
- Archivos: `frontend/modules/entrenamientos/hooks/useEntrenamientos.tsx`,
  `frontend/modules/entrenamientos/components/entrenamiento-activo-card.tsx`,
  `frontend/modules/entrenamientos/components/activo/registro-serie.tsx`,
  `frontend/modules/entrenamientos/offline/entrenamientos-offline.ts` y tests.
- Patron de referencia: `frontend/modules/finanzas/hooks/useFinanzas.tsx`.

Objetivo:

Cuando TanStack pause una serie/cierre, la UI debe confirmar que se guardo en cola sin
esperar `mutateAsync`.

Acciones:

1. Introducir un resultado comun, por ejemplo `{ ok, queued?, message? }`.
2. Si `onlineManager` esta offline, llamar `mutate()` y retornar `queued` sin await.
3. Calcular submitting como `isPending && !isPaused` para no bloquear toda la sesion.
4. Mantener indicadores visibles de `pendiente`, `sincronizando` y `fallo`.
5. Asegurar que cerrar un entreno despues de series encoladas conserve el orden del scope.

Criterios de aceptacion:

- Agregar tres series offline no bloquea el formulario entre series.
- Cada serie aparece inmediatamente como pendiente.
- Cerrar el entrenamiento se encola detras de las series.
- Al reconectar se respeta el orden.
- Un rechazo elimina/marca solo la operacion rechazada.

Pruebas minimas:

- Extender `frontend/tests/entrenamientos-offline.test.ts`.
- Agregar una prueba del wrapper/hook que verifique que el resultado `queued` resuelve sin
  reconectar.

### FE-OFF-003 — Idempotencia de entrenamiento end-to-end

- Estado: `[ ]`.
- Prioridad: P0.
- Alcance: frontend y backend.
- Archivos iniciales: tipos/schemas/API/offline de entrenamiento en frontend; schemas,
  modelos, migracion y rutas de fuerza/series en backend.
- Dependencia: decision de contrato backend.

Objetivo:

Reintentar una operacion despues de que el servidor guardo pero se perdio la respuesta no
debe duplicar series ni abrir dos entrenamientos.

Acciones:

1. Diseñar `client_request_id` UUID para apertura, serie y cierre, o una clave equivalente.
2. Crear restricciones unicas con el scope correcto de usuario/operacion.
3. Hacer que el backend retorne el registro existente al repetir la misma clave.
4. Generar la clave una sola vez en cliente y persistirla con la mutation.
5. Definir que ocurre al repetir cierre y al encontrar un entrenamiento ya activo.

Criterios de aceptacion:

- Dos requests con la misma clave producen una sola escritura.
- Una respuesta perdida y un reintento restauran el objeto confirmado.
- Keys diferentes conservan el orden y crean operaciones distintas.
- Las migraciones tienen upgrade/downgrade y tests backend.

No hacer:

- No confiar solo en IDs temporales negativos del frontend.
- No ampliar la outbox de entrenamiento antes de que el servidor sea idempotente.

### FE-OFF-004 — Permitir iniciar/registrar entrenamiento offline

- Estado: `[ ]`.
- Prioridad: P0 por requerimiento de producto.
- Depende de: `FE-OFF-003` y `FE-OFF-002`.
- Archivos: formulario/hook/offline de entrenamientos, cache del entreno activo y tests.

Objetivo:

La ruta `/app/entrenamientos/registrar` debe poder crear un entreno local, navegar al
entreno activo y encadenar series antes de recuperar conexion.

Acciones:

1. Agregar mutation key/defaults restaurables para apertura.
2. Construir un entreno activo optimista con ID/clave temporal y gimnasio cacheado.
3. Compartir el mismo scope serial con apertura, series y cierre.
4. Persistir el entreno optimista antes de navegar.
5. Reconciliar IDs y errores al sincronizar.
6. Definir UX si el servidor informa que ya habia otro entreno activo.

Criterios de aceptacion:

- Desde una sesion previamente autenticada, registrar entrenamiento offline navega al activo
  sin spinner indefinido.
- Se pueden agregar series y cerrar sin conexion.
- Tras matar/reabrir la PWA, el estado local sobrevive.
- Al reconectar, backend contiene exactamente un entreno y las series en orden.
- Conflictos no eliminan datos locales sin una accion explicita.

### FE-OFF-005 — Durabilidad y ownership de la outbox

- Estado: `[ ]`.
- Prioridad: P1.
- Depende de: `FE-OFF-002` y contrato de identidad definido.

Acciones:

1. Persistir solo mutations pausadas.
2. Evaluar escritura inmediata/outbox IndexedDB dedicada para operaciones criticas en vez de
   depender de un throttle de un segundo.
3. Asociar cache/outbox a una identidad estable.
4. Impedir que logout/cambio de usuario sincronice operaciones del usuario anterior.
5. Definir retencion, descarte, reintentos y UI de errores permanentes.

Criterios de aceptacion:

- Cerrar la PWA inmediatamente despues del submit no pierde la operacion.
- Cambio de cuenta no mezcla cache ni outbox.
- Una mutation exitosa no permanece serializada innecesariamente.
- El usuario puede ver y resolver fallos permanentes.

## Fase 2 — Shell PWA comprobable

### FE-PWA-001 — Precache generado y lifecycle seguro

- Estado: `[ ]`.
- Prioridad: P0/P1.
- Archivos: `frontend/public/sw.js`, configuracion Next y dependencias PWA.
- Decision tecnica: evaluar Serwist/Workbox frente a manifiesto propio generado en build.

Acciones:

1. Elegir una estrategia compatible con Next 16/App Router.
2. Precachear el asset graph versionado de JS/CSS y el shell minimo.
3. Definir rutas offline disponibles sin haberlas visitado.
4. Evitar eliminar el cache anterior antes de garantizar la version nueva.
5. Documentar actualizacion, rollback y comportamiento multi-tab.
6. Mantener API/auth/POST fuera del cache HTTP.

Criterios de aceptacion:

- Instalar online y hacer el primer hard reload offline carga la aplicacion.
- Los chunks requeridos existen en Cache Storage.
- Actualizar una version no deja HTML apuntando a chunks eliminados.
- `/offline` funciona sin depender de un RSC ausente.

### FE-PWA-002 — Suite Playwright offline de produccion

- Estado: `[ ]`.
- Prioridad: P0/P1.
- Depende de: `FE-PWA-001`, `FE-OFF-002`; escenarios completos dependen de `FE-OFF-004`.

Escenarios obligatorios sobre `next build && next start`:

1. Instalar/visitar online y pasar offline.
2. Hard reload de ruta visitada y no visitada.
3. Registrar tres series y cerrar entrenamiento offline.
4. Registrar movimiento financiero offline.
5. Cerrar antes de un segundo y reabrir.
6. Reconectar y verificar orden/exactly-once.
7. Alta de usuario offline falla rapido sin persistir password.
8. Logout/cambio de cuenta no sincroniza cola anterior.
9. Backend inaccesible con `navigator.onLine === true`.

Criterios de aceptacion:

- Suite reproducible localmente y preparada para CI.
- Evidencia verifica backend, UI, IndexedDB y Cache Storage; no solo toasts.
- No depende de `next dev`.

## Fase 3 — Estabilizacion de TanStack Query

### FE-TQ-001 — Alinear dependencias y ownership

- Estado: `[ ]`.
- Prioridad: P1.
- Archivos: `frontend/package.json`, lockfile y tests.

Acciones:

1. Alinear React Query, devtools, persist provider y async persister a la misma version.
2. Eliminar sync persister si sigue sin uso.
3. Declarar directamente cualquier paquete importado por tests o importar desde la API
   publica documentada.
4. Confirmar con `npm ls` que hay una sola version de `query-core`.

Criterios de aceptacion:

- Una sola linea de versiones TanStack compatible.
- `npm ls @tanstack/query-core` no muestra duplicados por el frontend.
- Tests de restauracion pasan.

### FE-TQ-002 — Centralizar queryOptions y mutationOptions

- Estado: `[ ]`.
- Prioridad: P1.
- Archivos: hooks/components que definen la misma key con opciones diferentes.

Acciones:

1. Crear factories `queryOptions()` por recurso en cada modulo.
2. Colocar key, queryFn, staleTime, gcTime, meta y normalizacion en un solo lugar.
3. Reutilizarlas desde providers, hooks, fetches imperativos y managers admin.
4. Hacer equivalente para mutations repetidas.

Criterios de aceptacion:

- Una query key no cambia de politica de persistencia segun el ultimo consumidor.
- No se duplican literales de tiempos ni keys en componentes.
- Invalidaciones usan roots/factories documentadas.

### FE-TQ-003 — Provider de persistencia estable

- Estado: `[ ]`.
- Prioridad: P1.
- Archivo principal: `frontend/app/providers.tsx`.

Objetivo:

Evitar montar el arbol con un provider no persistente y reemplazarlo despues de hidratar.

Criterios de aceptacion:

- El subtree de aplicacion no se remonta durante la activacion del persister.
- Las queries no hacen fetch antes de completar restauracion cuando existe cache aplicable.
- SSR/hidratacion no accede a IndexedDB.
- No hay flash de auth ni solicitud duplicada de perfil.

Pruebas:

- Test de montaje/restauracion.
- Verificacion de una sola llamada de perfil con cache vigente.

### FE-TQ-004 — Migrar usuario/perfil legacy a Query

- Estado: `[ ]`.
- Prioridad: P2.
- Archivos: `frontend/modules/usuario/hooks/useUsuarios.tsx`, `usePerfil.tsx` y consumidores.
- Depende de: `FE-TQ-002` y consolidacion de tipo de perfil en `FE-ZOD-002`.

Criterios de aceptacion:

- Perfil tiene una unica query y modelo.
- Listado/edicion invalidan keys consistentes.
- Se eliminan fetches manuales redundantes con `useEffect`.

## Fase 4 — Contratos Zod confiables

### FE-ZOD-001 — Patron comun para adapters validados

- Estado: `[ ]`.
- Prioridad: P1.
- Ubicacion sugerida: capa compartida de validacion y schemas por modulo.

Acciones:

1. Definir convencion `requestSchema`, `responseSchema` y schemas de pagina/lista.
2. Parsear `response.data` dentro del adapter API.
3. Convertir `ZodError` a un error tecnico observable sin exponer payload sensible.
4. Derivar tipos con `z.infer`.
5. Definir estrategia ante cache antiguo incompatible y cuando subir el buster.

Criterios de aceptacion:

- Existe un adapter representativo con respuesta valida e invalida testeada.
- Datos invalidos no llegan al cache.
- El error informa endpoint/campos sin loguear credenciales o PII completa.
- La convencion queda documentada para los siguientes dominios.

### FE-ZOD-002 — Contratos criticos de auth, perfil, finanzas y entrenamiento

- Estado: `[ ]`.
- Prioridad: P1.
- Depende de: `FE-ZOD-001`.

Orden sugerido:

1. Perfil/auth, porque controla el guard offline.
2. Entreno activo, series y respuestas de apertura/cierre.
3. Movimientos paginados y cuentas.
4. Catalogos usados para optimismo offline.

Criterios de aceptacion:

- Todas las respuestas persistidas por esos dominios se parsean.
- Requests y tipos duplicados se derivan del schema correspondiente.
- Enums dejan de tener dos fuentes de verdad.
- Tests cubren nullables, fechas, enums y payload corrupto.

### FE-ZOD-003 — Corregir deriva compras/nutricion y formularios restantes

- Estado: `[ ]`.
- Prioridad: P1/P2.
- Depende de: `FE-ZOD-001`.

Acciones:

1. Alinear `LocalResponse.id_cadena` nullable.
2. Alinear metas nutricionales y proteger `formatDate`.
3. Agregar schemas de cadenas, locales, tablas y catalogo.
4. Reemplazar `Number(...)` inseguro por helpers/schemas de coercion.
5. Validar rangos geograficos, fechas reales, orden de fechas, telefono y unidades.

Criterios de aceptacion:

- Contract tests reflejan los schemas FastAPI actuales.
- `NaN` no se serializa silenciosamente como `null`.
- Ningun formatter recibe null sin manejarlo.

### FE-ZOD-004 — Evaluar generacion desde OpenAPI

- Estado: `[ ]`.
- Prioridad: P2.
- Depende de: experiencia obtenida en `FE-ZOD-001/002`.

Entregable:

Un ADR corto comparando generacion TypeScript/Zod desde OpenAPI frente a schemas manuales,
incluyendo CI, personalizaciones, enums, nullables y costo de migracion. No introducir un
generador sin decidir ownership del contrato.

## Fase 5 — Arquitectura y orientacion de agentes

### FE-ARCH-001 — Formalizar capas y limites de modulo

- Estado: `[ ]`.
- Prioridad: P1/P2.

Acciones:

1. Decidir si `lib` permanece o evoluciona a `shared`.
2. Definir dependencias permitidas entre `app`, `modules`, `components` y capa compartida.
3. Elegir public APIs por modulo o una politica de deep imports; eliminar el estado mixto.
4. Agregar reglas ESLint de imports/boundaries gradualmente.
5. Resolver cruces auth/notifications y nutricion/catalogo mediante casos de uso publicos.

Criterios de aceptacion:

- Diagrama y reglas escritas coinciden con imports reales.
- ESLint detecta al menos una violacion de prueba.
- No se hace un movimiento masivo de carpetas sin beneficio funcional.

### FE-ARCH-002 — Dividir componentes y hooks agregadores

- Estado: `[ ]`.
- Prioridad: P2.
- Candidatos: entrenamiento activo, searchable combobox, movimiento form, historico de
  fuerza, catalogo de ejercicios, series de sesion, `useFinanzas`, `useEntrenamientos`.

Estrategia:

- Extraer primero query/mutation options y adaptadores de formulario.
- Separar componentes por responsabilidad observable, no por cantidad arbitraria de lineas.
- Evitar Context de dominio completo cuando hooks especificos resuelven el caso.

Criterios de aceptacion:

- Comportamiento y accesibilidad se conservan.
- No aumentan renders/fetches.
- Cada unidad extraida tiene una API pequena y pruebas proporcionales.

### FE-DOC-001 — Crear AGENTS.md canonicos

- Estado: `[ ]`.
- Prioridad: P1.
- Archivos a crear: `AGENTS.md`, `frontend/AGENTS.md`.

Contenido raiz:

- mapa monorepo;
- comandos por workspace;
- limites de acceso a produccion;
- manejo de secretos;
- enlaces a esta auditoria.

Contenido frontend:

- stack tomado de `package.json`/lockfile;
- mapa de capas;
- politica Query/offline;
- politica Zod;
- Tailwind 4 CSS-first;
- comandos y Definition of Done.

Criterios de aceptacion:

- Un agente nuevo encuentra stack, rutas y comandos sin leer documentos historicos.
- `CLAUDE.md` enlaza a AGENTS o se reduce para no duplicar reglas.
- No se incluyen secretos ni hosts privados innecesarios.

### FE-DOC-002 — Sanear documentos historicos

- Estado: `[ ]`.
- Prioridad: P1/P2.
- Archivos: `frontend/README.md`, `frontend/CLAUDE.md`, `frontend/docs/*`.

Acciones:

1. Corregir Next 15/16, tests y IndexedDB/localStorage.
2. Documentar todos los modulos y el alcance real de React Hook Form.
3. Convertir `CACHING_STRATEGY.md` en historico o actualizar su estado.
4. Sincronizar `DESIGN.md` con tokens reales.
5. Mantener links hacia la fuente canonica en `docs/auditoria`.

Criterios de aceptacion:

- Una busqueda de afirmaciones antiguas no encuentra contradicciones conocidas.
- Cada documento incluye estado/fecha/owner o se marca como historico.

### FE-DOC-003 — Scripts y CI de validacion

- Estado: `[ ]`.
- Prioridad: P1.

Acciones:

1. Agregar `typecheck` y `validate` en `frontend/package.json`.
2. Ejecutar lint, typecheck y tests en CI; build segun costo/branch.
3. Incorporar Playwright cuando `FE-PWA-002` este listo.
4. Bloquear merge si falla una verificacion obligatoria.

Criterios de aceptacion:

- Los comandos documentados existen realmente.
- CI usa instalacion reproducible (`npm ci`).
- El resultado queda visible sin requerir acceso a produccion.

## Fase 6 — Sistema visual y accesibilidad

### FE-UI-001 — Normalizar consumo de tokens Tailwind

- Estado: `[ ]`.
- Prioridad: P2.
- Fuente de verdad: `frontend/app/globals.css`.

Acciones:

1. Definir tabla rol -> variable -> utilidad Tailwind -> combinaciones permitidas.
2. Sustituir gradualmente valores equivalentes:
   `bg-[color:var(--surface-low)]` por `bg-surface-low`, radios arbitrarios por tokens y
   sombras crudas por `shadow-airy*`.
3. Crear recipes/CVA para Surface, Field, FieldLabel, IconButton y ModuleAccent.
4. No cambiar toda la UI en un solo PR.

Criterios de aceptacion:

- Nuevos componentes no necesitan valores arbitrarios para tokens existentes.
- Cada lote tiene capturas/regresion visual de las pantallas tocadas.

### FE-UI-002 — Decidir e implementar politica de color scheme

- Estado: `[!]` requiere decision de producto.
- Prioridad: P1/P2.

Opcion A, solo claro:

- quitar anuncio de dark mode y usar `colorScheme: "light"`.

Opcion B, dark real:

- agregar activacion/provider;
- completar `--module-*` y foregrounds;
- reemplazar blancos crudos;
- adaptar manifest/theme color;
- probar contraste y persistencia de preferencia.

Criterios de aceptacion:

- La configuracion no promete un esquema que no puede activar.
- Combinaciones principales alcanzan contraste apropiado.
- No hay flash de tema en hidratacion.

### FE-UI-003 — Navegacion, tactil, motion y combobox

- Estado: `[ ]`.
- Prioridad: P1/P2.

Acciones:

1. No mostrar indicador de Dashboard cuando `activeIndex === -1`.
2. Cubrir prefijos reales de grupos admin o ofrecer una ruta "Mas".
3. Crear hit areas de al menos 44x44 para acciones tactiles.
4. Agregar `motion-reduce`/`prefers-reduced-motion`.
5. Rehacer combobox con patron combobox/listbox valido y sin controles interactivos
   anidados.
6. Elevar labels criticos por encima de 9-11 px cuando la jerarquia lo permita.

Criterios de aceptacion:

- Navegacion anuncia correctamente la ruta activa.
- Flujo completo funciona con teclado y lector de pantalla.
- Tests de accesibilidad no reportan roles/controles anidados invalidos.
- Animaciones respetan reduced motion.

## Registro de ejecucion

Cuando un agente complete una tarjeta, agregar al final de esa tarjeta:

```text
Resultado (AAAA-MM-DD, agente):
- Archivos:
- Decisiones:
- Pruebas:
- Pendientes o riesgos residuales:
```

Si durante una tarea aparece un hallazgo nuevo:

- si es necesario para cumplir sus criterios, agregarlo a la misma tarjeta;
- si expande el alcance, crear una nueva tarjeta con dependencia explicita;
- si requiere decision de producto/backend/produccion, marcar `[!]` y detener esa parte.

