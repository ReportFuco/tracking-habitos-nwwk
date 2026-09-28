"""OAuth para el servidor MCP: clientes, autorizaciones, codigos y tokens

Revision ID: 4356ac9155a5
Revises: c80365289c96
Create Date: 2026-09-28
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.models.db_schemas import AUTH_SCHEMA


revision: str = "4356ac9155a5"
down_revision: Union[str, Sequence[str], None] = "c80365289c96"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "oauth_cliente",
        sa.Column("client_id", sa.String(length=64), nullable=False),
        sa.Column("client_secret", sa.String(length=128), nullable=True),
        sa.Column("metadata_cliente", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("client_id"),
        schema=AUTH_SCHEMA,
    )
    op.create_table(
        "oauth_autorizacion",
        sa.Column("id_autorizacion", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("client_id", sa.String(length=64), nullable=False),
        sa.Column("auth_user_id", sa.Integer(), nullable=False),
        sa.Column("scopes", postgresql.ARRAY(sa.String(length=40)), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["client_id"], [f"{AUTH_SCHEMA}.oauth_cliente.client_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["auth_user_id"], [f"{AUTH_SCHEMA}.user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id_autorizacion"),
        schema=AUTH_SCHEMA,
    )
    op.create_index("ix_auth_oauth_autorizacion_client_id", "oauth_autorizacion", ["client_id"], schema=AUTH_SCHEMA)
    op.create_index("ix_auth_oauth_autorizacion_auth_user_id", "oauth_autorizacion", ["auth_user_id"], schema=AUTH_SCHEMA)
    op.create_table(
        "oauth_codigo",
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("id_autorizacion", sa.Integer(), nullable=False),
        sa.Column("code_challenge", sa.String(length=128), nullable=False),
        sa.Column("redirect_uri", sa.Text(), nullable=False),
        sa.Column("redirect_uri_explicita", sa.Boolean(), nullable=False),
        sa.Column("resource", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["id_autorizacion"], [f"{AUTH_SCHEMA}.oauth_autorizacion.id_autorizacion"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("code_hash"),
        schema=AUTH_SCHEMA,
    )
    op.create_index("ix_auth_oauth_codigo_id_autorizacion", "oauth_codigo", ["id_autorizacion"], schema=AUTH_SCHEMA)
    op.create_table(
        "oauth_token",
        sa.Column("id_token", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_autorizacion", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.String(length=10), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("scopes", postgresql.ARRAY(sa.String(length=40)), nullable=False),
        sa.Column("resource", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["id_autorizacion"], [f"{AUTH_SCHEMA}.oauth_autorizacion.id_autorizacion"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id_token"),
        sa.UniqueConstraint("token_hash"),
        schema=AUTH_SCHEMA,
    )
    op.create_index("ix_auth_oauth_token_id_autorizacion", "oauth_token", ["id_autorizacion"], schema=AUTH_SCHEMA)


def downgrade() -> None:
    op.drop_index("ix_auth_oauth_token_id_autorizacion", table_name="oauth_token", schema=AUTH_SCHEMA)
    op.drop_table("oauth_token", schema=AUTH_SCHEMA)
    op.drop_index("ix_auth_oauth_codigo_id_autorizacion", table_name="oauth_codigo", schema=AUTH_SCHEMA)
    op.drop_table("oauth_codigo", schema=AUTH_SCHEMA)
    op.drop_index("ix_auth_oauth_autorizacion_auth_user_id", table_name="oauth_autorizacion", schema=AUTH_SCHEMA)
    op.drop_index("ix_auth_oauth_autorizacion_client_id", table_name="oauth_autorizacion", schema=AUTH_SCHEMA)
    op.drop_table("oauth_autorizacion", schema=AUTH_SCHEMA)
    op.drop_table("oauth_cliente", schema=AUTH_SCHEMA)
