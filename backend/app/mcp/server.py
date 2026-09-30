"""Servidor MCP de Ritmo, expuesto en /mcp dentro de la misma app FastAPI.

Transporte Streamable HTTP en modo stateless con respuestas JSON: cada request es
independiente, asi que funciona con varios workers de gunicorn sin sesiones pegajosas
ni streams SSE de larga duracion pasando por nginx.
"""
from mcp.server.auth.routes import create_auth_routes, create_protected_resource_routes
from mcp.server.auth.settings import ClientRegistrationOptions, RevocationOptions
from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import AnyHttpUrl, ConfigDict, TypeAdapter
from starlette.routing import Route
from starlette.types import ASGIApp

from app import settings
from app.mcp.auth import McpAuthMiddleware
from app.mcp.oauth import SCOPES_OAUTH, LimiteRegistroMiddleware, RitmoOAuthProvider
from app.mcp.urls import ISSUER_URL, MCP_PATH, MCP_URL
from app.mcp.tools.finanzas import registrar_herramientas_finanzas


INSTRUCCIONES = """\
Servidor de finanzas personales de Ritmo: cuentas, categorías, movimientos, productos
comprados y analítica del usuario que autorizó esta conexión.

- Leer requiere el permiso finanzas:read; registrar, editar y eliminar (movimientos,
  categorías, productos) requiere finanzas:write. Si una herramienta responde que falta un permiso, díselo al
  usuario en vez de reintentar.
- Montos en pesos chilenos (CLP), enteros y siempre positivos; el signo lo da
  tipo_movimiento ('gasto' o 'ingreso').
- Fechas y meses en calendario de Chile (America/Santiago). Sin year/month, las
  herramientas usan el mes en curso.
- Para preguntas de totales, comparaciones o "en qué gasto más", prefiere resumen_mes,
  distribucion_por_categoria, distribucion_por_cuenta, tendencia_mensual y gasto_diario:
  ya vienen agregadas. buscar_movimientos es para ver movimientos puntuales.
- Si el usuario nombra una cuenta o categoría, resuelve su id con listar_cuentas o
  listar_categorias antes de filtrar o registrar. Hay categorías por defecto y propias
  del usuario; si ninguna calza, ofrece crear una con crear_categoria.
- Para detallar qué se compró en un gasto: busca cada producto con buscar_productos y
  agrégalo con agregar_producto_a_gasto. Si no existe, solo un administrador puede
  crearlo con crear_producto; a un usuario normal dile que lo pida a un administrador.
  Busca antes por nombre y por marca para no duplicar productos.
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
        # confian en el navegador. Aqui toda request exige una credencial explicita en un
        # header (API key o token OAuth, nunca cookies), que un sitio ajeno no puede adjuntar.
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )
    return McpAuthMiddleware(app)


def _url(valor: str) -> AnyHttpUrl:
    # Sin esto pydantic agrega "/" a una URL sin ruta, y el issuer publicado dejaria de ser
    # identico al que los clientes comparan (RFC 8414 exige igualdad exacta).
    return TypeAdapter(AnyHttpUrl, config=ConfigDict(url_preserve_empty_path=True)).validate_python(valor)


def crear_rutas_oauth() -> list[Route]:
    """Servidor de autorizacion OAuth del MCP (metadata, /authorize, /token, /register,
    /revoke) y metadata del recurso protegido, en la raiz de la API."""
    rutas = create_auth_routes(
        RitmoOAuthProvider(),
        issuer_url=_url(ISSUER_URL),
        # Registro dinamico abierto: cualquier cliente puede registrarse (con limite por
        # hora, ver LimiteRegistroMiddleware), pero no obtiene nada sin que el usuario
        # apruebe en la pantalla de consentimiento.
        client_registration_options=ClientRegistrationOptions(enabled=True, default_scopes=SCOPES_OAUTH),
        revocation_options=RevocationOptions(enabled=True),
    )
    rutas = [
        Route(ruta.path, endpoint=LimiteRegistroMiddleware(ruta.app), methods=list(ruta.methods or ()))
        if ruta.path == "/register"
        else ruta
        for ruta in rutas
    ]
    metadata_recurso = create_protected_resource_routes(
        resource_url=_url(MCP_URL),
        authorization_servers=[_url(ISSUER_URL)],
        scopes_supported=SCOPES_OAUTH,
        resource_name="Ritmo · Finanzas",
    )
    # Ademas de la ruta con sufijo (RFC 9728), la raiz: algunos clientes solo prueban esa.
    raiz = Route(
        "/.well-known/oauth-protected-resource",
        endpoint=metadata_recurso[0].endpoint,
        methods=["GET", "OPTIONS"],
    )
    return [*rutas, *metadata_recurso, raiz]
