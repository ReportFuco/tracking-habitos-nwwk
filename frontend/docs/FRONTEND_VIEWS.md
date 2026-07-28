# Frontend Views y Arquitectura UX

## Objetivo

Este documento propone cómo organizar el frontend de la aplicación para que tenga armonía visual y funcional, separando claramente:

- experiencia de usuario autenticado
- panel de administración

La idea es que el front no sea solo una colección de formularios, sino un producto coherente, con jerarquía, navegación clara y vistas alineadas con los permisos reales de la API.

## Principio rector

La regla base del frontend debería ser:

- todo lo que el usuario normal puede crear, ver o editar vive en el `Panel Usuario`
- todo lo que usa endpoints protegidos por `superuser` vive en el `Panel Admin`

Eso evita mezclar mantenimiento de catálogos con la experiencia diaria del usuario.

## Estructura general recomendada

### 1. Zona pública
Vistas sin sesión iniciada.

- landing o home simple
- login
- registro
- recuperación de acceso si luego se implementa

### 2. App autenticada de usuario
Zona principal del producto para uso diario.

- dashboard personal
- perfil
- finanzas personales
- entrenamientos
- compras
- nutrición
- historial y detalle de registros

### 3. Panel admin
Zona separada para mantenimiento y control global.

- gestión de usuarios
- gestión de bancos
- gestión de categorías financieras
- gestión de gimnasios
- gestión de marcas
- gestión de productos
- gestión de cadenas
- gestión de locales
- gestión de tablas nutricionales

## Separación recomendada de rutas frontend

### Público
```txt
/
/login
/register
```

### Usuario autenticado
```txt
/app
/app/dashboard
/app/perfil
/app/finanzas
/app/finanzas/cuentas
/app/finanzas/cuentas/:id
/app/finanzas/movimientos
/app/entrenamientos
/app/entrenamientos/activo
/app/entrenamientos/historial
/app/compras
/app/compras/nueva
/app/compras/:id
/app/nutricion
/app/nutricion/consumos
/app/nutricion/metas
/app/nutricion/peso
```

### Admin
```txt
/admin
/admin/usuarios
/admin/bancos
/admin/categorias-finanzas
/admin/gimnasios
/admin/marcas
/admin/productos
/admin/cadenas
/admin/locales
/admin/tablas-nutricionales
```

## Propuesta de navegación

## Navegación de usuario
Sidebar o navegación lateral con estas secciones:

- Dashboard
- Finanzas
- Entrenamientos
- Compras
- Nutrición
- Perfil

Subnavegación sugerida:

- Finanzas: `Cuentas`, `Movimientos`
- Entrenamientos: `Sesión activa`, `Historial`, `Gimnasios`
- Compras: `Compras`, `Nueva compra`
- Nutrición: `Consumos`, `Metas`, `Peso`

## Navegación admin
Sidebar separada, idealmente con un look distinto pero emparentado.

- Resumen
- Usuarios
- Finanzas maestras
- Entrenamientos maestros
- Catálogo
- Compras maestras
- Nutrición maestra

Subnavegación sugerida:

- Finanzas maestras: `Bancos`, `Categorías`
- Entrenamientos maestros: `Gimnasios`
- Catálogo: `Marcas`, `Productos`
- Compras maestras: `Cadenas`, `Locales`
- Nutrición maestra: `Tablas nutricionales`

## Layouts recomendados

## 1. Layout público
Uso:

- login
- registro

Características:

- centrado vertical y horizontal
- branding simple
- mensaje de propuesta de valor
- formulario corto y claro
- fondo limpio con algo de personalidad visual

## 2. Layout app usuario
Uso:

- toda la zona `/app`

Características:

- sidebar fija en desktop
- topbar con nombre del usuario, acceso a perfil y logout
- contenido principal con tarjetas de resumen arriba y tablas o formularios debajo
- en móvil, sidebar convertida a drawer

## 3. Layout admin
Uso:

- toda la zona `/admin`

Características:

- mismo sistema base que usuario para no duplicar diseño
- pero con identidad un poco más operativa
- foco en tablas, filtros, estados y formularios maestros
- breadcrumbs visibles

## Sistema visual recomendado

La app maneja varias áreas de vida personal. Conviene que el diseño sea sobrio, cálido y ordenado, no demasiado corporativo.

