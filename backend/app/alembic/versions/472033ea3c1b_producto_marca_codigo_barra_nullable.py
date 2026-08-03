"""producto.id_marca and producto.codigo_barra become nullable

Revision ID: 472033ea3c1b
Revises: d025097740d9
Create Date: 2026-08-03
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.models.db_schemas import CATALOGO_SCHEMA


revision: str = "472033ea3c1b"
down_revision: Union[str, Sequence[str], None] = "d025097740d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "producto",
        "id_marca",
        existing_type=sa.Integer(),
        nullable=True,
        schema=CATALOGO_SCHEMA,
    )
    op.alter_column(
        "producto",
        "codigo_barra",
        existing_type=sa.String(64),
        nullable=True,
        schema=CATALOGO_SCHEMA,
    )


def downgrade() -> None:
    op.alter_column(
        "producto",
        "codigo_barra",
        existing_type=sa.String(64),
        nullable=False,
        schema=CATALOGO_SCHEMA,
    )
    op.alter_column(
        "producto",
        "id_marca",
        existing_type=sa.Integer(),
        nullable=False,
        schema=CATALOGO_SCHEMA,
    )
