"""Autenticacion del endpoint MCP con las API keys existentes (auth.api_key).

Los clientes MCP mandan la credencial como ``Authorization: Bearer thw_...``; tambien se
acepta ``X-API-Key`` para ser consistente con la API REST. El usuario resuelto viaja en el
scope ASGI hasta las herramientas: el SDK corre cada llamada en un task group propio, asi
que un contextvar fijado aqui no llegaria.
"""
from fastapi import HTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.auth.api_key import get_user_by_api_key
from app.db.session import AsyncSessionLocal


SCOPE_AUTH_USER_ID = "ritmo.auth_user_id"


def extraer_api_key(request: Request) -> str | None:
    x_api_key = request.headers.get("x-api-key")
    if x_api_key:
        return x_api_key.strip()

    esquema, _, token = request.headers.get("authorization", "").partition(" ")
    if esquema.lower() == "bearer" and token.strip():
        return token.strip()
    return None


def _no_autorizado(detalle: str) -> JSONResponse:
    return JSONResponse(
        status_code=401,
        content={"detail": detalle},
        headers={"WWW-Authenticate": 'Bearer realm="ritmo-mcp"'},
    )


class ApiKeyAuthMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        api_key = extraer_api_key(request)
        if not api_key:
            await _no_autorizado("API key requerida.")(scope, receive, send)
            return

        async with AsyncSessionLocal() as db:
            try:
                user = await get_user_by_api_key(api_key, request, db)
            except HTTPException as exc:
                await _no_autorizado(exc.detail)(scope, receive, send)
                return
            # get_user_by_api_key registra el uso de la key (contador, fecha e IP).
            await db.commit()

        scope[SCOPE_AUTH_USER_ID] = user.id
        await self.app(scope, receive, send)