### Dirección visual sugerida

- fondo claro con capas suaves, no plano absoluto
- bloques con bordes redondeados medianos
- tipografía muy legible y con personalidad
- una paleta principal neutra y una acentuación por módulo

### Colores por módulo

- dashboard: azul petróleo o azul grisáceo
- finanzas: verde oliva o verde profundo
- entrenamientos: rojo ladrillo o coral oscuro
- compras: ámbar tostado
- nutrición: verde hoja o salvia
- admin: gris grafito con acentos sobrios

Esto ayuda a que cada módulo se sienta propio, pero dentro de la misma familia.

## Vistas recomendadas para Panel Usuario

## 1. Dashboard principal
Ruta sugerida:

```txt
/app/dashboard
```

Objetivo:

- mostrar un resumen útil del día o de la semana
- funcionar como puerta de entrada a todas las áreas

Bloques sugeridos:

- saludo con nombre del usuario
- tarjeta de peso más reciente
- meta nutricional activa
- resumen de movimientos recientes
- última compra registrada
- estado del entrenamiento activo o botón para iniciar uno
- accesos rápidos

Acciones rápidas:

- registrar movimiento
- registrar compra
- registrar consumo
- agregar peso
- iniciar entrenamiento

Diseño sugerido:

- grid de tarjetas arriba
- actividad reciente abajo
- una columna derecha con shortcuts o pendientes

## 2. Perfil
Ruta sugerida:

```txt
/app/perfil
```

Objetivo:

- editar datos del usuario

Bloques sugeridos:

- datos personales
- usuario y contacto
- fecha de creación
- botón guardar cambios

Endpoints relacionados:

- `GET /api/usuarios/perfil`
- `PATCH /api/usuarios/perfil`

## 3. Finanzas overview
Ruta sugerida:

```txt
/app/finanzas
```

Objetivo:

- dar una vista consolidada antes de entrar a cuentas o movimientos

Bloques sugeridos:

- total de cuentas activas
- movimientos recientes
- gastos vs ingresos
- filtros por fecha
- CTA para crear cuenta o registrar movimiento

## 4. Finanzas > Cuentas
Ruta sugerida:

```txt
/app/finanzas/cuentas
```

Objetivo:

- listar cuentas del usuario

Componentes:

- tabla o cards de cuentas
- badge de tipo de cuenta
- nombre del banco
- botón crear cuenta
- acción ver detalle
- acción editar
- acción desactivar

Endpoint principal:

- `GET /api/finanzas/cuentas/`

## 5. Finanzas > Detalle de cuenta
Ruta sugerida:

```txt
/app/finanzas/cuentas/:id
```

Objetivo:

- ver una cuenta con sus movimientos asociados

Componentes:

- resumen de la cuenta
- banco
- tipo de cuenta
- lista de transacciones
- filtros por categoría o fecha
- botón agregar movimiento

Endpoint principal:

- `GET /api/finanzas/cuentas/{id_cuenta}`

## 6. Finanzas > Movimientos
Ruta sugerida:

```txt
/app/finanzas/movimientos
```

Objetivo:

- registrar y revisar movimientos financieros

Componentes:

- tabla con filtros
- modal o drawer para crear movimiento
- edición inline o modal
- chips para `gasto` / `ingreso`
- chips para `fijo` / `variable`

Endpoints relacionados:

- `GET /api/finanzas/movimientos/`
- `POST /api/finanzas/movimientos/`
- `PATCH /api/finanzas/movimientos/{id}`

## 7. Entrenamientos overview
Ruta sugerida:

```txt
/app/entrenamientos
```

Objetivo:

- resumen de sesiones y acceso a sesión activa

Bloques sugeridos:

- CTA para iniciar entrenamiento
- tarjeta de entrenamiento activo
- últimas sesiones
- acceso a gimnasios disponibles

## 8. Entrenamientos > Sesión activa
Ruta sugerida:

```txt
/app/entrenamientos/activo
```

Objetivo:

- ser la vista más importante del módulo entrenamiento

Esta vista debería sentirse casi como una herramienta en tiempo real.

Componentes:

- encabezado con gimnasio y hora de inicio
- listado de series del entrenamiento activo
- formulario rápido para agregar serie
- acción editar serie
- acción eliminar serie
- botón fijo `Cerrar sesión`

