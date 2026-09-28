"""Servidor de autorizacion OAuth 2.1 del MCP (para Claude.ai, ChatGPT y similares).

Los endpoints de protocolo (/authorize, /token, /register, /revoke y metadata) son los del
SDK de MCP, que ya validan PKCE, redirect_uri y scopes. Este modulo implementa el
almacenamiento y la emision (``RitmoOAuthProvider``) y el paso que el SDK delega: el
consentimiento del usuario en el frontend.

Flujo: /authorize firma los parametros de la solicitud y redirige a la pantalla de
consentimiento; al aprobar, se crea una autorizacion y un codigo de un solo uso que el
cliente canjea en /token por un access token (1 h) y un refresh token (30 dias, rotativo).
"""
import hashlib
import secrets
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from ipaddress import ip_address
from urllib.parse import urlencode, urlparse

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from mcp.server.auth.provider import (
    AccessToken,
    AuthorizationCode,
    AuthorizationParams,
    AuthorizeError,
    RefreshToken,
    RegistrationError,
    TokenError,
    construct_redirect_uri,
)
from mcp.shared.auth import OAuthClientInformationFull, OAuthToken
from sqlalchemy import delete, exists, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app import settings
from app.auth.api_key import get_client_ip
from app.auth.scopes import FINANZAS_READ, FINANZAS_WRITE
from app.db.session import AsyncSessionLocal
from app.mcp.urls import CONSENTIMIENTO_URL, MCP_URL
from app.models import OAuthAutorizacion, OAuthCliente, OAuthCodigo, OAuthToken as OAuthTokenModelo, User
from app.services.errores import ErrorDominio, NoEncontrado


SCOPES_OAUTH = [FINANZAS_READ, FINANZAS_WRITE]
# Registro dinamico abierto, pero acotado. Se cuenta en la BD (no en memoria) para que el
# limite valga entre los workers de gunicorn.
LIMITE_REGISTROS_POR_IP = 10
LIMITE_REGISTROS_GLOBAL = 50
VENTANA_REGISTROS = timedelta(hours=1)
# Un cliente registrado que nadie autorizo en este plazo se borra en el proximo registro.
VIDA_CLIENTE_SIN_USO = timedelta(days=7)
DURACION_CODIGO = timedelta(minutes=5)
DURACION_ACCESS = timedelta(hours=1)
DURACION_REFRESH = timedelta(days=30)
DURACION_SOLICITUD_SEGUNDOS = 15 * 60
MAX_REDIRECT_URIS = 10

# Prefijos para distinguir a simple vista un token OAuth de una API key (thw_).
PREFIJO_ACCESS = "rtm_at_"
PREFIJO_REFRESH = "rtm_rt_"

_firmador = URLSafeTimedSerializer(settings.SECRET, salt="ritmo-mcp-oauth-solicitud")

# IP del registro en curso. La fija LimiteRegistroMiddleware y la lee register_client, que
# el SDK llama sin la request; ambos corren en la misma tarea, asi que el contextvar llega.
_ip_registro: ContextVar[str | None] = ContextVar("ip_registro_oauth", default=None)


class SolicitudInvalida(ErrorDominio):
    pass


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def _hash(valor: str) -> str:
    return hashlib.sha256(valor.encode("utf-8")).hexdigest()


def _misma_url(a: str, b: str) -> bool:
    return a.rstrip("/") == b.rstrip("/")


def _es_loopback(host: str | None) -> bool:
    if host == "localhost":
        return True
    try:
        return ip_address((host or "").strip("[]")).is_loopback
    except ValueError:
        return False


def validar_redirect_uri(uri: str) -> None:
    """https en cualquier dominio; http solo a la propia maquina (clientes de escritorio)."""
    partes = urlparse(uri)
    if partes.fragment:
        raise RegistrationError("invalid_redirect_uri", "La redirect_uri no puede tener fragmento.")
    if partes.scheme == "https" and partes.hostname:
        return
    if partes.scheme == "http" and _es_loopback(partes.hostname):
        return
    raise RegistrationError(
        "invalid_redirect_uri",
        "La redirect_uri debe ser https, o http solo hacia localhost.",
    )


