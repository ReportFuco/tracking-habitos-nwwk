"""URLs publicas del servidor MCP y de su servidor de autorizacion OAuth."""
from app import settings


MCP_PATH = "/mcp"

# Identificador del recurso (RFC 8707/9728): los clientes piden tokens para esta URL exacta.
MCP_URL = f"{settings.URL_API}{MCP_PATH}"
# Emisor OAuth (RFC 8414): la propia API; los endpoints cuelgan de su raiz.
ISSUER_URL = settings.URL_API
PROTECTED_RESOURCE_METADATA_URL = f"{settings.URL_API}/.well-known/oauth-protected-resource{MCP_PATH}"
# Pantalla del frontend donde el usuario aprueba o rechaza la conexion.
CONSENTIMIENTO_URL = f"{settings.URL_SITE.rstrip('/')}/app/conexiones/autorizar"
