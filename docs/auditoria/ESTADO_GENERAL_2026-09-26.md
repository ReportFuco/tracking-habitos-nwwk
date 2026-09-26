# Estado general del proyecto — 2026-09-26

Revisión del checkout local `36727aa`, coordinada con tres subagentes: módulos y analítica; branding y componentes; backend y operación. Se aplicó la skill `ui-ux-pro-max` a la revisión de interfaz. Este documento complementa el backlog existente; no da por cerradas ni reabre automáticamente sus tarjetas.

La base técnica está bastante desarrollada, pero la madurez funcional es desigual. Finanzas y entrenamiento de fuerza concentran la implementación. Compras y nutrición tienen operaciones de backend que aún no están conectadas a flujos completos de usuario. Cambiar la paleta global es viable con la arquitectura actual.

## Alcance y verificaciones

Se inspeccionaron rutas, componentes, hooks, adaptadores, esquemas, modelos, pruebas y documentación. No se modificó código de aplicación, no se accedió a producción ni se ejecutaron migraciones. No hubo revisión visual autenticada, pruebas en dispositivo real ni una auditoría exhaustiva de seguridad.

| Verificación ejecutada | Resultado |
|---|---|
| `npm test` | 57 pruebas, 9 archivos, todas correctas |
| `npm run lint` | Correcto |
| `npx tsc --noEmit` | Correcto |
| `npm run build` | Correcto; generación de 42 páginas |
| `node --check public/sw.js` | Correcto |
| `npm audit` | 11 paquetes reportados: 1 crítico, 5 altos, 4 moderados, 1 bajo |
| `npm audit --omit=dev` | 4 paquetes reportados: 1 crítico, 2 altos, 1 moderado |
| Backend: docs, sesión web, notificaciones y esquema de ubicación | 17 pruebas correctas, sin conexión a base de datos |

El primer intento de pytest falló durante la importación: la configuración efectiva local selecciona `pysqlite`, incompatible con `create_async_engine`. Para las 17 pruebas independientes de DB se usaron variables temporales del proceso: URL ficticia con driver `asyncpg` y secreto exclusivo de prueba. No se cambió `.env`. Las integraciones restantes no se ejecutaron: importan la sesión de DB real, sin fixture que aprovisione una base aislada. Pasar estas verificaciones no demuestra que funcionen los flujos completos en navegador.

## Hallazgos de atención inmediata

### AUD-001 — Dependencias con alertas actuales

La auditoría de agosto que reportaba cero vulnerabilidades de producción ya no describe el árbol actual. `npm audit --omit=dev` señala `next`, `sharp`, `nanoid` y `baseline-browser-mapping`. El build usa Next 16.2.12 y el proyecto fija Sharp 0.35.3 mediante override (`frontend/package.json`).

Los avisos oficiales de Next identifican correcciones en 16.3.3 para una vulnerabilidad específica de servidores Windows y otra asociada al procesamiento AVIF. Sharp publica su propio aviso. Son alertas de versiones: no se comprobó explotación ni exposición de la instancia productiva. El despliegue documentado usa Linux, por lo que el aviso específico de Windows no se debe extrapolar a ese servidor; el riesgo de imágenes requiere revisar el uso efectivo del optimizador.

Fuentes: [Next/Windows](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36), [Next/AVIF](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4), [Sharp](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c).

Acción: actualizar las dependencias afectadas con revisión del override, reinstalación reproducible y verificaciones. No aplicar cambios mayores indiscriminadamente.

### AUD-002 — URLs incorrectas en catálogo de entrenamiento

`frontend/modules/entrenamientos/api/entrenamientos.api.ts:208`, `:225` y `:244` pasan directamente cadenas como `GET /api/entrenamientos/ejercicios/` a Axios. El texto del verbo termina dentro de la URL. Afecta obtener ejercicios, obtener músculos y crear ejercicios.

Se reprodujo localmente con `axios.getUri`, sin solicitudes de red: resulta una ruta como `https://example.invalid/GET /api/entrenamientos/ejercicios/`. Los tests actuales simulan `api.get` y validan datos, pero no verifican esa URL. Separar la ruta HTTP de la etiqueta usada para reportar errores; agregar aserciones de método y ruta.

### AUD-003 — PATCH financiero rompe invariantes

Crear movimientos exige monto positivo, pero editar no: `backend/app/schemas/finanzas/movimientos.py:146`. Se comprobó ejecutando el esquema que acepta `monto=-100` y `monto=None`. La ruta asigna esos valores y hace commit (`backend/app/routes/finanzas/movimientos.py:325`); el modelo no tiene CHECK de monto positivo. Negativos pueden alterar totales; null choca con NOT NULL.