def normalizar_scopes(pedidos: list[str] | None) -> list[str]:
    """Scopes de Ritmo dentro de lo pedido. Sin pedido (o sin ninguno conocido), ambos."""
    conocidos = [scope for scope in (pedidos or []) if scope in SCOPES_OAUTH]
    return conocidos or list(SCOPES_OAUTH)


# ---------------------------------------------------------------------------
# Limite del registro dinamico
# ---------------------------------------------------------------------------


async def purgar_clientes_sin_uso(db: AsyncSession) -> None:
    await db.execute(
        delete(OAuthCliente).where(
            OAuthCliente.created_at < _ahora() - VIDA_CLIENTE_SIN_USO,
            ~exists().where(OAuthAutorizacion.client_id == OAuthCliente.client_id),
        )
    )


async def registro_excede_limite(db: AsyncSession, ip: str | None) -> bool:
    desde = _ahora() - VENTANA_REGISTROS
    recientes = select(func.count()).select_from(OAuthCliente).where(OAuthCliente.created_at >= desde)
    if await db.scalar(recientes) >= LIMITE_REGISTROS_GLOBAL:
        return True
    return ip is not None and await db.scalar(
        recientes.where(OAuthCliente.registro_ip == ip)
    ) >= LIMITE_REGISTROS_POR_IP


