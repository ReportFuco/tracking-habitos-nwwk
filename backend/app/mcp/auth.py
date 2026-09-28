"""Autenticacion del endpoint MCP: API keys (auth.api_key) o tokens OAuth.

Las API keys llegan como ``X-API-Key`` o ``Authorization: Bearer thw_...``; cualquier otro
bearer se trata como access token OAuth (app/mcp/oauth.py). El 401 anuncia la metadata
del recurso protegido (RFC 9728) para que clientes como Claude.ai descubran el flujo OAuth.

El usuario y sus scopes viajan en el scope ASGI hasta las herramientas: el SDK corre cada
llamada en un task group propio, asi que un contextvar fijado aqui no llegaria.
"""
from fastapi import HTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.auth.api_key import API_KEY_PREFIX, autenticar_api_key
from app.db.session import AsyncSessionLocal
from app.mcp.oauth import RitmoOAuthProvider, SCOPES_OAUTH
from app.mcp.urls import MCP_URL, PROTECTED_RESOURCE_METADATA_URL


SCOPE_AUTH_USER_ID = "ritmo.auth_user_id"
SCOPE_API_KEY_SCOPES = "ritmo.api_key_scopes"


def extraer_credencial(request: Request) -> tuple[str, str] | None:
    """("api_key" | "oauth", valor) segun el header recibido."""
    x_api_key = request.headers.get("x-api-key")
    if x_api_key:
        return "api_key", x_api_key.strip()

    esquema, _, token = request.headers.get("authorization", "").partition(" ")
    token = token.strip()
    if esquema.lower() != "bearer" or not token:
        return None
    return ("api_key" if token.startswith(f"{API_KEY_PREFIX}_") else "oauth"), token


def _no_autorizado(detalle: str, token_invalido: bool = False) -> JSONResponse:
    parametros = [
        'realm="ritmo-mcp"',
        f'resource_metadata="{PROTECTED_RESOURCE_METADATA_URL}"',
        f'scope="{" ".join(SCOPES_OAUTH)}"',
    ]
    if token_invalido:
        parametros.insert(1, 'error="invalid_token"')
    return JSONResponse(
        status_code=401,
        content={"detail": detalle},
        headers={"WWW-Authenticate": "Bearer " + ", ".join(parametros)},
    )


class McpAuthMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app
        self.oauth = RitmoOAuthProvider()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        credencial = extraer_credencial(request)
        if credencial is None:
            await _no_autorizado("Credenciales requeridas.")(scope, receive, send)
            return

        tipo, valor = credencial
        if tipo == "api_key":
            async with AsyncSessionLocal() as db:
                try:
                    user, key = await autenticar_api_key(valor, request, db)
                except HTTPException as exc:
                    await _no_autorizado(exc.detail, token_invalido=True)(scope, receive, send)
                    return
                # autenticar_api_key registra el uso de la key (contador, fecha e IP).
                await db.commit()
            auth_user_id, scopes = user.id, list(key.scopes)
        else:
            token = await self.oauth.load_access_token(valor)
            # Un token emitido para otro recurso (RFC 8707) no sirve aqui.
            if token is None or (token.resource and token.resource.rstrip("/") != MCP_URL.rstrip("/")):
                await _no_autorizado("Token invalido o expirado.", token_invalido=True)(scope, receive, send)
                return
            auth_user_id, scopes = int(token.subject), token.scopes

        # Los permisos se exigen por herramienta (app/mcp/tools), no por ruta.
        scope[SCOPE_AUTH_USER_ID] = auth_user_id
        scope[SCOPE_API_KEY_SCOPES] = scopes
        await self.app(scope, receive, send)
