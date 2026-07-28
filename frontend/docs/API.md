# API Tracking WhatsApp

## Resumen

Esta API centraliza registros personales y operativos en varios dominios:

- autenticación
- usuarios
- finanzas
- entrenamientos
- catálogo
- compras
- nutrición
- lecturas

La aplicación expone documentación interactiva en:

- `/docs` para el menú principal de documentación
- `/docs/global` para el Swagger completo
- `/docs/{modulo}` para Swagger modular, por ejemplo `/docs/finanzas`
- `/openapi.json` para el schema global
- `/openapi/{modulo}.json` para schemas por módulo

Este archivo está pensado para ser más fácil de leer por una persona y también más fácil de parsear por una IA.

## Estado de esta documentación

Fuentes usadas para construir este documento:

- `docs/api.json`: snapshot OpenAPI existente del proyecto
- `app/routes/**`: fuente de verdad más actual sobre endpoints, permisos y comportamiento
- `app/schemas/**`: fuente de verdad sobre payloads de entrada y salida

Nota importante:

- `docs/api.json` no refleja todavía todos los módulos nuevos (`catalogo`, `compras`, `nutricion`).
- cuando exista diferencia entre este archivo y `docs/api.json`, prevalece el código en `app/routes` y `app/schemas`.

## Base URL

Prefijo principal de la API:

```txt
/api
```

Autenticación:

```txt
/auth
```

Ejemplos:

```txt
GET /api/usuarios/perfil
POST /auth/register
POST /auth/jwt/login
```

## Autenticación

La API usa JWT con `fastapi-users`.

### Flujo base

1. Registrar usuario con `POST /auth/register`
2. Iniciar sesión con `POST /auth/jwt/login`
3. Usar el token en el header `Authorization`

Header esperado:

```http
Authorization: Bearer <token>
```

### Endpoints de auth

#### `POST /auth/register`

Crea un usuario de autenticación y, según la lógica del proyecto, da soporte al perfil de usuario de la app.

Payload base:

```json
{
  "email": "tu-correo@gmail.com",
  "password": "TuClave123",
  "username": "tu_usuario",
  "nombre": "TuNombre",
  "apellido": "TuApellido",
  "telefono": "56912345678"
}
```

Campos esperados:

- `email`: correo válido
- `password`: entre 6 y 20 caracteres
- `username`: máximo 20 caracteres
- `nombre`: máximo 20 caracteres
- `apellido`: máximo 20 caracteres
- `telefono`: exactamente 11 dígitos numéricos

#### `POST /auth/jwt/login`

Inicia sesión y devuelve el token JWT.

#### Endpoints adicionales de auth

| Método | Ruta               | Descripción                                            |
| ------ | ------------------ | ------------------------------------------------------ |
| `POST` | `/auth/jwt/login`  | Inicia sesión y devuelve JWT                           |
| `POST` | `/auth/jwt/logout` | Endpoint expuesto por el router JWT de `fastapi-users` |
| `POST` | `/auth/register`   | Registra usuario                                       |

## Convenciones globales

### Formato general

- casi todos los recursos usan esquemas `Create`, `Patch/Edit` y `Response`
- las respuestas suelen venir serializadas con `from_attributes=True`
- la mayoría de los `DELETE` responden `204 No Content`
- los errores comunes usan `404`, `409`, `400` y `422`

### Permisos

Hay 3 patrones principales:

- `current_user`: cualquier usuario autenticado
- `current_superuser`: solo administrador
- ownership: el usuario solo puede ver o modificar sus propios datos en compras, nutrición, finanzas y entrenamientos

### Reglas prácticas

- recursos maestros o catálogos suelen estar restringidos a `superuser` para crear, editar o eliminar
- recursos personales suelen asignarse automáticamente al usuario autenticado y no requieren mandar `id_usuario`
- algunos deletes son lógicos y no físicos, por ejemplo `producto` y varias entidades de usuario/finanzas

## Módulos

### 1. Usuarios

Prefijo: `/api/usuarios`

#### Endpoints

| Método   | Ruta                                    | Auth      | Descripción                               |
| -------- | --------------------------------------- | --------- | ----------------------------------------- |
| `GET`    | `/api/usuarios/perfil`                  | usuario   | Obtiene el perfil del usuario autenticado |
| `PATCH`  | `/api/usuarios/perfil`                  | usuario   | Edita el perfil del usuario autenticado   |
| `GET`    | `/api/usuarios/`                        | superuser | Lista usuarios                            |
| `DELETE` | `/api/usuarios/{id_usuario}`            | superuser | Desactiva usuario                         |
| `DELETE` | `/api/usuarios/{id_usuario}/permanente` | superuser | Elimina usuario definitivamente           |

#### Payload útil

`PATCH /api/usuarios/perfil`

```json
{
  "username": "nuevo_usuario",
  "nombre": "NuevoNombre",
  "apellido": "NuevoApellido",
  "telefono": "56912345678",
  "email": "nuevo@mail.com"
}
```

#### Respuesta típica

