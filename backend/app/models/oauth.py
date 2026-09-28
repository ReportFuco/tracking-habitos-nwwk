"""OAuth 2.1 para el servidor MCP: clientes registrados, autorizaciones y tokens.

Una autorizacion es el "si" de un usuario a un cliente (Claude, ChatGPT...) con ciertos
scopes. Los codigos y tokens cuelgan de ella: revocarla corta todo lo emitido, incluidos
los tokens que salgan de refrescos posteriores. Codigos y tokens se guardan hasheados.
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.db_schemas import AUTH_SCHEMA, table_ref
from app.models.web_session import utc_now


class OAuthCliente(Base):
    __tablename__ = "oauth_cliente"
    __table_args__ = {"schema": AUTH_SCHEMA}

    client_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    # En claro: el autenticador del SDK compara el secreto recibido contra este valor. Solo
    # sirve junto a un codigo con PKCE o un refresh token, que si van hasheados.
    client_secret: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # Metadata completa del registro dinamico (RFC 7591): redirect_uris, nombre, grants...
    metadata_cliente: Mapped[dict] = mapped_column(JSONB, nullable=False)
    # IP que hizo el registro: el limite de registros por hora se cuenta con ella.
    registro_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, index=True
    )


class OAuthAutorizacion(Base):
    __tablename__ = "oauth_autorizacion"
    __table_args__ = {"schema": AUTH_SCHEMA}

    id_autorizacion: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    client_id: Mapped[str] = mapped_column(
        ForeignKey(table_ref(AUTH_SCHEMA, "oauth_cliente.client_id"), ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    auth_user_id: Mapped[int] = mapped_column(
        ForeignKey(table_ref(AUTH_SCHEMA, "user.id"), ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scopes: Mapped[list[str]] = mapped_column(ARRAY(String(40)), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    cliente: Mapped[OAuthCliente] = relationship()


class OAuthCodigo(Base):
    __tablename__ = "oauth_codigo"
    __table_args__ = {"schema": AUTH_SCHEMA}

    code_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    id_autorizacion: Mapped[int] = mapped_column(
        ForeignKey(table_ref(AUTH_SCHEMA, "oauth_autorizacion.id_autorizacion"), ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code_challenge: Mapped[str] = mapped_column(String(128), nullable=False)
    redirect_uri: Mapped[str] = mapped_column(Text, nullable=False)
    redirect_uri_explicita: Mapped[bool] = mapped_column(nullable=False)
    resource: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    autorizacion: Mapped[OAuthAutorizacion] = relationship()


class OAuthToken(Base):
    __tablename__ = "oauth_token"
    __table_args__ = {"schema": AUTH_SCHEMA}

    id_token: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    id_autorizacion: Mapped[int] = mapped_column(
        ForeignKey(table_ref(AUTH_SCHEMA, "oauth_autorizacion.id_autorizacion"), ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # "access" o "refresh".
    tipo: Mapped[str] = mapped_column(String(10), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    scopes: Mapped[list[str]] = mapped_column(ARRAY(String(40)), nullable=False)
    resource: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    autorizacion: Mapped[OAuthAutorizacion] = relationship()