class LimiteRegistroMiddleware:
    """Envuelve POST /register del SDK: 429 si la IP o el total superan el limite horario."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] != "POST":
            await self.app(scope, receive, send)
            return

        ip = get_client_ip(Request(scope))
        async with AsyncSessionLocal() as db:
            excede = await registro_excede_limite(db, ip)
        if excede:
            respuesta = JSONResponse(
                status_code=429,
                content={
                    "error": "too_many_requests",
                    "error_description": "Demasiados registros de clientes. Intenta mas tarde.",
                },
                headers={"Retry-After": str(int(VENTANA_REGISTROS.total_seconds()))},
            )
            await respuesta(scope, receive, send)
            return

        token = _ip_registro.set(ip)
        try:
            await self.app(scope, receive, send)
        finally:
            _ip_registro.reset(token)


# ---------------------------------------------------------------------------
# Emision de tokens
# ---------------------------------------------------------------------------


async def _emitir_tokens(
    db: AsyncSession,
    autorizacion: OAuthAutorizacion,
    scopes: list[str],
    resource: str | None,
) -> OAuthToken:
    access = PREFIJO_ACCESS + secrets.token_urlsafe(32)
    refresh = PREFIJO_REFRESH + secrets.token_urlsafe(32)
    ahora = _ahora()
    db.add_all([
        OAuthTokenModelo(
            id_autorizacion=autorizacion.id_autorizacion, tipo="access", token_hash=_hash(access),
            scopes=scopes, resource=resource, expires_at=ahora + DURACION_ACCESS,
        ),
        OAuthTokenModelo(
            id_autorizacion=autorizacion.id_autorizacion, tipo="refresh", token_hash=_hash(refresh),
            scopes=scopes, resource=resource, expires_at=ahora + DURACION_REFRESH,
        ),
    ])
    return OAuthToken(
        access_token=access,
        expires_in=int(DURACION_ACCESS.total_seconds()),
        scope=" ".join(scopes),
        refresh_token=refresh,
    )


async def _revocar_autorizacion(db: AsyncSession, id_autorizacion: int) -> None:
    ahora = _ahora()
    await db.execute(
        update(OAuthAutorizacion)
        .where(OAuthAutorizacion.id_autorizacion == id_autorizacion, OAuthAutorizacion.revoked_at.is_(None))
        .values(revoked_at=ahora)
    )
    await db.execute(
        update(OAuthTokenModelo)
        .where(OAuthTokenModelo.id_autorizacion == id_autorizacion, OAuthTokenModelo.revoked_at.is_(None))
        .values(revoked_at=ahora)
    )
    await db.execute(delete(OAuthCodigo).where(OAuthCodigo.id_autorizacion == id_autorizacion))


# ---------------------------------------------------------------------------
# Provider para los endpoints del SDK
# ---------------------------------------------------------------------------


class RitmoOAuthProvider:
    async def get_client(self, client_id: str) -> OAuthClientInformationFull | None:
        async with AsyncSessionLocal() as db:
            cliente = await db.get(OAuthCliente, client_id)
        if cliente is None:
            return None
        return OAuthClientInformationFull.model_validate(
            {**cliente.metadata_cliente, "client_secret": cliente.client_secret}
        )

    async def register_client(self, client_info: OAuthClientInformationFull) -> None:
        uris = [str(uri) for uri in client_info.redirect_uris or []]
        if not uris or len(uris) > MAX_REDIRECT_URIS:
            raise RegistrationError("invalid_redirect_uri", f"Se aceptan de 1 a {MAX_REDIRECT_URIS} redirect_uris.")
        for uri in uris:
            validar_redirect_uri(uri)

        metadata = client_info.model_dump(mode="json", exclude={"client_secret"}, exclude_none=True)
        async with AsyncSessionLocal() as db:
            await purgar_clientes_sin_uso(db)
            db.add(OAuthCliente(
                client_id=client_info.client_id,
                client_secret=client_info.client_secret,
                metadata_cliente=metadata,
                registro_ip=_ip_registro.get(),
            ))
            await db.commit()

    async def authorize(self, client: OAuthClientInformationFull, params: AuthorizationParams) -> str:
        if params.resource and not _misma_url(params.resource, MCP_URL):
            raise AuthorizeError("invalid_target", f"Este servidor solo emite tokens para {MCP_URL}.")

        solicitud = _firmador.dumps({
            "client_id": client.client_id,
            "redirect_uri": str(params.redirect_uri),
            "redirect_uri_explicita": params.redirect_uri_provided_explicitly,
            "code_challenge": params.code_challenge,
            "state": params.state,
            "scopes": params.scopes,
            "resource": params.resource,
        })
        return f"{CONSENTIMIENTO_URL}?{urlencode({'solicitud': solicitud})}"

    async def load_authorization_code(
        self, client: OAuthClientInformationFull, authorization_code: str
    ) -> AuthorizationCode | None:
        async with AsyncSessionLocal() as db:
            codigo = await db.scalar(
                select(OAuthCodigo)
                .where(OAuthCodigo.code_hash == _hash(authorization_code))
                .options(selectinload(OAuthCodigo.autorizacion))
            )
        if codigo is None or codigo.autorizacion.revoked_at is not None:
            return None
        autorizacion = codigo.autorizacion
        return AuthorizationCode(
            code=authorization_code,
            scopes=autorizacion.scopes,
            expires_at=codigo.expires_at.timestamp(),
            client_id=autorizacion.client_id,
            code_challenge=codigo.code_challenge,
            redirect_uri=codigo.redirect_uri,
            redirect_uri_provided_explicitly=codigo.redirect_uri_explicita,
            resource=codigo.resource,
            subject=str(autorizacion.auth_user_id),
        )

    async def exchange_authorization_code(
        self, client: OAuthClientInformationFull, authorization_code: AuthorizationCode
    ) -> OAuthToken:
        async with AsyncSessionLocal() as db:
            # Borrar y leer en un paso: si dos canjes compiten, solo uno obtiene la fila.
            id_autorizacion = await db.scalar(
                delete(OAuthCodigo)
                .where(OAuthCodigo.code_hash == _hash(authorization_code.code))
                .returning(OAuthCodigo.id_autorizacion)
            )
            if id_autorizacion is None:
                raise TokenError("invalid_grant", "El codigo de autorizacion ya fue usado.")
            autorizacion = await db.get(OAuthAutorizacion, id_autorizacion)
            tokens = await _emitir_tokens(db, autorizacion, autorizacion.scopes, authorization_code.resource)
            await db.commit()
        return tokens

    async def load_refresh_token(self, client: OAuthClientInformationFull, refresh_token: str) -> RefreshToken | None:
        async with AsyncSessionLocal() as db:
            token = await db.scalar(
                select(OAuthTokenModelo)
                .where(OAuthTokenModelo.token_hash == _hash(refresh_token), OAuthTokenModelo.tipo == "refresh")
                .options(selectinload(OAuthTokenModelo.autorizacion))
            )
            if token is None or token.autorizacion.revoked_at is not None:
                return None
            if token.revoked_at is not None:
                # Un refresh token ya rotado que vuelve a aparecer indica que se filtro:
                # se corta la autorizacion entera (OAuth 2.1, deteccion de reuso).
                await _revocar_autorizacion(db, token.id_autorizacion)
                await db.commit()
                return None
        return RefreshToken(
            token=refresh_token,
            client_id=token.autorizacion.client_id,
            scopes=token.scopes,
            expires_at=int(token.expires_at.timestamp()),
            resource=token.resource,
            subject=str(token.autorizacion.auth_user_id),
        )

    async def exchange_refresh_token(
        self,
        client: OAuthClientInformationFull,
        refresh_token: RefreshToken,
        scopes: list[str],
    ) -> OAuthToken:
        async with AsyncSessionLocal() as db:
            id_autorizacion = await db.scalar(
                update(OAuthTokenModelo)
                .where(
                    OAuthTokenModelo.token_hash == _hash(refresh_token.token),
                    OAuthTokenModelo.tipo == "refresh",
                    OAuthTokenModelo.revoked_at.is_(None),
                )
                .values(revoked_at=_ahora())
                .returning(OAuthTokenModelo.id_autorizacion)
            )
            if id_autorizacion is None:
                raise TokenError("invalid_grant", "El refresh token ya fue usado.")
            autorizacion = await db.get(OAuthAutorizacion, id_autorizacion)
            tokens = await _emitir_tokens(db, autorizacion, scopes, refresh_token.resource)
            await db.commit()
        return tokens

    async def load_access_token(self, token: str) -> AccessToken | None:
        async with AsyncSessionLocal() as db:
            fila = await db.scalar(
                select(OAuthTokenModelo)
                .join(OAuthAutorizacion, OAuthAutorizacion.id_autorizacion == OAuthTokenModelo.id_autorizacion)
                .join(User, User.id == OAuthAutorizacion.auth_user_id)
                .where(
                    OAuthTokenModelo.token_hash == _hash(token),
                    OAuthTokenModelo.tipo == "access",
                    OAuthTokenModelo.revoked_at.is_(None),
                    OAuthTokenModelo.expires_at > _ahora(),
                    OAuthAutorizacion.revoked_at.is_(None),
                    User.is_active.is_(True),
                )
                .options(selectinload(OAuthTokenModelo.autorizacion))
            )
            if fila is None:
                return None
            fila.autorizacion.last_used_at = _ahora()
            await db.commit()
        return AccessToken(
            token=token,
            client_id=fila.autorizacion.client_id,
            scopes=fila.scopes,
            expires_at=int(fila.expires_at.timestamp()),
            resource=fila.resource,
            subject=str(fila.autorizacion.auth_user_id),
        )

    async def revoke_token(self, token: AccessToken | RefreshToken) -> None:
        async with AsyncSessionLocal() as db:
            id_autorizacion = await db.scalar(
                select(OAuthTokenModelo.id_autorizacion).where(OAuthTokenModelo.token_hash == _hash(token.token))
            )
            if id_autorizacion is not None:
                await _revocar_autorizacion(db, id_autorizacion)
                await db.commit()


# ---------------------------------------------------------------------------
# Consentimiento (lo usan los endpoints REST de la pantalla del frontend)
# ---------------------------------------------------------------------------


@dataclass
class Solicitud:
    cliente: OAuthClientInformationFull
    redirect_uri: str
    redirect_uri_explicita: bool
    code_challenge: str
    state: str | None
    scopes_pedidos: list[str] | None
    resource: str | None

    @property
    def scopes_disponibles(self) -> list[str]:
        return normalizar_scopes(self.scopes_pedidos)


async def leer_solicitud(token: str) -> Solicitud:
    try:
        datos = _firmador.loads(token, max_age=DURACION_SOLICITUD_SEGUNDOS)
    except SignatureExpired as exc:
        raise SolicitudInvalida("La solicitud expiro. Vuelve a conectar desde tu asistente.") from exc
    except BadSignature as exc:
        raise SolicitudInvalida("La solicitud no es valida.") from exc

    cliente = await RitmoOAuthProvider().get_client(datos["client_id"])
    if cliente is None:
        raise SolicitudInvalida("La aplicacion que pidio acceso ya no esta registrada.")
    return Solicitud(
        cliente=cliente,
        redirect_uri=datos["redirect_uri"],
        redirect_uri_explicita=datos["redirect_uri_explicita"],
        code_challenge=datos["code_challenge"],
        state=datos["state"],
        scopes_pedidos=datos["scopes"],
        resource=datos["resource"],
    )


async def aprobar_solicitud(db: AsyncSession, token: str, auth_user_id: int, scopes: list[str]) -> str:
    """Crea la autorizacion y el codigo; devuelve la URL de vuelta al cliente."""
    solicitud = await leer_solicitud(token)
    otorgados = sorted(set(scopes))
    if not otorgados or not set(otorgados) <= set(solicitud.scopes_disponibles):
        raise SolicitudInvalida("Los permisos elegidos no corresponden a los que pidio la aplicacion.")
    # Escribir implica leer: se guarda explicito para que un refresh pueda pedir solo lectura.
    if FINANZAS_WRITE in otorgados and FINANZAS_READ not in otorgados:
        otorgados = [FINANZAS_READ, FINANZAS_WRITE]

    autorizacion = OAuthAutorizacion(
        client_id=solicitud.cliente.client_id, auth_user_id=auth_user_id, scopes=otorgados,
    )
    db.add(autorizacion)
    await db.flush()
    codigo = secrets.token_urlsafe(32)
    db.add(OAuthCodigo(
        code_hash=_hash(codigo),
        id_autorizacion=autorizacion.id_autorizacion,
        code_challenge=solicitud.code_challenge,
        redirect_uri=solicitud.redirect_uri,
        redirect_uri_explicita=solicitud.redirect_uri_explicita,
        resource=solicitud.resource,
        expires_at=_ahora() + DURACION_CODIGO,
    ))
    return construct_redirect_uri(solicitud.redirect_uri, code=codigo, state=solicitud.state)


async def rechazar_solicitud(token: str) -> str:
    solicitud = await leer_solicitud(token)
    return construct_redirect_uri(
        solicitud.redirect_uri,
        error="access_denied",
        error_description="El usuario rechazo la conexion.",
        state=solicitud.state,
    )


async def listar_autorizaciones(db: AsyncSession, auth_user_id: int) -> list[OAuthAutorizacion]:
    return (
        await db.execute(
            select(OAuthAutorizacion)
            .where(OAuthAutorizacion.auth_user_id == auth_user_id, OAuthAutorizacion.revoked_at.is_(None))
            .options(selectinload(OAuthAutorizacion.cliente))
            .order_by(OAuthAutorizacion.created_at.desc())
        )
    ).scalars().all()


async def revocar_autorizacion_de_usuario(db: AsyncSession, auth_user_id: int, id_autorizacion: int) -> None:
    autorizacion = await db.scalar(
        select(OAuthAutorizacion).where(
            OAuthAutorizacion.id_autorizacion == id_autorizacion,
            OAuthAutorizacion.auth_user_id == auth_user_id,
            OAuthAutorizacion.revoked_at.is_(None),
        )
    )
    if autorizacion is None:
        raise NoEncontrado("Conexion no encontrada.")
    await _revocar_autorizacion(db, id_autorizacion)