```json
{
  "id_usuario": 1,
  "username": "fuco",
  "nombre": "Francisco",
  "apellido": "Arancibia",
  "telefono": "56912345678",
  "email": "correo@mail.com",
  "created_at": "2026-01-01T12:00:00",
  "is_superuser": false
}
```

### 2. Finanzas

Prefijo: `/api/finanzas`

Submódulos:

- `banco`
- `producto-financiero`
- `categoria`
- `cuentas`
- `movimientos`
- `analitica`

#### Bancos

| Método   | Ruta                             | Auth      | Descripción          |
| -------- | -------------------------------- | --------- | -------------------- |
| `GET`    | `/api/finanzas/banco/`           | usuario   | Lista bancos         |
| `GET`    | `/api/finanzas/banco/{id_banco}` | usuario   | Obtiene banco por ID |
| `POST`   | `/api/finanzas/banco/`           | superuser | Crea banco           |
| `PATCH`  | `/api/finanzas/banco/{id_banco}` | superuser | Edita banco          |
| `DELETE` | `/api/finanzas/banco/{id_banco}` | superuser | Elimina banco        |

Payload base:

```json
{
  "nombre_banco": "Santander"
}
```

#### Productos financieros

| Método   | Ruta                                                         | Auth      | Descripción                                                               |
| -------- | ------------------------------------------------------------ | --------- | ------------------------------------------------------------------------- |
| `GET`    | `/api/finanzas/producto-financiero/`                         | usuario   | Lista productos financieros, acepta `id_banco`, `q` e `incluir_inactivos` |
| `GET`    | `/api/finanzas/producto-financiero/{id_producto_financiero}` | usuario   | Obtiene producto financiero                                               |
| `POST`   | `/api/finanzas/producto-financiero/`                         | superuser | Crea producto financiero para un banco                                    |
| `PATCH`  | `/api/finanzas/producto-financiero/{id_producto_financiero}` | superuser | Edita producto financiero                                                 |
| `DELETE` | `/api/finanzas/producto-financiero/{id_producto_financiero}` | superuser | Desactiva producto si no tiene cuentas activas                            |

Payload base:

```json
{
  "id_banco": 1,
  "nombre_producto": "CuentaRUT",
  "descripcion": "Producto principal de BancoEstado"
}
```

#### Categorías financieras

| Método   | Ruta                                     | Auth      | Descripción              |
| -------- | ---------------------------------------- | --------- | ------------------------ |
| `GET`    | `/api/finanzas/categoria/`               | usuario   | Lista categorías         |
| `GET`    | `/api/finanzas/categoria/{id_categoria}` | usuario   | Obtiene categoría por ID |
| `POST`   | `/api/finanzas/categoria/`               | superuser | Crea categoría           |
| `PATCH`  | `/api/finanzas/categoria/{id_categoria}` | superuser | Edita categoría          |
| `DELETE` | `/api/finanzas/categoria/{id_categoria}` | superuser | Elimina categoría        |

Payload base:

```json
{
  "nombre": "comida"
}
```

#### Cuentas de usuario

| Método   | Ruta                                | Auth                | Descripción                                |
| -------- | ----------------------------------- | ------------------- | ------------------------------------------ |
| `GET`    | `/api/finanzas/cuentas/`            | usuario             | Lista las cuentas del usuario              |
| `GET`    | `/api/finanzas/cuentas/{id_cuenta}` | usuario + ownership | Obtiene cuenta de usuario y movimientos    |
| `POST`   | `/api/finanzas/cuentas/`            | usuario             | Crea una cuenta de usuario del autenticado |
| `PATCH`  | `/api/finanzas/cuentas/{id_cuenta}` | usuario + ownership | Edita cuenta                               |
| `DELETE` | `/api/finanzas/cuentas/{id_cuenta}` | usuario + ownership | Desactiva cuenta                           |

Payload create:

```json
{
  "id_producto_financiero": 1,
  "nombre_cuenta": "Cuenta principal"
}
```

Campos importantes:

- `id_producto_financiero`
- `nombre_cuenta`
- el producto financiero define el banco y el tipo comercial real de la cuenta
- ejemplos válidos dependen del catálogo cargado para cada banco: `CuentaRUT`, `Cuenta Corriente`, `CMR`, etc.

#### Movimientos

