# Auditoria tecnica del frontend

Fecha de corte: 2026-08-02.

Alcance: `frontend/`, con contraste puntual del backend cuando era necesario verificar
contratos, idempotencia o deriva de DTO. La revision fue de solo lectura y se dividio entre
estructura/Zod, TanStack/PWA y Tailwind/UI.

## Resumen ejecutivo

La base del frontend es util y compila: Next.js App Router, TypeScript estricto, dominios
reconocibles, Axios centralizado, TanStack Query, Zod y un theme global de Tailwind 4.

Los riesgos principales son:

1. Las mutaciones pausadas offline se esperan con `mutateAsync`, dejando formularios
   bloqueados. El caso visible es registrar/iniciar un entrenamiento y tambien afecta
   agregar series.
2. El service worker manual no garantiza el grafo completo de assets ni las rutas RSC en
   una primera recarga offline.
3. Las series y acciones de entrenamiento no tienen idempotencia equivalente al
   `client_request_id` de movimientos financieros.
4. Zod valida formularios, pero las respuestas HTTP se introducen al cache sin validacion
   runtime. Ya existe deriva comprobada frente al backend.
5. La documentacion anterior contradice el codigo actual y no existe un `AGENTS.md`.
6. El theme global existe, pero su uso es inconsistente y el modo oscuro esta declarado sin
   estar implementado completamente.
7. `npm audit --omit=dev` reporta cinco vulnerabilidades altas.

## Verificaciones ejecutadas

Desde `frontend/`:

| Verificacion | Resultado |
|---|---|
| `npm test` | 3 archivos, 12/12 pruebas |
| `npm run lint` | Correcto |
| `npx tsc --noEmit` | Correcto |
| `npm run build` | Correcto, 42 rutas |
| `node --check public/sw.js` | Correcto |
| `npm audit --omit=dev` | 5 vulnerabilidades altas |

El build resolvio Next.js 16.2.4 dentro del rango declarado. Estas verificaciones no
incluyeron Lighthouse ni navegacion PWA automatizada.

## 1. Arquitectura y core

### Estado

No existe una carpeta `core`. `frontend/lib/` cumple ese papel de forma plana:

- `api.ts`: instancia Axios, credenciales e interceptor 401.
- `auth-session.ts`: compatibilidad de sesion local.
- `query-persistence.ts`: persister IndexedDB y limpieza.
- `query-keys.ts`: claves centralizadas.
- `error-messages.ts`, `parse-numeric.ts`, `geolocation.ts`: utilidades transversales.

`components/ui`, `components/forms` y `components/shell` son la capa compartida visual.

### Fortalezas

- `strict: true` y alias `@/*`.
- Pages generalmente delgadas.
- Estructura reconocible `modules/<dominio>/{api,hooks,schemas,types,components}`.
- Query keys y cliente HTTP centralizados.
- Carpetas `offline/` explicitas para los dos flujos con outbox.

### Deudas

- La estructura no es uniforme: algunos modulos tienen `index.ts`, otros no, y los barrels
  existentes exportan internals pero casi no se consumen.
- No hay reglas ESLint de boundaries.
- Hay cruces directos `auth -> notifications` y `nutricion -> catalogo`.
- Algunos componentes llaman APIs directamente, mientras otros dependen de hooks.
- Componentes entre 400 y 490 lineas concentran presentacion, estado y orquestacion.
- `components/auth` contiene UI de un dominio cuya logica vive en `modules/auth`.

### Decision recomendada

No crear `core/` solo por el nombre. Primero documentar ownership y dependencias. Si se
decide migrar, hacerlo gradualmente hacia `shared/{api,auth,query,validation,ui}` y no como
un movimiento masivo.

## 2. Zod y contratos

### Estado

Hay schemas Zod para varios formularios de auth, finanzas, entrenamientos, nutricion,
compras y usuario. Los componentes suelen usar `safeParse` antes de llamar a un hook.

No hay schemas de respuestas HTTP. Los adapters declaran `Promise<T>` y retornan `data`
de Axios, que es efectivamente no validado. Esto permite que un objeto incorrecto quede
tipado como valido y, ademas, se persista durante siete dias.

Ejemplos relevantes:

- `frontend/modules/auth/api/auth.api.ts` retorna registro y perfil sin parsear.
- `frontend/modules/catalogo/api/catalogo.api.ts` retorna catalogos crudos.
- `frontend/modules/finanzas/api/finanzas.api.ts` retorna respuestas crudas.
- `frontend/modules/entrenamientos/api/entrenamientos.api.ts` mezcla normalizacion manual,
  casts y retornos crudos.

