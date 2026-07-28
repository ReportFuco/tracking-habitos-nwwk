# Estado Actual de la App

Fecha de revision: 2026-04-18

## Resumen ejecutivo

La app se encuentra en una etapa funcional pero parcial. El frontend ya tiene una base estable en `Next.js + React + TypeScript`, autenticacion con JWT y dos modulos realmente trabajados: `finanzas` y `entrenamientos`.

Hoy el producto se siente mas como un panel operativo que como una app completa de habitos. La autenticacion funciona, el panel administrador navega bien y existen formularios/vistas para CRUD y seguimiento en los dos modulos principales. Aun asi, la home sigue marcando que el frontend esta "en construccion", no hay shell global persistente y buena parte de la documentacion describe una vision mas amplia que lo que el repo implementa hoy.

## Stack y arquitectura

- Framework: `Next.js 16` con `App Router`
- UI: `React 19`, `Tailwind CSS 4`, componentes base tipo shadcn/radix
- HTTP: `axios`
- Validacion: `zod`
- Feedback UI: `sonner`
- Lenguaje: `TypeScript`

Patron actual:

1. `app/` define rutas, paginas y layouts.
2. `modules/` agrupa la logica por dominio (`auth`, `finanzas`, `entrenamientos`, `usuario`).
3. Cada modulo separa `api`, `hooks`, `types`, `schemas` y componentes.
4. `lib/api.ts` centraliza la conexion al backend.

La app es principalmente client-side:

- el JWT se guarda en `localStorage`
- `axios` adjunta el token en cada request
- ante `401`, la sesion se limpia y redirige a `/usuarios`
- no se observa middleware, SSR auth ni cache global tipo React Query

## Modulos implementados hoy

### 1. Autenticacion y usuarios

Disponible en `/usuarios`.

Incluye:

- login con JWT
- registro de usuario
- carga de perfil autenticado
- cierre de sesion
- redireccion con `?next=...`

Observacion:

- el flujo esta operativo y es la puerta de entrada real a la app
- la gestion avanzada de usuarios aun no existe como modulo admin propio

### 2. Finanzas

Es el modulo mas completo junto con entrenamientos.

Disponible en:

- `/finanzas`
- `/administrador/finanzas`
- `/administrador/finanzas/registrar-cuenta`
- `/administrador/finanzas/registrar-movimiento`
- `/administrador/finanzas/historico`
- `/administrador/finanzas/bancos`
- `/administrador/finanzas/categorias`
- `/administrador/finanzas/cuentas`
- `/administrador/finanzas/movimientos`

Capacidades actuales:

- crear y editar bancos
- crear y editar categorias
- crear y editar cuentas
- crear y editar movimientos
- revisar historico de cuentas y movimientos

Notas:

- el refresh de datos se hace recargando catalogos completos despues de varias mutaciones
- hay varias vistas separadas por flujo, lo que ordena bien el uso actual

### 3. Entrenamientos

Tambien esta bastante avanzado.

Disponible en:

- `/administrador/entrenamientos`
- `/administrador/entrenamientos/iniciar-fuerza`
- `/administrador/entrenamientos/activo`
- `/administrador/entrenamientos/historico`
- `/administrador/entrenamientos/gimnasios`

Capacidades actuales:

- CRUD de gimnasios
- iniciar entrenamiento de fuerza
- ver entrenamiento activo
- agregar, editar y eliminar series
- cerrar entrenamiento activo
- revisar historico de entrenamientos

Notas:

- el flujo de sesion activa esta bien encaminado
- todavia depende de ingresar `id_ejercicio` manualmente, porque no existe catalogo de ejercicios en frontend

### 4. Home

La ruta `/` existe pero sigue siendo minima.

Hoy solo:

- presenta el nombre del proyecto
- indica que el frontend esta en construccion
- enlaza a `Panel Admin` y `Usuarios`

Esto confirma que la landing no refleja todavia el alcance real del sistema.

## Mapa de rutas actual

Rutas detectadas por `next build`:

- `/`
- `/usuarios`
- `/finanzas`
- `/administrador`
- `/administrador/finanzas`
- `/administrador/finanzas/bancos`
- `/administrador/finanzas/categorias`
- `/administrador/finanzas/cuentas`
- `/administrador/finanzas/historico`
- `/administrador/finanzas/movimientos`
- `/administrador/finanzas/registrar-cuenta`
- `/administrador/finanzas/registrar-movimiento`
- `/administrador/entrenamientos`
- `/administrador/entrenamientos/activo`
- `/administrador/entrenamientos/gimnasios`
- `/administrador/entrenamientos/historico`
- `/administrador/entrenamientos/iniciar-fuerza`