| Método  | Ruta                                        | Auth                           | Descripción                                                                                                                                          |
| ------- | ------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/api/finanzas/movimientos/`                | usuario                        | Lista movimientos del usuario a partir de sus cuentas, acepta `offset` y `limit`, ordena de más nuevo a más antiguo y devuelve `total_gasto_mensual` |
| `GET`   | `/api/finanzas/movimientos/{id_movimiento}` | usuario + ownership por cuenta | Obtiene movimiento por ID, incluyendo compras vinculadas si existen                                                                                  |
| `POST`  | `/api/finanzas/movimientos/`                | usuario                        | Crea movimiento                                                                                                                                      |
| `PATCH` | `/api/finanzas/movimientos/{id_movimiento}` | usuario + ownership por cuenta | Edita movimiento                                                                                                                                     |

Parámetros útiles para `GET /api/finanzas/movimientos/`:

- `offset`: paginación por desplazamiento, parte en `0`
- `limit`: cantidad máxima a devolver por página, por defecto `20`, máximo `100`

Comportamiento actual:

- siempre ordena por `created_at` descendente
- usa `id_transaccion` descendente como desempate
- `total_gasto_mensual` suma solo movimientos de tipo `gasto`
- ese total se calcula usando el mes actual en horario de Chile (`America/Santiago`), aunque el servidor corra en otra zona horaria

Respuesta base del listado:

```json
{
  "items": [
    {
      "id_transaccion": 15,
      "tipo_movimiento": "gasto",
      "tipo_gasto": "variable",
      "categoria": "comida",
      "nombre_cuenta": "Cuenta principal",
      "compras_vinculadas": [],
      "total_compras_vinculadas": 0,
      "diferencia_total_compras": 3500,
      "monto": 3500,
      "descripcion": "Compra en supermercado",
      "created_at": "2026-04-22T09:00:00"
    }
  ],
  "offset": 0,
  "limit": 20,
  "total_gasto_mensual": 245000
}
```

Payload create:

```json
{
  "id_categoria": 1,
  "id_cuenta": 1,
  "tipo_movimiento": "gasto",
  "tipo_gasto": "fijo",
  "monto": 3500,
  "descripcion": "Compra en supermercado",
  "created_at": "2026-01-03T18:37:18"
}
```

Enums usados:

- `tipo_movimiento`: `gasto`, `ingreso`
- `tipo_gasto`: `variable`, `fijo`

#### Analítica

| Método | Ruta                                              | Auth    | Descripción                                                                             |
| ------ | ------------------------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| `GET`  | `/api/finanzas/analitica/resumen`                 | usuario | Resume KPIs mensuales del usuario; acepta `year` y `month`                              |
| `GET`  | `/api/finanzas/analitica/tendencia-mensual`       | usuario | Devuelve tendencia de gastos e ingresos por mes; acepta `months`                        |
| `GET`  | `/api/finanzas/analitica/distribucion-categorias` | usuario | Distribuye montos del periodo por categoría; acepta `year`, `month` y `tipo_movimiento` |
| `GET`  | `/api/finanzas/analitica/distribucion-cuentas`    | usuario | Distribuye montos del periodo por cuenta; acepta `year`, `month` y `tipo_movimiento`    |

Parámetros útiles:

- `year`: año del periodo, opcional; por defecto usa el año actual de Chile
- `month`: mes del periodo, opcional; por defecto usa el mes actual de Chile
- `months`: cantidad de meses para tendencia, por defecto `6`, máximo `24`
- `tipo_movimiento`: `gasto` o `ingreso`; en distribuciones por defecto usa `gasto`

Notas de comportamiento:

- estos endpoints no devuelven `404` cuando el usuario no tiene movimientos; responden con ceros o listas vacías
- `proyeccion_gasto_fin_mes` solo se calcula para el mes actual en horario de Chile
- `variacion_gasto_vs_mes_anterior_pct` queda en `null` si el mes anterior no tuvo gasto

Respuesta base de `GET /api/finanzas/analitica/resumen`:

```json
{
  "year": 2026,
  "month": 4,
  "period_start": "2026-04-01T00:00:00",
  "period_end": "2026-05-01T00:00:00",
  "gasto_total": 245000,
  "ingreso_total": 850000,
  "balance_total": 605000,
  "gasto_fijo_total": 120000,
  "gasto_variable_total": 125000,
  "cantidad_movimientos": 18,
  "ticket_promedio_gasto": 17500,
  "gasto_mayor": 49990,
  "tasa_ahorro_pct": 71.18,
  "variacion_gasto_vs_mes_anterior": -35000,
  "variacion_gasto_vs_mes_anterior_pct": -12.5,
  "proyeccion_gasto_fin_mes": 312500
}
```

### 3. Entrenamientos

Prefijo: `/api/entrenamientos`

Submódulos:

- `ejercicios`
- `gimnasio`
- `fuerza`
- `series`

#### Ejercicios

| Método   | Ruta                                            | Auth      | Descripción                                    |
| -------- | ----------------------------------------------- | --------- | ---------------------------------------------- |
| `GET`    | `/api/entrenamientos/ejercicios/`               | usuario   | Lista ejercicios, acepta filtros `q` y `tipo`  |
| `GET`    | `/api/entrenamientos/ejercicios/musculos`       | usuario   | Lista los tipos musculares disponibles         |
| `GET`    | `/api/entrenamientos/ejercicios/{id_ejercicio}` | usuario   | Obtiene un ejercicio                           |
| `POST`   | `/api/entrenamientos/ejercicios/`               | superuser | Crea ejercicio                                 |
| `PATCH`  | `/api/entrenamientos/ejercicios/{id_ejercicio}` | superuser | Edita ejercicio                                |
| `DELETE` | `/api/entrenamientos/ejercicios/{id_ejercicio}` | superuser | Elimina ejercicio si no tiene series asociadas |

Payload create:

```json
{
  "nombre": "Press banca plano",
  "tipo": "pecho",
  "url_video": "https://youtube.com/ejemplo"
}
```

Enum importante de `Ejercicios.tipo`:

- `EnumMusculo`: `bicep`, `tricep`, `pecho`, `hombro`, `espalda`, `cuadricep`

Notas:

- el filtro `tipo` de `GET /api/entrenamientos/ejercicios/` usa esos mismos valores
- `GET /api/entrenamientos/ejercicios/musculos` expone esta lista de forma consumible para frontend

#### Gimnasios

| Método   | Ruta                                         | Auth      | Descripción                          |
| -------- | -------------------------------------------- | --------- | ------------------------------------ |
| `GET`    | `/api/entrenamientos/gimnasio/`              | usuario   | Lista gimnasios, acepta búsqueda `q` |
| `GET`    | `/api/entrenamientos/gimnasio/{id_gimnasio}` | usuario   | Detalle de gimnasio                  |
| `POST`   | `/api/entrenamientos/gimnasio/`              | superuser | Crea gimnasio                        |
| `PATCH`  | `/api/entrenamientos/gimnasio/{id_gimnasio}` | superuser | Edita gimnasio                       |
| `DELETE` | `/api/entrenamientos/gimnasio/{id_gimnasio}` | superuser | Desactiva gimnasio                   |

Payload create:

```json
{
  "nombre_gimnasio": "Smart Fit Oeste",
  "nombre_cadena": "Smart Fit",
  "direccion": "Av. Siempre Viva 123",
  "comuna": "Nunoa",
  "latitud": -33.456,
  "longitud": -70.648
}
```

#### Entrenamiento de fuerza

| Método  | Ruta                                                   | Auth                | Descripción                          |
| ------- | ------------------------------------------------------ | ------------------- | ------------------------------------ |
| `GET`   | `/api/entrenamientos/fuerza/`                          | usuario             | Lista sesiones de fuerza del usuario |
| `GET`   | `/api/entrenamientos/fuerza/activo`                    | usuario             | Devuelve la sesión activa con series |
| `GET`   | `/api/entrenamientos/fuerza/{id_entrenamiento_fuerza}` | usuario + ownership | Detalle de una sesión                |
| `POST`  | `/api/entrenamientos/fuerza/`                          | usuario             | Inicia una sesión de fuerza          |
| `PATCH` | `/api/entrenamientos/fuerza/activo/cerrar`             | usuario             | Cierra la sesión activa              |

Payload create:

```json
{
  "observacion": "Pierna y hombro",
  "id_gimnasio": 1
}
```

#### Series de fuerza

| Método   | Ruta                                             | Auth                       | Descripción                     |
| -------- | ------------------------------------------------ | -------------------------- | ------------------------------- |
| `POST`   | `/api/entrenamientos/series/`                    | usuario                    | Agrega serie a la sesión activa |
| `PATCH`  | `/api/entrenamientos/series/{id_fuerza_detalle}` | usuario + ownership activa | Edita serie                     |
| `DELETE` | `/api/entrenamientos/series/{id_fuerza_detalle}` | usuario + ownership activa | Elimina serie                   |

Payload create:

```json
{
  "id_ejercicio": 10,
  "es_calentamiento": false,
  "cantidad_peso": 60,
  "repeticiones": 8
}
```

### 4. Catálogo

Prefijo: `/api/catalogo`

Submódulos:

- `categoria-producto`
- `marca`
- `producto`
- `subcategoria-producto`

#### Categorías de producto

| Método   | Ruta                                              | Auth      | Descripción                                            |
| -------- | ------------------------------------------------- | --------- | ------------------------------------------------------ |
| `GET`    | `/api/catalogo/categoria-producto/`               | usuario   | Lista categorías de producto                           |
| `GET`    | `/api/catalogo/categoria-producto/{id_categoria}` | usuario   | Obtiene categoría de producto                          |
| `POST`   | `/api/catalogo/categoria-producto/`               | superuser | Crea categoría de producto                             |
| `PATCH`  | `/api/catalogo/categoria-producto/{id_categoria}` | superuser | Edita categoría de producto                            |
| `DELETE` | `/api/catalogo/categoria-producto/{id_categoria}` | superuser | Elimina categoría de producto si no tiene dependencias |

Payload create:

```json
{
  "nombre_categoria": "Lacteos"
}
```

Notas:

- no se puede eliminar una categoría si tiene subcategorías asociadas
- no se puede eliminar una categoría si tiene productos asociados

#### Marcas

| Método   | Ruta                             | Auth      | Descripción   |
| -------- | -------------------------------- | --------- | ------------- |
| `GET`    | `/api/catalogo/marca/`           | usuario   | Lista marcas  |
| `GET`    | `/api/catalogo/marca/{id_marca}` | usuario   | Obtiene marca |
| `POST`   | `/api/catalogo/marca/`           | superuser | Crea marca    |
| `PATCH`  | `/api/catalogo/marca/{id_marca}` | superuser | Edita marca   |
| `DELETE` | `/api/catalogo/marca/{id_marca}` | superuser | Elimina marca |

Payload create:

```json
{
  "nombre_marca": "Nestle"
}
```

#### Productos

| Método   | Ruta                                   | Auth      | Descripción        |
| -------- | -------------------------------------- | --------- | ------------------ |
| `GET`    | `/api/catalogo/producto/`              | usuario   | Lista productos    |
| `GET`    | `/api/catalogo/producto/{id_producto}` | usuario   | Obtiene producto   |
| `POST`   | `/api/catalogo/producto/`              | superuser | Crea producto      |
| `PATCH`  | `/api/catalogo/producto/{id_producto}` | superuser | Edita producto     |
| `DELETE` | `/api/catalogo/producto/{id_producto}` | superuser | Desactiva producto |

Payload create:

```json
{
  "id_marca": 1,
  "id_categoria": 2,
  "id_subcategoria": 7,
  "nombre_producto": "Yogurt protein",
  "codigo_barra": "7801234567890",
  "sabor": "Frutilla",
  "formato": "Botella",
  "contenido_neto": 350,
  "unidad_contenido": "ml",
  "activo": true
}
```

Notas:

- `codigo_barra` es único
- `categoria` y `subcategoria` ahora son entidades separadas en base de datos:
  - `catalogo.categoria_producto`
  - `catalogo.subcategoria_producto`
- `POST` y `PATCH` de producto validan:
  - que `id_categoria` exista (si se envía)
  - que `id_subcategoria` exista (si se envía)
  - que la subcategoría pertenezca a la categoría indicada
- si se envía solo `id_subcategoria`, la API completa automáticamente `id_categoria` usando la relación de la subcategoría
- en `PATCH`, si cambias la categoría sin enviar subcategoría, se limpia `id_subcategoria` para evitar inconsistencias
- el response de producto mantiene los campos `categoria` y `subcategoria` como nombres legibles (además de sus IDs)
- `DELETE` marca el producto como inactivo, no lo borra físicamente

#### Subcategorías de producto

| Método   | Ruta                                                    | Auth      | Descripción                                               |
| -------- | ------------------------------------------------------- | --------- | --------------------------------------------------------- |
| `GET`    | `/api/catalogo/subcategoria-producto/`                  | usuario   | Lista subcategorías de producto                           |
| `GET`    | `/api/catalogo/subcategoria-producto/{id_subcategoria}` | usuario   | Obtiene subcategoría de producto                          |
| `POST`   | `/api/catalogo/subcategoria-producto/`                  | superuser | Crea subcategoría de producto                             |
| `PATCH`  | `/api/catalogo/subcategoria-producto/{id_subcategoria}` | superuser | Edita subcategoría de producto                            |
| `DELETE` | `/api/catalogo/subcategoria-producto/{id_subcategoria}` | superuser | Elimina subcategoría de producto si no tiene dependencias |

Payload create:

```json
{
  "id_categoria": 2,
  "nombre_subcategoria": "Yogurt"
}
```

Notas:

- cada subcategoría pertenece a una categoría (`id_categoria`)
- el nombre de subcategoría es único dentro de su categoría
- no se puede eliminar una subcategoría si tiene productos asociados

### 5. Compras

Prefijo: `/api/compras`

Submódulos:

- `cadena`
- `local`
- `compra`
- `compra-detalle`

#### Cadenas

| Método   | Ruta                              | Auth      | Descripción    |
| -------- | --------------------------------- | --------- | -------------- |
| `GET`    | `/api/compras/cadena/`            | usuario   | Lista cadenas  |
| `GET`    | `/api/compras/cadena/{id_cadena}` | usuario   | Obtiene cadena |
| `POST`   | `/api/compras/cadena/`            | superuser | Crea cadena    |
| `PATCH`  | `/api/compras/cadena/{id_cadena}` | superuser | Edita cadena   |
| `DELETE` | `/api/compras/cadena/{id_cadena}` | superuser | Elimina cadena |

Payload create:

```json
{
  "nombre_cadena": "Lider"
}
```

#### Locales

| Método   | Ruta                            | Auth      | Descripción   |
| -------- | ------------------------------- | --------- | ------------- |
| `GET`    | `/api/compras/local/`           | usuario   | Lista locales |
| `GET`    | `/api/compras/local/{id_local}` | usuario   | Obtiene local |
| `POST`   | `/api/compras/local/`           | superuser | Crea local    |
| `PATCH`  | `/api/compras/local/{id_local}` | superuser | Edita local   |
| `DELETE` | `/api/compras/local/{id_local}` | superuser | Elimina local |

Payload create:

```json
{
  "id_cadena": 1,
  "nombre_local": "Lider Nunoa",
  "latitud": -33.456,
  "longitud": -70.648,
  "direccion": "Av. Ejemplo 123"
}
```

Notas:

- `id_cadena` ahora puede ser `null`
- esto permite registrar locales de barrio o comercios independientes sin cadena

#### Compras

| Método   | Ruta                              | Auth                | Descripción                                                                |
| -------- | --------------------------------- | ------------------- | -------------------------------------------------------------------------- |
| `GET`    | `/api/compras/compra/`            | usuario             | Lista compras del usuario                                                  |
| `GET`    | `/api/compras/compra/{id_compra}` | usuario + ownership | Obtiene compra con local, total y movimientos vinculados si existen        |
| `POST`   | `/api/compras/compra/`            | usuario             | Crea compra asociada al usuario autenticado                                |
| `POST`   | `/api/compras/compra/completa`    | usuario             | Crea compra, detalle y vínculo opcional a movimiento en una sola operación |
| `POST`   | `/api/compras/compra-completa/`   | usuario             | Alias del endpoint anterior; reutiliza la misma lógica                     |
| `PATCH`  | `/api/compras/compra/{id_compra}` | usuario + ownership | Edita compra                                                               |
| `DELETE` | `/api/compras/compra/{id_compra}` | usuario + ownership | Elimina compra                                                             |

Payload create:

```json
{
  "id_local": 1,
  "fecha_compra": "2026-04-18T16:30:00"
}
```

Payload compra completa:

```json
{
  "id_local": 1,
  "fecha_compra": "2026-04-18T16:30:00",
  "id_movimiento": 10,
  "monto_asociado": 2980,
  "detalles": [
    {
      "id_producto": 5,
      "cantidad_comprada": 1,
      "unidad_compra": "unidad",
      "precio_unitario": 2980,
      "precio_total": 2980,
      "cantidad_unidades": 1
    }
  ]
}
```

#### Vínculo movimiento-compra

| Método   | Ruta                                                    | Auth                | Descripción                                          |
| -------- | ------------------------------------------------------- | ------------------- | ---------------------------------------------------- |
| `GET`    | `/api/compras/movimiento-compra/?id_movimiento={id}`    | usuario + ownership | Lista vínculos de un movimiento                      |
| `GET`    | `/api/compras/movimiento-compra/?id_compra={id}`        | usuario + ownership | Lista vínculos de una compra                         |
| `POST`   | `/api/compras/movimiento-compra/`                       | usuario + ownership | Vincula una compra existente con un movimiento gasto |
| `DELETE` | `/api/compras/movimiento-compra/{id_movimiento_compra}` | usuario + ownership | Elimina el vínculo                                   |

Reglas:

- solo se pueden vincular movimientos de tipo `gasto`
- compra y movimiento deben pertenecer al mismo usuario
- no se permite duplicar el mismo par `movimiento + compra`

#### Detalle de compra

| Método   | Ruta                                                 | Auth                | Descripción                  |
| -------- | ---------------------------------------------------- | ------------------- | ---------------------------- |
| `GET`    | `/api/compras/compra-detalle/?id_compra={id_compra}` | usuario + ownership | Lista detalles de una compra |
| `GET`    | `/api/compras/compra-detalle/{id_detalle}`           | usuario + ownership | Obtiene detalle por ID       |
| `POST`   | `/api/compras/compra-detalle/`                       | usuario + ownership | Crea detalle                 |
| `PATCH`  | `/api/compras/compra-detalle/{id_detalle}`           | usuario + ownership | Edita detalle                |
| `DELETE` | `/api/compras/compra-detalle/{id_detalle}`           | usuario + ownership | Elimina detalle              |

Payload create:

```json
{
  "id_compra": 1,
  "id_producto": 10,
  "cantidad_comprada": 2,
  "unidad_compra": "unidad",
  "precio_unitario": 1490,
  "precio_total": 2980,
  "cantidad_unidades": 2
}
```

### 6. Nutrición

Prefijo: `/api/nutricion`

Submódulos:

- `consumo`
- `consumo-detalle`
- `meta`
- `peso`
- `tabla`

#### Consumos

| Método   | Ruta                                  | Auth                | Descripción                |
| -------- | ------------------------------------- | ------------------- | -------------------------- |
| `GET`    | `/api/nutricion/consumo/`             | usuario             | Lista consumos del usuario |
| `GET`    | `/api/nutricion/consumo/{id_consumo}` | usuario + ownership | Obtiene consumo            |
| `POST`   | `/api/nutricion/consumo/`             | usuario             | Crea consumo               |
| `PATCH`  | `/api/nutricion/consumo/{id_consumo}` | usuario + ownership | Edita consumo              |
| `DELETE` | `/api/nutricion/consumo/{id_consumo}` | usuario + ownership | Elimina consumo            |

Payload create:

```json
{
  "fecha_consumo": "2026-04-18T14:00:00",
  "tipo_comida": "almuerzo",
  "observacion": "Comi fuera de casa"
}
```

#### Detalle de consumo

| Método   | Ruta                                                      | Auth                | Descripción                 |
| -------- | --------------------------------------------------------- | ------------------- | --------------------------- |
| `GET`    | `/api/nutricion/consumo-detalle/?id_consumo={id_consumo}` | usuario + ownership | Lista detalle de un consumo |
| `GET`    | `/api/nutricion/consumo-detalle/{id_consumo_detalle}`     | usuario + ownership | Obtiene detalle             |
| `POST`   | `/api/nutricion/consumo-detalle/`                         | usuario + ownership | Crea detalle                |
| `PATCH`  | `/api/nutricion/consumo-detalle/{id_consumo_detalle}`     | usuario + ownership | Edita detalle               |
| `DELETE` | `/api/nutricion/consumo-detalle/{id_consumo_detalle}`     | usuario + ownership | Elimina detalle             |

Payload create:

```json
{
  "id_consumo": 1,
  "id_producto": 10,
  "cantidad_consumida": 1,
  "unidad_consumida": "porcion"
}
```

#### Metas nutricionales

| Método   | Ruta                            | Auth                | Descripción             |
| -------- | ------------------------------- | ------------------- | ----------------------- |
| `GET`    | `/api/nutricion/meta/`          | usuario             | Lista metas del usuario |
| `GET`    | `/api/nutricion/meta/{id_meta}` | usuario + ownership | Obtiene meta            |
| `POST`   | `/api/nutricion/meta/`          | usuario             | Crea meta               |
| `PATCH`  | `/api/nutricion/meta/{id_meta}` | usuario + ownership | Edita meta              |
| `DELETE` | `/api/nutricion/meta/{id_meta}` | usuario + ownership | Elimina meta            |

Payload create:

```json
{
  "fecha_inicio": "2026-04-18",
  "fecha_fin": "2026-05-18",
  "calorias_objetivo": 2200,
  "proteinas_objetivo": 160,
  "carbohidratos_objetivo": 220,
  "grasas_objetivo": 70
}
```

#### Registro de peso

| Método   | Ruta                            | Auth                | Descripción             |
| -------- | ------------------------------- | ------------------- | ----------------------- |
| `GET`    | `/api/nutricion/peso/`          | usuario             | Lista registros de peso |
| `GET`    | `/api/nutricion/peso/{id_peso}` | usuario + ownership | Obtiene registro        |
| `POST`   | `/api/nutricion/peso/`          | usuario             | Crea registro de peso   |
| `PATCH`  | `/api/nutricion/peso/{id_peso}` | usuario + ownership | Edita registro          |
| `DELETE` | `/api/nutricion/peso/{id_peso}` | usuario + ownership | Elimina registro        |

Payload create:

```json
{
  "fecha_registro": "2026-04-18",
  "peso_kg": 78.4
}
```

#### Tabla nutricional

| Método   | Ruta                              | Auth      | Descripción                |
| -------- | --------------------------------- | --------- | -------------------------- |
| `GET`    | `/api/nutricion/tabla/`           | usuario   | Lista tablas nutricionales |
| `GET`    | `/api/nutricion/tabla/{id_tabla}` | usuario   | Obtiene tabla              |
| `POST`   | `/api/nutricion/tabla/`           | superuser | Crea tabla nutricional     |
| `PATCH`  | `/api/nutricion/tabla/{id_tabla}` | superuser | Edita tabla nutricional    |
| `DELETE` | `/api/nutricion/tabla/{id_tabla}` | superuser | Elimina tabla nutricional  |

Payload create:

```json
{
  "id_producto": 10,
  "porcion_cantidad": 30,
  "porcion_unidad": "g",
  "calorias": 120,
  "proteinas": 24,
  "carbohidratos": 3,
  "grasas": 1,
  "azucares": 2,
  "sodio": 80,
  "fibra": 0
}
```

### 7. Lecturas

Prefijo: `/api/lecturas`

Estado actual del módulo:

- existen routers base para `libros` y `registro`
- hoy actúan más como estructura del módulo que como API funcional completa
- no se observan endpoints implementados dentro de esos routers en el código actual

Rutas base del módulo:

- `/api/lecturas/libros`
- `/api/lecturas/registro`

## Payloads de referencia por recurso

Esta sección resume los cuerpos más comunes para IA y automatizaciones.

### Auth register

```json
{
  "email": "user@mail.com",
  "password": "Secret123",
  "username": "usuario",
  "nombre": "Nombre",
  "apellido": "Apellido",
  "telefono": "56912345678"
}
```

### Usuario patch

```json
{
  "username": "nuevo_user",
  "nombre": "Nuevo",
  "apellido": "Nombre",
  "telefono": "56912345678",
  "email": "nuevo@mail.com"
}
```

### Cuenta usuario create

```json
{
  "id_producto_financiero": 1,
  "nombre_cuenta": "Cuenta sueldo"
}
```

Notas:

- `movimiento` ya no guarda `id_usuario` directo
- el ownership se resuelve por `id_cuenta`, porque cada cuenta pertenece a un único usuario
- cambiar de cuenta en un `PATCH` solo permite cuentas activas del mismo usuario autenticado

### Producto financiero create

```json
{
  "id_banco": 1,
  "nombre_producto": "CMR",
  "descripcion": "Tarjeta y linea comercial de Falabella"
}
```

### Movimiento create

```json
{
  "id_categoria": 1,
  "id_cuenta": 1,
  "tipo_movimiento": "gasto",
  "tipo_gasto": "variable",
  "monto": 15990,
  "descripcion": "Compra farmacia"
}
```

### Gimnasio create

```json
{
  "nombre_gimnasio": "Energy",
  "nombre_cadena": "Energy Club",
  "direccion": "Calle 123",
  "comuna": "Providencia",
  "latitud": -33.42,
  "longitud": -70.61
}
```

### Fuerza create

```json
{
  "observacion": "Pecho y triceps",
  "id_gimnasio": 1
}
```

### Serie fuerza create

```json
{
  "id_ejercicio": 4,
  "es_calentamiento": false,
  "cantidad_peso": 80,
  "repeticiones": 6
}
```

### Ejercicio create

```json
{
  "nombre": "Remo con barra",
  "tipo": "espalda",
  "url_video": "https://youtube.com/ejemplo"
}
```

### Marca create

```json
{
  "nombre_marca": "Soprole"
}
```

### Categoria producto create

```json
{
  "nombre_categoria": "Lacteos"
}
```

### Producto create

```json
{
  "id_marca": 1,
  "id_categoria": 2,
  "id_subcategoria": 7,
  "nombre_producto": "Leche protein",
  "codigo_barra": "7801111111111",
  "sabor": "Chocolate",
  "formato": "Caja",
  "contenido_neto": 330,
  "unidad_contenido": "ml",
  "activo": true
}
```

### Subcategoria producto create

```json
{
  "id_categoria": 2,
  "nombre_subcategoria": "Leche"
}
```

### Compra create

```json
{
  "id_local": 1,
  "fecha_compra": "2026-04-18T10:15:00"
}
```

### Compra detalle create

```json
{
  "id_compra": 1,
  "id_producto": 5,
  "cantidad_comprada": 1,
  "unidad_compra": "unidad",
  "precio_unitario": 2390,
  "precio_total": 2390,
  "cantidad_unidades": 1
}
```

### Consumo create

```json
{
  "fecha_consumo": "2026-04-18T13:00:00",
  "tipo_comida": "desayuno",
  "observacion": "Rapido antes de salir"
}
```

### Consumo detalle create

```json
{
  "id_consumo": 1,
  "id_producto": 5,
  "cantidad_consumida": 1,
  "unidad_consumida": "unidad"
}
```

### Meta nutricional create

```json
{
  "fecha_inicio": "2026-04-18",
  "fecha_fin": "2026-06-18",
  "calorias_objetivo": 2400,
  "proteinas_objetivo": 180,
  "carbohidratos_objetivo": 250,
  "grasas_objetivo": 70
}
```

### Peso usuario create

```json
{
  "fecha_registro": "2026-04-18",
  "peso_kg": 79.3
}
```

### Tabla nutricional create

```json
{
  "id_producto": 5,
  "porcion_cantidad": 30,
  "porcion_unidad": "g",
  "calorias": 120,
  "proteinas": 25,
  "carbohidratos": 2,
  "grasas": 1,
  "azucares": 1,
  "sodio": 90,
  "fibra": 0
}
```

## Respuestas y errores comunes

### Códigos frecuentes

- `200 OK`: lectura o actualización exitosa
- `201 Created`: creación exitosa
- `204 No Content`: eliminación o desactivación exitosa
- `400 Bad Request`: payload vacío o inválido para la operación
- `401 Unauthorized`: falta token o es inválido
- `403 Forbidden`: el usuario no tiene permisos suficientes
- `404 Not Found`: recurso no existe o no pertenece al usuario
- `409 Conflict`: duplicado o regla de negocio violada
- `422 Unprocessable Entity`: validación de esquema falló

Excepciones actuales a considerar:

- `GET /api/finanzas/movimientos/` responde `404` si el usuario no tiene movimientos registrados

Notas recientes:

- `GET /api/finanzas/movimientos/` ya no devuelve una lista directa; ahora responde un objeto con `items`, `offset`, `limit` y `total_gasto_mensual`

### Ejemplo de error

```json
{
  "detail": "Producto no encontrado"
}
```

## Notas para integraciones con IA

Sugerencias para agentes o automatizaciones:

- asumir que todos los recursos personales usan ownership, incluso si el `id` existe
- no enviar `id_usuario` en compras, consumos, metas, peso, cuentas o movimientos cuando la API lo calcula desde el token
- tratar `DELETE` de `producto`, `usuario` y algunas entidades financieras como desactivación lógica cuando el modelo lo indique
- usar `PATCH` solo con los campos que realmente cambian
- verificar duplicados antes de crear si el flujo depende de `codigo_barra`, `nombre_marca`, `nombre_cadena`, `nombre_banco`, `nombre_cuenta` o `username`

## Mapa rápido de prefijos

```txt
/auth
/api/usuarios
/api/finanzas
/api/entrenamientos
/api/catalogo
/api/compras
/api/nutricion
/api/lecturas
```

## Archivos fuente relacionados

- `app/main.py`
- `app/routes/__init__.py`
- `app/auth/routes.py`
- `app/routes/**`
- `app/schemas/**`
- `docs/api.json`
