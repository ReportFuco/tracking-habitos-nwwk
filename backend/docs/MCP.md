# Servidor MCP (finanzas)

El backend expone un servidor [MCP](https://modelcontextprotocol.io) en `POST /mcp`
(producción: `https://api.fucolabs.dev/mcp`) para que un LLM consulte las finanzas del
usuario y registre, edite o elimine movimientos, según los permisos de su API key.

- Transporte Streamable HTTP, modo stateless con respuestas JSON: sin sesiones, funciona
  con varios workers de gunicorn y no requiere cambios en nginx.
- SDK oficial `mcp` 2.x (`MCPServer`). Código en `app/mcp/`; las herramientas llaman a
  `app/services/finanzas/`, la misma lógica que usa la API REST.

## Autenticación y permisos

Usa las API keys de `/auth/api-keys`. Se crean y revocan desde la app en **Perfil >
Conexiones con IA** (el secreto se muestra una sola vez). El cliente la manda como
`Authorization: Bearer thw_...` o `X-API-Key: thw_...`. Sin key, o con una revocada,
responde 401.

Cada key tiene scopes (`app/auth/scopes.py`):

| Scope | MCP | API REST |
|---|---|---|
| `finanzas:read` | herramientas de lectura | `GET` en `/api/finanzas/**` |
| `finanzas:write` | además registrar, editar y eliminar | todo `/api/finanzas/**` |
| `*` | todo | toda la API (lo que tenían las keys antes de los scopes) |

Una key nueva sin scopes explícitos queda en `finanzas:read`. La migración
`c80365289c96` dejó las keys existentes en `*`. Sin el scope necesario, la API REST
responde 403 y la herramienta MCP devuelve un error que el LLM le explica al usuario.

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

Las tres últimas requieren `finanzas:write`. Montos en CLP enteros; fechas en calendario
de Chile (una fecha con zona horaria se convierte).

## Conectar un cliente

Claude Code:

```bash
claude mcp add --transport http ritmo-finanzas https://api.fucolabs.dev/mcp \
  --header "Authorization: Bearer thw_xxxxx"
```

Clientes con configuración JSON (Claude Desktop, Cursor, etc.): URL
`https://api.fucolabs.dev/mcp` y header `Authorization: Bearer thw_xxxxx`. Los conectores
web de Claude.ai y ChatGPT normalmente exigen OAuth, que todavía no está implementado.

En local, la URL es `http://<host>:8000/mcp`.

## Tests

`tests/test_mcp_finanzas.py`. Los de auth sin credencial corren siempre; el resto necesita
la base `*_test` y `RUN_DB_TESTS=1`, igual que `test_finanzas_movimientos_db.py`.
