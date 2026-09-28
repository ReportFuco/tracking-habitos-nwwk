"""Servidor MCP de Ritmo, expuesto en /mcp dentro de la misma app FastAPI.

Transporte Streamable HTTP en modo stateless con respuestas JSON: cada request es
independiente, asi que funciona con varios workers de gunicorn sin sesiones pegajosas
ni streams SSE de larga duracion pasando por nginx.
"""
from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from starlette.types import ASGIApp

from app import settings
from app.mcp.auth import ApiKeyAuthMiddleware
from app.mcp.tools.finanzas import registrar_herramientas_finanzas


MCP_PATH = "/mcp"

INSTRUCCIONES = """\
Servidor de finanzas personales de Ritmo: cuentas, categorías, movimientos y analítica
del usuario dueño de la API key.

- Leer requiere el permiso finanzas:read; registrar, editar y eliminar movimientos
  requiere finanzas:write. Si una herramienta responde que falta un permiso, díselo al
  usuario en vez de reintentar.
- Montos en pesos chilenos (CLP), enteros y siempre positivos; el signo lo da
  tipo_movimiento ('gasto' o 'ingreso').
- Fechas y meses en calendario de Chile (America/Santiago). Sin year/month, las
  herramientas usan el mes en curso.
- Para preguntas de totales, comparaciones o "en qué gasto más", prefiere resumen_mes,
  distribucion_por_categoria, distribucion_por_cuenta, tendencia_mensual y gasto_diario:
  ya vienen agregadas. buscar_movimientos es para ver movimientos puntuales.
- Si el usuario nombra una cuenta o categoría, resuelve su id con listar_cuentas o
  listar_categorias antes de filtrar o registrar.
- Al registrar, genera un client_request_id (UUID) y reutilízalo si reintentas la misma
  llamada. Antes de eliminar un movimiento, confirma con el usuario.
"""


def crear_servidor_mcp() -> MCPServer:
    servidor = MCPServer(
        name="ritmo-finanzas",
        title="Ritmo · Finanzas",
        instructions=INSTRUCCIONES,
        version=settings.VERSION_API,
        # El SDK configura logging raiz con este nivel; WARNING evita duplicar el log de
        # requests que ya hace loguru.
        log_level="WARNING",
    )
    registrar_herramientas_finanzas(servidor)
    return servidor


def crear_app_mcp(servidor: MCPServer) -> ASGIApp:
    """App ASGI del endpoint MCP. El session manager del servidor debe estar corriendo
    (``servidor.session_manager.run()``) mientras reciba requests."""
    app = servidor.streamable_http_app(
        streamable_http_path=MCP_PATH,
        stateless_http=True,
        json_response=True,
        # La proteccion contra DNS rebinding apunta a servidores locales sin auth que
        # confian en el navegador. Aqui toda request exige una API key explicita en un
        # header (nunca cookies), que un sitio ajeno no puede adjuntar.
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )
    return ApiKeyAuthMiddleware(app)
