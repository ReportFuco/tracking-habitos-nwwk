"""add revocable web sessions

Revision ID: a7b8c9d0e1f2
Revises: c4d5e6f7a8b9
Create Date: 2026-07-28 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "web_session",
        sa.Column("id_session", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("auth_user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("last_ip", sa.String(length=45), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "last_used_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("absolute_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["auth_user_id"],
            ["auth.user.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id_session"),
        sa.UniqueConstraint("token_hash", name="uq_web_session_token_hash"),
        schema="auth",
    )
    op.create_index(
        "ix_web_session_auth_user_id",
        "web_session",
        ["auth_user_id"],
        schema="auth",
    )
    op.create_index(
        "ix_web_session_token_hash",
        "web_session",
        ["token_hash"],
        unique=True,
        schema="auth",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_web_session_token_hash",
        table_name="web_session",
        schema="auth",
    )
    op.drop_index(
        "ix_web_session_auth_user_id",
        table_name="web_session",
        schema="auth",
    )
    op.drop_table("web_session", schema="auth")
