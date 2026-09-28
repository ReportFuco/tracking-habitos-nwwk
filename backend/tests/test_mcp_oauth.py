"""OAuth 2.1 del servidor MCP: descubrimiento, registro, consentimiento, tokens y revocacion.

Los tests de metadata corren siempre; el flujo completo necesita RUN_DB_TESTS=1 y una
base *_test, como test_finanzas_movimientos_db.py.
"""
import base64
import hashlib
import os
import secrets
import uuid
from contextlib import asynccontextmanager
from urllib.parse import parse_qs, urlparse

import httpx
import httpx2
import pytest
from mcp import Client
from mcp.client.streamable_http import streamable_http_client

from app.main import app
from app.mcp.server import crear_app_mcp, crear_servidor_mcp
from app.mcp.urls import CONSENTIMIENTO_URL, ISSUER_URL, MCP_PATH, MCP_URL

DB_URL = os.environ.get("DATABASE_URL", "")
RUN_DB = os.environ.get("RUN_DB_TESTS") == "1" and DB_URL.rsplit("/", 1)[-1].endswith("_test")
requiere_db = pytest.mark.skipif(not RUN_DB, reason="Requiere RUN_DB_TESTS=1 y una base *_test.")
pytestmark = pytest.mark.asyncio(loop_scope="session")

REDIRECT = "https://claude.ai/api/mcp/auth_callback"


def cliente():
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


def pkce() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
    return verifier, challenge


@asynccontextmanager
async def cliente_mcp(token: str):
    servidor = crear_servidor_mcp()
    http = httpx2.AsyncClient(
        transport=httpx2.ASGITransport(app=crear_app_mcp(servidor)),
        headers={"Authorization": f"Bearer {token}"},
    )
    async with servidor.session_manager.run(), http:
        async with Client(streamable_http_client(f"http://test{MCP_PATH}", http_client=http)) as mcp:
            yield mcp


async def test_mcp_sin_credencial_anuncia_la_metadata_oauth():
    async with cliente() as c:
        r = await c.post(MCP_PATH, json={})
        recurso = await c.get(f"/.well-known/oauth-protected-resource{MCP_PATH}")
        recurso_raiz = await c.get("/.well-known/oauth-protected-resource")
        servidor = await c.get("/.well-known/oauth-authorization-server")

    assert r.status_code == 401
    assert "resource_metadata=" in r.headers["www-authenticate"]
    assert recurso.json()["resource"] == MCP_URL
    assert recurso.json()["authorization_servers"] == [ISSUER_URL]
    assert recurso_raiz.json() == recurso.json()
    metadata = servidor.json()
    # RFC 8414: el issuer es identico al que publica el recurso, sin barra agregada.
    assert metadata["issuer"] == ISSUER_URL
    assert metadata["registration_endpoint"] == f"{ISSUER_URL}/register"
    assert metadata["code_challenge_methods_supported"] == ["S256"]


async def test_registro_rechaza_redirect_inseguras():
    async with cliente() as c:
        http_externo = await c.post("/register", json={"redirect_uris": ["http://evil.example/cb"]})
        con_fragmento = await c.post("/register", json={"redirect_uris": ["https://ok.example/cb#x"]})

    assert http_externo.status_code == 400
    assert http_externo.json()["error"] == "invalid_redirect_uri"
    assert con_fragmento.status_code == 400


if RUN_DB:
    from sqlalchemy import delete

    from app.auth.fastapi_users import current_user
    from app.db.session import AsyncSessionLocal, engine
    from app.models import OAuthCliente, Usuario
    from app.models.usuario_auth import User