Además, convertir un gasto con ubicación en ingreso conserva la ubicación, contradiciendo el CHECK del modelo (`backend/app/models/finanzas.py:142`). Por lectura de código, ese caso llega a una excepción de integridad en lugar de una respuesta de negocio. El resultado HTTP no se reprodujo contra DB.

Acción: validar estado final de la entidad, positividad y nulabilidad; definir qué ocurre con ubicación al cambiar el tipo; probar PATCH vía HTTP con PostgreSQL aislado.

### AUD-004 — Navegación administrativa móvil sin enlaces inferiores

`frontend/components/shell/app-shell.tsx` envía ítems administrativos al componente móvil sin indicar otro orden. `mobile-bottom-nav.tsx:14-37` filtra solo rutas `/app/...`, de modo que no quedan ítems administrativos. El menú lateral sigue disponible. También se dibuja el indicador de la primera opción si ninguna ruta está activa (`:38`).

## Estado funcional y analítica

| Área | Implementado | Incompleto o pendiente |
|---|---|---|
| Finanzas | Cuentas, movimientos, edición y detalle, catálogos, altas offline, resumen financiero | Conectar tendencia y distribuciones; corregir contratos y paginación del histórico |
| Fuerza | Inicio/cierre, sesión activa, series, histórico, ejercicios, gimnasios, cola offline | Corregir URLs; analítica de carga, volumen, frecuencia y récords |
| Compras | Cabeceras de compra, listado/borrado, locales y cadenas | Productos, cantidades, precios y vinculación con movimientos en UI |
| Nutrición | Cabeceras de comidas, peso, metas, tablas nutricionales | Alimentos/porciones dentro del consumo, cálculo de ingesta, cumplimiento y tendencias |
| Catálogo | Productos y marcas en administración | Categorías/subcategorías tienen backend, sin gestión frontend |
| Dashboard | KPI financieros | Tarjetas de entrenamiento, compras y nutrición contienen textos de funciones futuras |
| Perfil/auth | Login, registro, perfil, roles, sesión revocable | Recuperación/cambio de contraseña y verificación de correo sin flujos completos expuestos |
| Notificaciones | Suscripciones, preferencias, recordatorios y worker | Verificar habilitación operativa; última documentación dice que están desactivadas |
| Hábitos | Modelos | Sin API ni interfaz funcional |
| Lecturas | Modelos y routers vacíos | Sin endpoints ni interfaz funcional |
| Cardio | Modelo de entrenamiento aeróbico | Sin rutas ni interfaz |

**Finanzas es el único módulo con API analítica dedicada**, aunque otros sí tienen indicadores sencillos en frontend: conteos de sesiones/series, compras acumuladas, comidas del día y diferencias entre registros de peso. No existe todavía un sistema común de analítica entre módulos.

El resumen financiero está conectado; los endpoints de tendencia mensual y distribución por cuenta/categoría existen en backend pero no tienen gráficos consumidores. Antes de conectarlos debe corregirse `frontend/modules/finanzas/api/finanzas.api.ts:169-191`: declara arrays, mientras `backend/app/schemas/finanzas/analitica.py:56-109` devuelve objetos con `items` y metadatos. También difieren nombres como `label`/`porcentaje` frente a `categoria`/`nombre_cuenta`/`porcentaje_del_total`. Es deuda latente, no un gráfico actual fallando.

### Brechas funcionales concretas

- **Compra incompleta:** `compras-manager.tsx:74-77` registra solo local y fecha. El total se calcula desde detalles en `backend/app/schemas/compras/compra.py:48-49`; una compra creada así empieza en cero y la UI no permite completarla. Backend y adaptadores de detalles ya existen.
- **Consumo incompleto:** `consumos-manager.tsx:88-92` registra fecha, tipo de comida y observación. Existen APIs y mutaciones para detalles, pero los componentes no las usan. Sin alimentos y porciones no hay base para calcular macros reales.
- **Histórico financiero truncado:** `historico-cards.tsx:15-18,67` promete todos los movimientos, pero usa la consulta paginada con tamaño inicial 20 (`useFinanzas.tsx:29,74-94`) y no ofrece cargar más. Su alcance depende de las páginas cargadas previamente en caché.
- **Meta incorrectamente activa:** `nutricion-home-overview.tsx:20-22` usa `metas[0]` cuando no hay ninguna vigente y la presenta como activa.
- **Fechas locales inconsistentes:** nutrición calcula hoy con `toISOString()` en UTC; agrupa por fecha y luego usa `new Date('YYYY-MM-DD')` al mostrarla (`consumos-manager.tsx:280-286`). En Chile esto puede seleccionar el día equivocado o mostrar el anterior.