### Deriva comprobada

- `LocalResponse.id_cadena` es obligatorio en frontend, pero opcional en el schema backend.
- Metas nutricionales declaran campos obligatorios en frontend que el backend permite nulos;
  `formatDate` puede recibir `null`.
- `UsuarioProfile` y `Usuario` representan el mismo perfil con modelos paralelos.

### Duplicacion

- Los tipos `z.infer` exportados no se consumen fuera del archivo donde se declaran.
- Requests equivalentes se vuelven a declarar como interfaces manuales.
- Enums de movimiento, gasto y comida existen tanto como tuplas para Zod como unions TS.

### Validadores incompletos

- Auth no aplica `trim`; telefono valida longitud y no exactamente once digitos.
- Latitud y longitud de gimnasio no validan rangos geograficos.
- Fechas se validan por regex y aceptan fechas imposibles.
- Locales y productos usan `Number(...)` sin comprobar `finite`, aunque existe
  `lib/parse-numeric.ts`.
- Constantes de unidades estan declaradas, pero algunos schemas aceptan cualquier string.

La accion propuesta esta en `FE-ZOD-*`.

## 3. TanStack Query

### Alcance real

Solo se usa TanStack Query. La navegacion es Next App Router, los formularios son estado
manual/Zod y las tablas son componentes propios.

### Fortalezas

- Query keys centralizadas.
- `staleTime`, `gcTime`, invalidaciones y carga incremental presentes.
- IndexedDB mediante persister asincrono.
- Buster de schema y `maxAge` de siete dias.
- Persistencia opt-in por `meta.persist`.
- Defaults de mutaciones restaurables registrados antes de rehidratar.
- Tests de persistencia, orden de series y movimiento idempotente.

### Persistencia real de datos

El README historico dice que solo se persisten catalogos no sensibles. El codigo actual
persiste tambien perfil, cuentas, movimientos, compras, consumos, metas, pesos, gimnasios,
entreno activo e historico ya cargado. Logout/login limpian el cache, pero falta documentar
una politica explicita de clasificacion y retencion.

### Problemas

- `shouldPersistMutation` filtra por scope, no por `state.isPaused`.
- `throttleTime: 1000` puede perder la ultima alta si la PWA se cierra inmediatamente.
- El arbol cambia de `QueryClientProvider` a `PersistQueryClientProvider` despues de
  hidratar, permitiendo remount/fetch antes de restaurar.
- Las mismas query keys se crean con opciones `meta.persist` distintas segun el consumidor.
- Los paquetes TanStack mezclan 5.100.5 y 5.101.4, instalando dos `query-core`.
- `query-sync-storage-persister` no se usa.
- Tests importan `query-persist-client-core` sin declararlo directamente.
- Hooks de usuario/perfil aun usan Axios con `useEffect`, fuera de Query.

## 4. Diagnostico offline bloqueante

TanStack usa `networkMode: "online"` por defecto. Sin red, una mutacion queda simultaneamente
`isPending` e `isPaused`; la promesa de `mutateAsync` no resuelve hasta reconectar.

```text
submit offline
-> mutation pausada
-> mutateAsync no resuelve
-> isPending permanece true
-> formulario y botones quedan bloqueados
```

Se reprodujo localmente el estado `pending + isPaused + promiseSettled=false`.

### Matriz de operaciones

| Operacion | Estado 2026-08-02 | Comportamiento requerido |
|---|---|---|
| Crear usuario | No soportada; queda esperando | Fallar rapido. Nunca persistir password |
| Iniciar/registrar entrenamiento | No tiene outbox; queda esperando | Hacer queueable con idempotencia o declarar solo-online |
| Agregar serie | Se encola, pero UI espera la promesa | Retornar `queued` sin esperar y mostrar pendiente |
| Cerrar entrenamiento | Se encola, con bloqueo equivalente | Retornar `queued` y reconciliar al reconectar |
| Crear movimiento financiero | Implementacion de referencia | Mantener `client_request_id` y estado pendiente |
| Editar/borrar movimiento | Solo-online | Fallar rapido offline |
| Compras/nutricion/CRUD | Sin outbox explicita | Fallar rapido o diseñar caso por caso |