@pytest.fixture
async def usuario():
    sufijo = uuid.uuid4().hex[:8]
    async with AsyncSessionLocal() as db:
        auth = User(email=f"oauth-{sufijo}@example.com", hashed_password="x", is_active=True)
        db.add(auth)
        await db.flush()
        perfil = Usuario(
            username=f"oa{sufijo}", nombre="O", apellido="Auth", telefono=f"4{sufijo[:7]}",
            email=auth.email, auth_user_id=auth.id,
        )
        db.add(perfil)
        await db.commit()
        datos = {"auth": auth, "id_usuario": perfil.id_usuario, "clientes": []}

    app.dependency_overrides[current_user] = lambda: datos["auth"]
    yield datos
    app.dependency_overrides.clear()

    async with AsyncSessionLocal() as db:
        # Borrar el cliente arrastra autorizaciones, codigos y tokens (ON DELETE CASCADE).
        await db.execute(delete(OAuthCliente).where(OAuthCliente.client_id.in_(datos["clientes"])))
        await db.execute(delete(Usuario).where(Usuario.id_usuario == datos["id_usuario"]))
        await db.execute(delete(User).where(User.id == datos["auth"].id))
        await db.commit()
    await engine.dispose()


async def registrar(c, usuario) -> str:
    r = await c.post("/register", json={
        "redirect_uris": [REDIRECT],
        "client_name": "Claude",
        "token_endpoint_auth_method": "none",
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
    })
    assert r.status_code == 201, r.text
    client_id = r.json()["client_id"]
    usuario["clientes"].append(client_id)
    return client_id


async def pedir_autorizacion(c, client_id: str, challenge: str, **extra) -> httpx.Response:
    params = {
        "response_type": "code", "client_id": client_id, "redirect_uri": REDIRECT,
        "code_challenge": challenge, "code_challenge_method": "S256", "state": "estado-123",
        "scope": "finanzas:read finanzas:write", "resource": MCP_URL, **extra,
    }
    return await c.get("/authorize", params=params)


def query(url: str) -> dict[str, str]:
    return {clave: valores[0] for clave, valores in parse_qs(urlparse(url).query).items()}


async def conectar(c, usuario, scopes: list[str]) -> tuple[str, dict]:
    """Registro + /authorize + consentimiento + /token. Devuelve (client_id, tokens)."""
    client_id = await registrar(c, usuario)
    verifier, challenge = pkce()
    autorizar = await pedir_autorizacion(c, client_id, challenge)
    solicitud = query(autorizar.headers["location"])["solicitud"]
    aprobado = await c.post("/auth/oauth/solicitud/aprobar", json={"solicitud": solicitud, "scopes": scopes})
    code = query(aprobado.json()["redirect_url"])["code"]
    tokens = await c.post("/token", data={
        "grant_type": "authorization_code", "code": code, "redirect_uri": REDIRECT,
        "client_id": client_id, "code_verifier": verifier,
    })
    assert tokens.status_code == 200, tokens.text
    return client_id, tokens.json()


@requiere_db
async def test_registro_acepta_http_solo_hacia_la_propia_maquina(usuario):
    async with cliente() as c:
        r = await c.post("/register", json={"redirect_uris": ["http://127.0.0.1:33418/callback"]})
    usuario["clientes"].append(r.json().get("client_id"))

    # Lo usan los clientes de escritorio (Claude Code, MCP Inspector).
    assert r.status_code == 201, r.text