## Navegacion y permisos

La navegacion actual funciona, pero aun es simple:

- la home tiene accesos directos basicos
- `/administrador` usa un menu por cards
- cada modulo tiene submenus locales por links
- no hay sidebar global ni topbar persistente

Proteccion actual:

- `AuthGuard` si esta aplicado y protege rutas autenticadas
- `AdminGuard` existe, pero hoy no esta montado en layouts o paginas

Impacto practico:

- el panel llamado "administrador" esta protegido por sesion, no por rol de admin desde el frontend
- la restriccion real de superusuario depende principalmente del backend

## Estado visual y UX

La UI actual es utilitaria y ordenada, pero todavia no tiene una identidad de producto fuerte.

Lo que ya esta bien:

- componentes reutilizables consistentes
- uso estable de cards, tablas, inputs y toasts
- varias vistas resuelven responsive con cards en mobile y tabla en desktop
- formularios y estados vacios suficientes para trabajar

Lo que todavia falta:

- layout persistente de aplicacion
- mejor jerarquia visual global
- home y onboarding mas representativos
- separacion mas clara entre experiencia usuario y panel admin

## Conexion con backend

Variable principal:

- `NEXT_PUBLIC_API_URL`

Integraciones activas:

- auth: `/auth/register`, `/auth/jwt/login`, `/auth/jwt/logout`
- perfil: `/api/usuarios/perfil`
- finanzas: `/api/finanzas/...`
- entrenamientos: `/api/entrenamientos/...`

Hallazgo importante:

- `modules/usuario/api/usuario.api.ts` usa rutas `/usuarios/usuario/`
- el resto del proyecto trabaja con prefijos `/api/...`

Esto sugiere una inconsistencia o una integracion antigua que conviene revisar.

## Calidad tecnica actual

### Build

`npm run build` funciona correctamente al 2026-04-18.

### Lint

`npm run lint` falla actualmente con:

- 2 errores en `modules/entrenamientos/components/entrenamiento-activo-card.tsx`
- 1 warning en `modules/entrenamientos/hooks/useEntrenamientos.tsx`

Conclusion:

- la app compila
- el estado de calidad no esta completamente limpio todavia

### Tests y automatizacion

No se observaron:

- tests unitarios
- tests e2e
- CI visible
- pipeline automatizado de validacion

## Documentacion actual

Documentos encontrados:

- `docs/API.md`
- `docs/FRONTEND_VIEWS.md`
- `docs/DESIGN.md`
- `README.md`

Estado de la documentacion:

- `README.md` sigue casi boilerplate de Next.js
- `docs/API.md` describe una plataforma mas amplia que este frontend actual
- `docs/FRONTEND_VIEWS.md` y `docs/DESIGN.md` sirven mas como vision/propuesta que como fotografia del estado real
- `docs/api.json` aparece eliminado en `git status`, aunque otros docs lo mencionan como fuente

En otras palabras:

- si alguien nuevo entra hoy al repo, la documentacion no le muestra con precision que esta implementado y que no
- este archivo busca cubrir justamente ese vacio

## Fortalezas actuales

- base tecnica moderna y clara
- estructura modular ordenada por dominio
- autenticacion funcional
- modulos de finanzas y entrenamientos ya usables
- build exitoso
- componentes reutilizables suficientes para seguir creciendo

## Brechas y riesgos

- panel administrador sin enforcement de rol en frontend
- JWT almacenado en `localStorage`
- recargas completas de datos tras mutaciones
- documentacion desalineada con el repo real
- home demasiado basica para el estado actual
- sin tests ni CI visibles
- lint aun con errores activos
- inconsistencia de rutas en modulo `usuario`

## Estado general del proyecto

Estado sugerido: `funcional pero parcial`

Lectura corta:

- sirve para seguir desarrollando sobre una base real
- ya hay valor concreto en auth, finanzas y entrenamientos
- todavia no esta listo como producto frontend completo ni como handoff totalmente limpio

## Proximos focos recomendados

1. Corregir `lint` y dejar la base limpia.
2. Aplicar `AdminGuard` donde corresponda o renombrar el panel segun su alcance real.
3. Unificar rutas y contratos del modulo `usuario`.
4. Actualizar `README.md` con arquitectura, setup y mapa real de modulos.
5. Mantener `docs/` en modo descriptivo: que existe hoy vs que esta planificado.
6. Definir un layout global de app para mejorar navegacion y cohesion visual.
7. Evaluar cache de datos o estrategia menos costosa que refrescar todo tras cada accion.

