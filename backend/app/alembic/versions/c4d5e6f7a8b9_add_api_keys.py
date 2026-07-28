"""add api keys

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-05-13 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, Sequence[str], None] = "b3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "api_key",
        sa.Column("id_api_key", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("auth_user_id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=80), nullable=False),
        sa.Column("key_prefix", sa.String(length=16), nullable=False),
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("usage_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("last_used_ip", sa.String(length=45), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["auth_user_id"],
            ["auth.user.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id_api_key"),
        sa.UniqueConstraint("key_hash", name="uq_api_key_key_hash"),
        schema="auth",
    )
    op.create_index("ix_api_key_auth_user_id", "api_key", ["auth_user_id"], schema="auth")
    op.create_index("ix_api_key_key_prefix", "api_key", ["key_prefix"], schema="auth")


def downgrade() -> None:
    op.drop_index("ix_api_key_key_prefix", table_name="api_key", schema="auth")
    op.drop_index("ix_api_key_auth_user_id", table_name="api_key", schema="auth")
    op.drop_table("api_key", schema="auth")