@requiere_db
async def test_flujo_completo_de_autorizacion(usuario):
    async with cliente() as c:
        client_id = await registrar(c, usuario)
        verifier, challenge = pkce()
        autorizar = await pedir_autorizacion(c, client_id, challenge)
        destino = autorizar.headers["location"]
        solicitud = query(destino)["solicitud"]
        detalle = await c.get("/auth/oauth/solicitud", params={"solicitud": solicitud})
        # Pedir escritura sin que la aplicacion la haya pedido no se acepta.
        aprobado = await c.post(
            "/auth/oauth/solicitud/aprobar", json={"solicitud": solicitud, "scopes": ["finanzas:read"]}
        )
        vuelta = query(aprobado.json()["redirect_url"])
        canje = {
            "grant_type": "authorization_code", "code": vuelta["code"], "redirect_uri": REDIRECT,
            "client_id": client_id, "code_verifier": verifier,
        }
        verifier_malo = await c.post("/token", data={**canje, "code_verifier": pkce()[0]})
        tokens = await c.post("/token", data=canje)
        reuso = await c.post("/token", data=canje)

    assert autorizar.status_code == 302
    assert destino.startswith(CONSENTIMIENTO_URL)
    assert detalle.json() == {
        "cliente_nombre": "Claude", "cliente_uri": None, "redirect_host": "claude.ai",
        "scopes_disponibles": ["finanzas:read", "finanzas:write"],
    }
    assert aprobado.json()["redirect_url"].startswith(REDIRECT)
    assert vuelta["state"] == "estado-123"
    assert verifier_malo.status_code == 400
    assert tokens.status_code == 200, tokens.text
    cuerpo = tokens.json()
    assert cuerpo["access_token"].startswith("rtm_at_")
    assert cuerpo["refresh_token"].startswith("rtm_rt_")
    assert cuerpo["scope"] == "finanzas:read"
    assert reuso.status_code == 400
    assert reuso.json()["error"] == "invalid_grant"

    async with cliente_mcp(cuerpo["access_token"]) as mcp:
        resumen = await mcp.call_tool("resumen_mes", {})
        escribir = await mcp.call_tool("eliminar_movimiento", {"id_movimiento": 1})

    assert not resumen.is_error, resumen.content
    assert escribir.is_error
    assert "finanzas:write" in escribir.content[0].text


@requiere_db
async def test_rechazar_y_errores_de_solicitud(usuario):
    async with cliente() as c:
        client_id = await registrar(c, usuario)
        _, challenge = pkce()
        autorizar = await pedir_autorizacion(c, client_id, challenge)
        solicitud = query(autorizar.headers["location"])["solicitud"]
        rechazo = await c.post("/auth/oauth/solicitud/rechazar", json={"solicitud": solicitud})
        adulterada = await c.get("/auth/oauth/solicitud", params={"solicitud": solicitud + "x"})
        otro_recurso = await pedir_autorizacion(c, client_id, challenge, resource="https://otro.example/mcp")
        scope_ajeno = await c.post(
            "/auth/oauth/solicitud/aprobar", json={"solicitud": solicitud, "scopes": ["*"]}
        )

    assert query(rechazo.json()["redirect_url"]) == {
        "error": "access_denied", "error_description": "El usuario rechazo la conexion.", "state": "estado-123",
    }
    assert adulterada.status_code == 400
    # Un token para otro recurso se rechaza volviendo al cliente con invalid_target.
    assert query(otro_recurso.headers["location"])["error"] == "invalid_target"
    assert scope_ajeno.status_code == 400


@requiere_db
async def test_refresh_rota_y_el_reuso_corta_la_conexion(usuario):
    async with cliente() as c:
        client_id, tokens = await conectar(c, usuario, ["finanzas:write"])
        refresco = {"grant_type": "refresh_token", "refresh_token": tokens["refresh_token"], "client_id": client_id}
        nuevos = await c.post("/token", data=refresco)
        async with cliente_mcp(nuevos.json()["access_token"]) as mcp:
            antes = await mcp.call_tool("listar_cuentas", {})
        reuso = await c.post("/token", data=refresco)
        despues = await c.post(MCP_PATH, headers={"Authorization": f"Bearer {nuevos.json()['access_token']}"}, json={})
        refresco_nuevo = await c.post(
            "/token", data={**refresco, "refresh_token": nuevos.json()["refresh_token"]}
        )

    assert tokens["scope"] == "finanzas:read finanzas:write"
    assert nuevos.status_code == 200
    assert nuevos.json()["refresh_token"] != tokens["refresh_token"]
    assert not antes.is_error
    # Presentar un refresh token ya rotado revoca toda la autorizacion.
    assert reuso.status_code == 400
    assert despues.status_code == 401
    assert 'error="invalid_token"' in despues.headers["www-authenticate"]
    assert refresco_nuevo.status_code == 400