Finanzas ya contiene el patron de referencia: usa `mutate()` sin esperar cuando
`onlineManager` esta offline y devuelve `{ queued: true }`. Entrenamientos usa
`mutateAsync()` en todos los casos y calcula `submitting` con `isPending` aunque la mutation
este pausada.

### Idempotencia

Movimientos financieros generan `client_request_id` y el backend tiene una restriccion
unica. Series, apertura y cierre de entrenamiento no tienen una clave equivalente. Si el
servidor confirma una escritura pero se pierde la respuesta, el reintento puede duplicar o
dejar la cola en error.

No se debe ampliar la cola de entrenamiento sin resolver primero el contrato idempotente.

## 5. PWA y service worker

El service worker:

- solo se registra en produccion;
- precachea `/offline`, `/app/dashboard` y un icono;
- no usa un manifiesto generado con todos los JS/CSS hashed;
- cachea documentos de `/app/*` y `/administrador` despues de visitarlos;
- cachea RSC por pathname despues de una navegacion online;
- excluye correctamente API, auth y metodos distintos de GET;
- no implementa Background Sync.

Riesgos:

- Una PWA recien instalada puede no sobrevivir su primer hard reload offline.
- Una ruta no visitada no tiene documento/RSC disponible.
- El cache anterior se elimina en `activate` sin garantizar primero todo el asset graph
  nuevo.
- "Sincronizacion automatica" significa al reabrir o reconectar con la app activa, no en
  segundo plano con la app cerrada.

Las pruebas actuales cubren TanStack/IndexedDB, no el navegador, el service worker ni el
shell real.

## 6. Tailwind y sistema visual

### Estado

Tailwind 4 usa configuracion CSS-first. La ausencia de `tailwind.config.ts` es correcta.
`frontend/app/globals.css` expone mediante `@theme inline`:

- colores semanticos y superficies;
- colores por modulo;
- sidebar y charts;
- radios `sm` a `4xl`;
- sombras `airy` y `airy-lg`;
- fuentes `sans`, `mono` y `label`;
- tokens light/dark.

Las fuentes Manrope, Inter y Geist Mono se cargan con `next/font`.

### Deudas

- Se mezclan utilidades semanticas con cientos de valores arbitrarios equivalentes.
- Radios, tracking y tamanos de texto se repiten en cada componente.
- Hay numerosos labels de 9 a 11 px.
- Los botones base e icon-only miden 32 a 40 px, bajo el objetivo tactil de 44 px.
- No existe politica `prefers-reduced-motion`.
- El combobox mantiene interaccion anidada y roles ARIA incorrectos.
- Bottom nav marca Dashboard cuando la ruta no pertenece a sus cinco opciones.

### Modo oscuro

`.dark` existe, pero ningun provider o selector aplica la clase. Si se activa hoy:

- los colores `--module-*` no se redefinen;
- hay fondos `bg-white/*` incompatibles;
- algunas combinaciones quedan cerca de 2:1 de contraste;
- manifest y browser chrome siguen siendo claros.

Se necesita una decision de producto: solo claro o dark mode real. No se debe activar la
clase sin completar la paleta y probar contraste.

## 7. Seguridad y documentacion

### Dependencias

`npm audit --omit=dev` reporto cinco vulnerabilidades altas relacionadas con Axios,
FormData, Next.js, PostCSS y Sharp. `package.json` fija PostCSS 8.5.12 mediante override.
La actualizacion debe hacerse en una rama controlada, revisar cambios de lockfile y repetir
build/tests; no aplicar `npm audit fix` a ciegas en produccion.

### Secretos documentados

`docs/PROGRESO.md` contiene credenciales en texto plano y reconoce que una credencial de
produccion fue expuesta. No se reproduce ningun secreto en esta auditoria. La rotacion
requiere accion deliberada del usuario/operador y luego saneamiento del documento e historial
segun el nivel de exposicion.

### Documentacion anterior

- `frontend/CLAUDE.md` dice Next 15, pero el proyecto usa Next 16.
- Afirma que todos los forms usan React Hook Form/Zod resolver, pero predominan `useState`
  y `safeParse` y no hay uso efectivo de RHF en TS/TSX.
- `frontend/README.md` afirma que no hay tests y que el cache vive en localStorage.
- `frontend/docs/CACHING_STRATEGY.md` sigue marcada como propuesta aunque buena parte ya fue
  implementada con IndexedDB.
- `frontend/docs/DESIGN.md` menciona tokens inexistentes.
- No existe `AGENTS.md`.

El plan operativo para corregir estas brechas esta en `PLAN_FRONTEND.md`.