## Core compartido y límites entre módulos

Sí existe un core funcional, aunque frontend no lo llama `core/`:

- `frontend/components/ui`: Button, Input, Table, Card, Dialog, Skeleton y Sonner.
- `components/forms`: primitivas editoriales y combobox.
- `components/shell`, `auth`, `feedback` y `pwa`: navegación, guards, encabezados, loaders y soporte PWA.
- `frontend/lib`: Axios, sesión, errores, query keys, persistencia, validación de respuestas y utilidades.
- `frontend/modules`: componentes, datos y comportamiento de cada dominio.
- Backend comparte configuración, DB, auth, middleware/logging y utilidades, con modelos/esquemas/rutas por dominio.

Inventario estático: 28 archivos TSX de componentes compartidos y 50 de componentes de módulos. Button aparece importado en 33 archivos, Table en 14, Input en 11 y Card en uno. Hay reutilización real, pero muchas tarjetas y patrones de estado se construyen manualmente.

No se necesita mover todo a una carpeta `core`. Conviene formalizar dependencias permitidas, API pública por módulo y reglas de imports. El estado actual mezcla exports de módulo con imports internos. En backend, buena parte del negocio sigue dentro de las rutas y existen helpers de usuario duplicados.

Pendientes razonables: compartir tarjetas KPI/accesos y estados vacío/error/reintento; unificar patrones CRUD; dividir hooks agregadores; migrar perfil legacy. `usePerfil.tsx` administra estado separado del `useProfile` de TanStack Query, sin invalidar su caché al editar. Esto puede dejar información desincronizada entre perfil y shell.

## Branding y sistema visual

**Cambiar colores globalmente tiene factibilidad alta y esfuerzo bajo.** Tailwind 4 se configura en `frontend/app/globals.css` mediante `@theme inline`; no hace falta introducir un `tailwind.config.ts`.

Hay tokens para primary/secondary, fondo, superficies, texto, estados, bordes, sidebar, gráficos, radios, sombras y colores por módulo (`--module-finanzas`, `--module-entrenamientos`, `--module-nutricion`, `--module-compras`, `--module-admin`). Se pueden editar sus valores y conservar las clases consumidoras.

| Cambio | Esfuerzo relativo | Trabajo adicional |
|---|---|---|
| Paleta con estructura actual | Bajo | Tokens globales y por módulo; revisar gradientes y contraste |
| Nombre, logo, tipografía y PWA | Bajo a medio | Centralizar identidad, metadata, manifest, iconos, loaders y notificaciones |
| Radios, densidad y estilo de tarjetas | Medio | Sustituir overrides por tokens y componentes |
| Dark mode completo | Medio | Activación, paleta oscura de módulos, superficies y validación visual |

El alcance global tiene excepciones medibles. Sobre TS/TSX de app/components/modules, excluyendo CSS y assets: 134 referencias `var(--module-...)` en 32 archivos; 12 coincidencias de colores literales en 8 archivos; 24 utilidades de paleta no semántica en 11 archivos; 310 clases `rounded-[...]` en 47 archivos. Son indicadores de alcance, no porcentajes de cobertura ni 310 defectos.

Los colores están más centralizados que la geometría. Cambiar `--radius` no modifica todas esas clases arbitrarias. También hay gradientes RGB en auth/loaders, `themeColor` en layout y colores en manifest. Se mezclan los nombres **Atelier** y **The Curated Life** en shell, loaders, metadata y notificaciones; falta una fuente única de identidad.

Existe `.dark` en CSS, pero no se encontró un mecanismo para activarla ni redefiniciones oscuras de colores de módulo. El viewport anuncia `light dark`. Debe elegirse entre modo claro explícito o completar el oscuro.

### Accesibilidad pendiente

- `components/forms/editorial-form.tsx:109`: label separado sin `htmlFor`; hay consumidores sin id ni alternativa ARIA, como `cuenta-form.tsx:187`.
- `modules/catalogo/components/marcas-manager.tsx:102,109`: editar/eliminar solo con iconos y sin nombre accesible.
- `components/forms/searchable-combobox.tsx`: revisar nombre del diálogo/buscador, foco al cerrar, relación control-lista y control enfocable anidado en el botón.
- Contraste efectivo, tamaños táctiles, responsive y lector de pantalla necesitan validación en navegador; no se certificaron mediante lectura de código.