@requiere_db
async def test_listar_y_revocar_conexiones(usuario):
    async with cliente() as c:
        _, tokens = await conectar(c, usuario, ["finanzas:read"])
        conexiones = (await c.get("/auth/oauth/conexiones")).json()
        async with cliente_mcp(tokens["access_token"]) as mcp:
            antes = await mcp.call_tool("listar_cuentas", {})
        revocar = await c.delete(f"/auth/oauth/conexiones/{conexiones[0]['id_autorizacion']}")
        despues = await c.post(MCP_PATH, headers={"Authorization": f"Bearer {tokens['access_token']}"}, json={})
        otra_vez = await c.delete(f"/auth/oauth/conexiones/{conexiones[0]['id_autorizacion']}")
        vacio = (await c.get("/auth/oauth/conexiones")).json()

    assert [(x["cliente_nombre"], x["scopes"]) for x in conexiones] == [("Claude", ["finanzas:read"])]
    assert not antes.is_error
    assert revocar.status_code == 204
    assert despues.status_code == 401
    assert otra_vez.status_code == 404
    assert vacio == []


@requiere_db
async def test_cliente_oauth_del_sdk_descubre_y_se_conecta_solo(usuario):
    """El cliente OAuth oficial del SDK hace todo el descubrimiento por su cuenta (401 ->
    metadata del recurso -> metadata del servidor -> registro -> PKCE -> token), como
    Claude.ai. Solo el paso del navegador se simula aprobando por la API."""
    from mcp.client.auth import OAuthClientProvider
    from mcp.shared.auth import AuthorizationCodeResult, OAuthClientMetadata

    from app.main import servidor_mcp

    class Almacen:
        tokens = None
        cliente = None

        async def get_tokens(self):
            return self.tokens

        async def set_tokens(self, tokens):
            self.tokens = tokens

        async def get_client_info(self):
            return self.cliente

        async def set_client_info(self, client_info):
            self.cliente = client_info
            usuario["clientes"].append(client_info.client_id)

    transporte = httpx2.ASGITransport(app=app)
    resultado: dict[str, AuthorizationCodeResult] = {}

    async def abrir_navegador(url_autorizar: str) -> None:
        async with httpx2.AsyncClient(transport=transporte) as navegador, cliente() as api:
            destino = (await navegador.get(url_autorizar)).headers["location"]
            solicitud = query(destino)["solicitud"]
            aprobado = await api.post(
                "/auth/oauth/solicitud/aprobar",
                json={"solicitud": solicitud, "scopes": ["finanzas:read", "finanzas:write"]},
            )
        vuelta = query(aprobado.json()["redirect_url"])
        resultado["codigo"] = AuthorizationCodeResult(code=vuelta["code"], state=vuelta.get("state"))

    async def recibir_callback() -> AuthorizationCodeResult:
        return resultado["codigo"]

    auth = OAuthClientProvider(
        server_url=MCP_URL,
        client_metadata=OAuthClientMetadata(
            client_name="Cliente SDK", redirect_uris=["http://127.0.0.1:33418/callback"],
            grant_types=["authorization_code", "refresh_token"], response_types=["code"],
        ),
        storage=Almacen(),
        redirect_handler=abrir_navegador,
        callback_handler=recibir_callback,
    )
    async with servidor_mcp.session_manager.run():
        async with httpx2.AsyncClient(transport=transporte, auth=auth) as http:
            async with Client(streamable_http_client(MCP_URL, http_client=http)) as mcp:
                herramientas = (await mcp.list_tools()).tools
                cuentas = await mcp.call_tool("listar_cuentas", {})

    assert len(herramientas) == 11
    assert not cuentas.is_error, cuentas.content
