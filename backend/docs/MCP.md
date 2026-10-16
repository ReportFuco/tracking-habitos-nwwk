# Servidor MCP (finanzas y entrenamientos)

El backend expone un servidor [MCP](https://modelcontextprotocol.io) en `POST /mcp`
(producción: `https://api.fucolabs.dev/mcp`) para que un LLM consulte las finanzas del
usuario y registre, edite o elimine movimientos, y para que revise sus entrenamientos y le
deje notas de seguimiento que se leen en la app, según los permisos de la conexión.

- Transporte Streamable HTTP, modo stateless con respuestas JSON: sin sesiones, funciona
  con varios workers de gunicorn y no requiere cambios en nginx.
- SDK oficial `mcp` 2.x (`MCPServer`). Código en `app/mcp/`; las herramientas llaman a
  `app/services/finanzas/`, la misma lógica que usa la API REST.

## Autenticación y permisos

Dos formas de conectarse, con los mismos permisos:

- **OAuth 2.1** (Claude.ai, ChatGPT y cualquier cliente que lo soporte): el cliente solo
  necesita la URL del servidor. Descubre el resto solo, el usuario aprueba en la app y
  puede revocar la conexión desde Perfil. Ver "OAuth" abajo.
- **API key** (Claude Code, Cursor, scripts): una clave fija en un header.

### API keys

Usa las API keys de `/auth/api-keys`. Se crean y revocan desde la app en **Perfil >
Conexiones con IA** (el secreto se muestra una sola vez). El cliente la manda como
`Authorization: Bearer thw_...` o `X-API-Key: thw_...`. Sin key, o con una revocada,
responde 401.

Cada key tiene scopes (`app/auth/scopes.py`):

| Scope | MCP | API REST |
|---|---|---|
| `finanzas:read` | herramientas de lectura de finanzas | `GET` en `/api/finanzas/**` |
| `finanzas:write` | además registrar, editar y eliminar | todo `/api/finanzas/**` |
| `entrenamientos:read` | sesiones, progreso, carga muscular, notas | `GET` en `/api/entrenamientos/**` |
| `entrenamientos:write` | además publicar y eliminar notas de seguimiento | todo `/api/entrenamientos/**` |
| `*` | todo | toda la API (lo que tenían las keys antes de los scopes) |

Escribir en un módulo incluye leerlo, pero no da acceso a otro módulo. La pantalla de
autorización y la creación de claves eligen el permiso módulo por módulo.

Una key nueva sin scopes explícitos queda en `finanzas:read`. La migración
`c80365289c96` dejó las keys existentes en `*`. Sin el scope necesario, la API REST
responde 403 y la herramienta MCP devuelve un error que el LLM le explica al usuario.

### OAuth

La API es a la vez servidor de autorización (emisor `URL_API`) y recurso protegido
(`URL_API/mcp`). Los endpoints de protocolo son los del SDK de MCP (`create_auth_routes`),
que validan PKCE S256, `redirect_uri` y scopes; `app/mcp/oauth.py` implementa el
almacenamiento y la emisión.

1. Sin credencial, `/mcp` responde 401 con `WWW-Authenticate: Bearer resource_metadata=...`.
2. `/.well-known/oauth-protected-resource/mcp` (RFC 9728) apunta al emisor, y
   `/.well-known/oauth-authorization-server` (RFC 8414) publica los endpoints.
3. `POST /register`: registro dinámico abierto (RFC 7591). `redirect_uris` https, o http
   solo hacia localhost. Limitado a 10 registros por hora por IP y 50 en total (429 con
   `Retry-After`), contado en la BD para que valga entre workers; cada registro borra los
   clientes de más de 7 días que nadie autorizó.
4. `GET /authorize` firma la solicitud y redirige a `URL_SITE/app/conexiones/autorizar`,
   donde el usuario (con su sesión) elige solo lectura o lectura y escritura.
5. Al aprobar (`/auth/oauth/solicitud/aprobar`) se crea una autorización y un código de un
   solo uso (5 min) que el cliente canjea en `POST /token` por un access token (1 h,
   `rtm_at_...`) y un refresh token (30 días, `rtm_rt_...`, rotativo).

Codigos y tokens se guardan hasheados (`auth.oauth_*`). Presentar un refresh token ya
rotado revoca la autorización entera. Un token emitido para otro `resource` (RFC 8707) se
rechaza. Las apps conectadas se listan y revocan en Perfil (`/auth/oauth/conexiones`).

`URL_API` debe ser la URL pública exacta (en producción `https://api.fucolabs.dev`): es
el `issuer` que los clientes comparan carácter a carácter.

## Herramientas

| Herramienta | Qué devuelve |
|---|---|
| `listar_cuentas` | Cuentas activas: id, nombre, producto, banco |
| `listar_categorias` | Categorías: id, nombre |
| `buscar_movimientos` | Movimientos con filtros (año, mes, tipo, categoría, cuenta, texto) y paginación |
| `resumen_mes` | Gasto, ingreso, balance, fijo/variable, ahorro, variación y proyección |
| `tendencia_mensual` | Últimos N meses |
| `distribucion_por_categoria` | Total y % por categoría en un mes |
| `distribucion_por_cuenta` | Total y % por cuenta en un mes |
| `gasto_diario` | Gasto/ingreso por día del mes |
| `registrar_movimiento` | Crea un gasto o ingreso (idempotente con `client_request_id`) |
| `editar_movimiento` | Cambia solo los campos enviados |
| `eliminar_movimiento` | Borra un movimiento (marcada como destructiva) |
| `listar_deudas` | Deudas con monto total, abonado, saldo y estado, más totales pendientes |
| `crear_deuda` / `editar_deuda` / `eliminar_deuda` | Deudas `debo` o `me_deben`; se abonan con movimientos que llevan `id_deuda` |
| `previsualizar_importacion` | Revisa una cartola normalizada sin guardar: nuevas, ya importadas, posibles duplicados e inválidas |
| `importar_movimientos` | Importa la cartola en una transacción (todo o nada) |
| `listar_importaciones` / `deshacer_importacion` | Cargas anteriores y su reversión completa |

### Entrenamientos

| Herramienta | Qué devuelve |
|---|---|
| `listar_sesiones_fuerza` | Sesiones con fecha, duración, gimnasio, series, ejercicios y zonas |
| `detalle_sesion_fuerza` | Series de una sesión (peso, reps, negativas, calentamiento) |
| `buscar_ejercicios` | Catálogo por nombre, músculo o equipamiento |
| `progreso_ejercicio` | Por sesión: mejor peso, 1RM estimado (Epley), series y tonelaje |
| `resumen_semanal_fuerza` | Sesiones, series y tonelaje por semana (lunes a domingo) |
| `carga_muscular` | Series efectivas por zona, nivel y tonelaje (`7d` o `semana`) |
| `listar_seguimientos` | Notas ya publicadas |
| `publicar_seguimiento` / `eliminar_seguimiento` | Notas (seguimiento, sugerencia, alerta, plan) que el usuario ve en Entrenamientos > Seguimiento |

La carga muscular (`app/services/entrenamientos/carga.py`) cuenta *series efectivas*: 1
por serie de trabajo para el músculo principal y 0,5 para cada secundario del catálogo;
los calentamientos no cuentan. El tonelaje solo va al principal y, con mancuernas, el peso
(anotado por mancuerna) cuenta doble. Niveles: bajo < 4, moderado 4-10, óptimo 10-20,
alto > 20. Es lo mismo que pinta el mapa del cuerpo de la app
(`GET /api/entrenamientos/carga-muscular`).

Cada nota guarda como `origen` el nombre de la API key o de la app OAuth que la escribió.

Crear, editar, eliminar e importar requieren `finanzas:write` (ver el listado completo en
`app/mcp/tools/`). Montos en CLP enteros; fechas en calendario de Chile (una fecha con
zona horaria se convierte).

La carga masiva existe solo por MCP: el modelo lee el Excel del banco, lo normaliza a
filas (`FilaImportacion`) y asigna categorías. Cada fila recibe un `client_request_id`
determinista (UUID5 de usuario, cuenta, fecha, tipo, monto y glosa original), así que
subir cartolas que se solapan no duplica movimientos.

## Conectar un cliente

Claude Code:

```bash
claude mcp add --transport http ritmo https://api.fucolabs.dev/mcp \
  --header "Authorization: Bearer thw_xxxxx"
```

Claude.ai y ChatGPT: agregar un conector personalizado con la URL
`https://api.fucolabs.dev/mcp` y autorizarlo en la pantalla que abre Ritmo. Claude Code
también puede usar OAuth: `claude mcp add --transport http ritmo <url>` sin
header, y autenticar desde `/mcp`.

Clientes con configuración JSON (Claude Desktop, Cursor, etc.) con API key: URL
`https://api.fucolabs.dev/mcp` y header `Authorization: Bearer thw_xxxxx`.

En local, la URL es `http://<host>:8000/mcp`.

## Tests

`tests/test_mcp_finanzas.py`, `tests/test_api_key_scopes.py`, `tests/test_mcp_oauth.py` y `tests/test_entrenamientos_seguimiento*.py`
(este último incluye el flujo completo con el cliente OAuth oficial del SDK). Los que no
tocan la BD corren siempre; el resto necesita
la base `*_test` y `RUN_DB_TESTS=1`, igual que `test_finanzas_movimientos_db.py`.