## Confiabilidad, seguridad y operación pendientes

**Offline:** hay colas y pruebas reales para movimientos y entrenamiento; no es una promesa vacía. Falta demostrar recarga, cierre inmediato, reconexión, cambio de usuario y actualización de service worker en navegador de producción. El persister escribe con `throttleTime: 1000`, usa una entrada global, y `Providers` reanuda mutaciones al restaurar. No hay garantía explícita de persistencia durable antes del mensaje de éxito ni vínculo de la cola a identidad en esos archivos. Son riesgos a comprobar, no pérdida de datos reproducida. Se corresponden con FE-OFF-005 y FE-PWA-001/002.

**Concurrencia:** finanzas consulta UUID antes de insertar; UNIQUE evita duplicados, pero falta recuperar el resultado tras colisión simultánea. En inicio de entrenamiento la consulta idempotente ocurre antes del lock: un reintento concurrente puede recibir conflicto de sesión activa. Las recuperaciones por colisión de inicio/series también deberían repetir el filtro de ownership. Estos escenarios se infieren del código y requieren pruebas con dos conexiones reales.

**Validación transversal:** pesos, cantidades/precios y metas requieren rangos y orden de fechas; revisar nulls de PATCH frente a columnas obligatorias. Frontend aún tiene conversiones `Number(...)` sin política uniforme; el backlog FE-ZOD-003 ya reconoce parte de este trabajo.

**Seguridad existente:** sesiones opacas con hash, expiración y revocación, API keys con hash, permisos de superusuario y filtros de pertenencia en los flujos revisados. No se detectó en el muestreo una lectura normal de datos ajenos. Esto no reemplaza una auditoría de todos los endpoints.

**Endurecimiento a revisar:** limitación de intentos de autenticación, destinos/timeout de Web Push antes de habilitarlo públicamente y ciclo de vida del caché de deduplicación de logs. Son recomendaciones derivadas de implementación, no incidentes comprobados.

**Operación:** no hay CI versionado; deploy, build y migraciones son manuales. Gunicorn es requerido por el servicio documentado pero no está en requirements. No se encontró procedimiento versionado de restauración de backups ni health/readiness. Esto no demuestra ausencia de backups en servidor. Docker está documentado como flujo distinto al despliegue real. No se verificó el servidor.

**Documentación:** `frontend/README.md` dice que no hay tests y describe localStorage; sí hay Vitest e IndexedDB. `frontend/CLAUDE.md` aún menciona Next 15 y generaliza el uso de React Hook Form. `backend/README.md` está vacío. No hay AGENTS.md. La tarjeta histórica de rotación de credenciales sigue bloqueada; esta revisión no confirmó si se hizo la rotación ni examinó secretos/historial.

## Orden de trabajo recomendado

1. **Estabilización inmediata:** dependencias, URLs de ejercicios, invariantes PATCH y navegación admin móvil. Aceptación: rutas correctas verificadas, errores de negocio 4xx, datos inválidos rechazados y navegación usable.
2. **Base de verificación:** PostgreSQL aislado para integraciones, tests HTTP y de concurrencia, CI, pruebas de PWA sobre build de producción. Aceptación: login → operación → lectura, reintentos y cambio de identidad comprobados.
3. **Completar los flujos existentes:** compra con ítems/vínculo financiero y consumo con productos/porciones; corregir histórico y fechas. Aceptación: registrar una compra con total real y una comida con ingesta calculable desde la interfaz.
4. **Sistema visual y rebranding:** identidad única, tokens, corrección de labels/combobox y migración gradual de tarjetas/radios. Puede avanzar en paralelo por archivos independientes una vez atendidos los bloqueos funcionales.
5. **Analítica:** corregir contratos de finanzas y conectar tendencia/distribuciones; después fuerza y nutrición, con métricas definidas y datos completos. Completar dashboard transversal con esos resultados.
6. **Expansión:** hábitos, lecturas y cardio solo cuando se decida incorporarlos al alcance del producto; su presencia en modelos no obliga a implementarlos antes de estabilizar lo actual.

No se asigna un porcentaje global de avance: no hay alcance funcional cerrado que permita calcularlo de forma defendible. Las estimaciones de branding son relativas y no incluyen todavía pruebas visuales ni decisiones de identidad.
