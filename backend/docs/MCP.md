# Servidor MCP (finanzas)

El backend expone un servidor [MCP](https://modelcontextprotocol.io) en `POST /mcp`
(producción: `https://api.fucolabs.dev/mcp`) para que un LLM consulte las finanzas del
usuario. Por ahora es **solo lectura**.

- Transporte Streamable HTTP, modo stateless con respuestas JSON: sin sesiones, funciona
  con varios workers de gunicorn y no requiere cambios en nginx.
- SDK oficial `mcp` 2.x (`MCPServer`). Código en `app/mcp/`; las herramientas llaman a
  `app/services/finanzas/`, la misma lógica que usa la API REST.

## Autenticación

Usa las API keys de `POST /auth/api-keys` (se muestran una sola vez al crearlas). El
cliente la manda como `Authorization: Bearer thw_...` o `X-API-Key: thw_...`. Sin key, o
con una revocada, responde 401. Hoy una key da acceso completo a la API REST del usuario;
para el MCP conviene crear una dedicada y revocarla si se filtra.

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

Montos en CLP enteros; fechas en calendario de Chile.

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
