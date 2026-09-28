"""api_key.scopes: permisos por API key

Revision ID: c80365289c96
Revises: 472033ea3c1b
Create Date: 2026-09-28

Las keys existentes quedan con acceso total ('*'), que es lo que tenian. El default se
quita despues del backfill: una key nueva debe declarar sus scopes explicitamente.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.models.db_schemas import AUTH_SCHEMA


revision: str = "c80365289c96"
down_revision: Union[str, Sequence[str], None] = "472033ea3c1b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "api_key",
        sa.Column(
            "scopes",
            postgresql.ARRAY(sa.String(length=40)),
            server_default=sa.text("'{*}'"),
            nullable=False,
        ),
        schema=AUTH_SCHEMA,
    )
    op.alter_column("api_key", "scopes", server_default=None, schema=AUTH_SCHEMA)


def downgrade() -> None:
    op.drop_column("api_key", "scopes", schema=AUTH_SCHEMA)