Endpoints relacionados:

- `GET /api/entrenamientos/fuerza/activo`
- `POST /api/entrenamientos/series/`
- `PATCH /api/entrenamientos/series/{id}`
- `DELETE /api/entrenamientos/series/{id}`
- `PATCH /api/entrenamientos/fuerza/activo/cerrar`

## 9. Entrenamientos > Historial
Ruta sugerida:

```txt
/app/entrenamientos/historial
```

Objetivo:

- listar las sesiones de fuerza del usuario

Componentes:

- lista o tabla de entrenamientos
- estado
- fecha
- gimnasio
- acceso a detalle

Endpoints relacionados:

- `GET /api/entrenamientos/fuerza/`
- `GET /api/entrenamientos/fuerza/{id}`

## 10. Compras overview
Ruta sugerida:

```txt
/app/compras
```

Objetivo:

- listar compras y facilitar el registro de una nueva

Componentes:

- lista de compras recientes
- total gastado reciente
- botón `Nueva compra`
- filtro por fecha o local

Endpoint principal:

- `GET /api/compras/compra/`

## 11. Compras > Nueva compra
Ruta sugerida:

```txt
/app/compras/nueva
```

Objetivo:

- registrar una compra completa

Flujo ideal:

1. elegir local
2. elegir fecha
3. guardar compra base
4. agregar productos al detalle
5. revisar total visualmente

Componentes:

- formulario cabecera de compra
- buscador de productos
- tabla editable de detalle
- cálculo visual del total
- guardar y seguir agregando

Endpoints relacionados:

- `POST /api/compras/compra/`
- `POST /api/compras/compra-detalle/`

## 12. Compras > Detalle de compra
Ruta sugerida:

```txt
/app/compras/:id
```

Objetivo:

- revisar una compra y sus líneas

Componentes:

- cabecera con local y fecha
- tabla de productos comprados
- edición de líneas
- eliminación de línea
- edición de cabecera

Endpoints relacionados:

- `GET /api/compras/compra/{id}`
- `GET /api/compras/compra-detalle/?id_compra={id}`
- `PATCH /api/compras/compra/{id}`
- `PATCH /api/compras/compra-detalle/{id}`

## 13. Nutrición overview
Ruta sugerida:

```txt
/app/nutricion
```

Objetivo:

- resumir la situación nutricional del usuario

Bloques sugeridos:

- meta activa
- peso más reciente
- consumos recientes
- CTA para registrar consumo
- CTA para registrar peso

## 14. Nutrición > Consumos
Ruta sugerida:

```txt
/app/nutricion/consumos
```

Objetivo:

- gestionar comidas y detalle consumido

Componentes:

- lista de consumos por fecha
- botón nuevo consumo
- acordeón o detalle expandible por consumo
- líneas de productos consumidos

Endpoints relacionados:

- `GET /api/nutricion/consumo/`
- `POST /api/nutricion/consumo/`
- `GET /api/nutricion/consumo-detalle/?id_consumo={id}`
- `POST /api/nutricion/consumo-detalle/`

## 15. Nutrición > Metas
Ruta sugerida:

```txt
/app/nutricion/metas
```

Objetivo:

- crear y administrar metas nutricionales

Componentes:

- meta activa destacada
- historial de metas
- formulario create/edit
- rango de fechas

Endpoints relacionados:

- `GET /api/nutricion/meta/`
- `POST /api/nutricion/meta/`
- `PATCH /api/nutricion/meta/{id}`
- `DELETE /api/nutricion/meta/{id}`

## 16. Nutrición > Peso
Ruta sugerida:

```txt
/app/nutricion/peso
```

Objetivo:

- llevar trazabilidad de peso

Componentes:

- gráfico de evolución
- tabla de registros
- formulario corto para nuevo peso

Endpoints relacionados:

- `GET /api/nutricion/peso/`
- `POST /api/nutricion/peso/`
- `PATCH /api/nutricion/peso/{id}`

## Vistas recomendadas para Panel Admin

El admin no debería copiar la UX del usuario. Debe enfocarse en mantenimiento, validación y control.

## 1. Dashboard admin
Ruta sugerida:

```txt
/admin
```

Objetivo:

- mostrar estado general del sistema
- servir como panel de operación

Bloques sugeridos:

- total de usuarios
- total de productos activos
- total de marcas
- total de gimnasios activos
- total de locales
- accesos rápidos a catálogos

## 2. Admin > Usuarios
Ruta sugerida:

```txt
/admin/usuarios
```

Objetivo:

- listar usuarios y ejecutar acciones administrativas

Componentes:

- tabla de usuarios
- filtros
- acción desactivar
- acción eliminar permanente
- detalle básico de perfil

Endpoints relacionados:

- `GET /api/usuarios/`
- `DELETE /api/usuarios/{id}`
- `DELETE /api/usuarios/{id}/permanente`

## 3. Admin > Bancos
Ruta sugerida:

```txt
/admin/bancos
```

Objetivo:

- administrar bancos del sistema

Componentes:

- tabla CRUD clásica
- formulario lateral
- búsqueda por nombre

Endpoints relacionados:

- `POST /api/finanzas/banco/`
- `PATCH /api/finanzas/banco/{id}`
- `DELETE /api/finanzas/banco/{id}`

## 4. Admin > Categorías financieras
Ruta sugerida:

```txt
/admin/categorias-finanzas
```

Objetivo:

- administrar categorías maestras para movimientos

Endpoints relacionados:

- `POST /api/finanzas/categoria/`
- `PATCH /api/finanzas/categoria/{id}`
- `DELETE /api/finanzas/categoria/{id}`

## 5. Admin > Gimnasios
Ruta sugerida:

```txt
/admin/gimnasios
```

Objetivo:

- mantener gimnasios disponibles para el módulo de entrenamiento

Componentes:

- tabla con nombre, cadena, comuna, estado
- mapa opcional o preview de coordenadas
- formulario create/edit

Endpoints relacionados:

- `POST /api/entrenamientos/gimnasio/`
- `PATCH /api/entrenamientos/gimnasio/{id}`
- `DELETE /api/entrenamientos/gimnasio/{id}`

## 6. Admin > Marcas
Ruta sugerida:

```txt
/admin/marcas
```

Objetivo:

- mantener marcas del catálogo

Endpoints relacionados:

- `POST /api/catalogo/marca/`
- `PATCH /api/catalogo/marca/{id}`
- `DELETE /api/catalogo/marca/{id}`

## 7. Admin > Productos
Ruta sugerida:

```txt
/admin/productos
```

Objetivo:

- mantener el catálogo central de productos

Componentes:

- tabla amplia con filtros
- búsqueda por nombre o código de barra
- estado activo/inactivo
- formulario completo con marca, categoría, sabor, formato y contenido

Endpoints relacionados:

- `POST /api/catalogo/producto/`
- `PATCH /api/catalogo/producto/{id}`
- `DELETE /api/catalogo/producto/{id}`

## 8. Admin > Cadenas
Ruta sugerida:

```txt
/admin/cadenas
```

Objetivo:

- administrar cadenas comerciales

Endpoints relacionados:

- `POST /api/compras/cadena/`
- `PATCH /api/compras/cadena/{id}`
- `DELETE /api/compras/cadena/{id}`

## 9. Admin > Locales
Ruta sugerida:

```txt
/admin/locales
```

Objetivo:

- administrar locales asociados a cadenas

Componentes:

- tabla con relación local-cadena
- dirección y coordenadas
- create/edit con selector de cadena

Endpoints relacionados:

- `POST /api/compras/local/`
- `PATCH /api/compras/local/{id}`
- `DELETE /api/compras/local/{id}`

## 10. Admin > Tablas nutricionales
Ruta sugerida:

```txt
/admin/tablas-nutricionales
```

Objetivo:

- asociar información nutricional a productos del catálogo

Componentes:

- tabla por producto
- create/edit con macros
- filtro por producto o marca

Endpoints relacionados:

- `POST /api/nutricion/tabla/`
- `PATCH /api/nutricion/tabla/{id}`
- `DELETE /api/nutricion/tabla/{id}`

## Resumen de separación User vs Admin

## Vistas de usuario
Estas son parte del uso cotidiano:

- dashboard personal
- perfil
- cuentas bancarias del usuario
- movimientos del usuario
- historial y sesión activa de entrenamientos
- compras del usuario
- consumos del usuario
- metas nutricionales del usuario
- registros de peso del usuario

## Vistas admin
Estas son de configuración o mantenimiento global:

- usuarios
- bancos
- categorías financieras
- gimnasios
- marcas
- productos
- cadenas
- locales
- tablas nutricionales

## Componentes reutilizables recomendados

Para mantener armonía, conviene construir un sistema de componentes compartidos.

### Base UI

- `AppShell`
- `Sidebar`
- `Topbar`
- `PageHeader`
- `StatCard`
- `DataTable`
- `EmptyState`
- `ConfirmDialog`
- `FormDrawer`
- `SearchInput`
- `FilterBar`
- `Badge`

### Componentes de dominio

- `AccountCard`
- `MovementRow`
- `WorkoutSessionCard`
- `SeriesEditor`
- `PurchaseDetailTable`
- `NutritionGoalCard`
- `WeightChart`
- `ProductPicker`

## Patrones UX recomendados

## 1. Crear en modal o drawer
Ideal para:

- marcas
- bancos
- categorías
- cadenas
- locales
- cuentas
- peso

## 2. Crear en página completa
Ideal para:

- nueva compra
- nuevo consumo con detalle
- iniciar entrenamiento y trabajar sesión activa
- edición avanzada de producto

## 3. Tablas con detalle expandible
Ideal para:

- compras
- consumos
- movimientos
- productos

## 4. Estados vacíos útiles
Muy importante en esta app, porque varios módulos empiezan sin datos.

Ejemplos:

- sin cuentas registradas
- sin movimientos
- sin compra registrada
- sin meta nutricional
- sin sesión activa

Cada empty state debería tener:

- una frase clara
- una acción principal
- una acción secundaria opcional

## Diseño recomendado por prioridad de implementación

## Fase 1: núcleo de app
Construir primero:

1. login
2. registro
3. app shell
4. dashboard usuario
5. perfil
6. finanzas: cuentas y movimientos
7. nutrición: consumos, metas y peso
8. compras: listado y nueva compra

## Fase 2: entrenamiento
Luego construir:

1. overview de entrenamientos
2. sesión activa
3. historial
4. integración con gimnasios

## Fase 3: admin
Después montar:

1. admin shell
2. usuarios
3. bancos
4. categorías
5. marcas
6. productos
7. cadenas
8. locales
9. gimnasios
10. tablas nutricionales

## Idea de diseño visual por pantalla

## Dashboard usuario
Sensación:

- calmada
- útil
- personal

Visual:

- tarjetas con color por dominio
- timeline de actividad
- CTA grandes y claros

## Finanzas
Sensación:

- orden
- control
- lectura rápida

Visual:

- tablas limpias
- colores semánticos para gasto e ingreso
- filtros visibles arriba

## Entrenamientos
Sensación:

- energía
- foco
- progreso

Visual:

- bloques contrastados
- estado activo muy visible
- botones grandes para agregar serie

## Compras
Sensación:

- registro práctico
- casi tipo checklist

Visual:

- filas editables
- subtotal y total visibles
- formularios compactos

## Nutrición
Sensación:

- seguimiento
- salud
- claridad

Visual:

- métricas, gráficos suaves y bloques resumidos
- fechas visibles
- colores ligeros y naturales

## Admin
Sensación:

- control
- consistencia
- mantenimiento confiable

Visual:

- tablas densas pero limpias
- filtros potentes
- acciones secundarias discretas

## Recomendación de arquitectura frontend

Separar por layout y por dominio.

Estructura sugerida:

```txt
src/
  app/
    public/
    user/
    admin/
  modules/
    auth/
    profile/
    finances/
    workouts/
    purchases/
    nutrition/
    catalog/
    admin/
  components/
    ui/
    shared/
  services/
    api/
  hooks/
  types/
```

## Conclusión

La app queda más armónica si se diseña como dos productos conectados:

- un `espacio personal` para registrar vida diaria
- un `espacio administrativo` para mantener catálogos y entidades maestras

La experiencia del usuario debería priorizar:

- rapidez para registrar
- claridad para revisar historial
- acceso inmediato a acciones frecuentes

La experiencia admin debería priorizar:

- mantenimiento de datos maestros
- control de estados
- visibilidad del sistema

## Próximo paso recomendado

A partir de este documento, el siguiente paso natural sería crear:

1. sitemap visual
2. wireframes low-fi por vista principal
3. design tokens base del frontend
4. backlog de pantallas por prioridad
