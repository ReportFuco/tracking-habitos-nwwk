"""pg_trgm para buscar productos tolerando errores de tipeo

La búsqueda del catálogo usa ``word_similarity`` para encontrar "Monster" aunque se
escriba "mosnter". ``pg_trgm`` es una extensión *trusted* desde PostgreSQL 13: la puede
crear el dueño de la base sin ser superusuario (en producción lo es ``tracking_user``).

Revision ID: b8d4f0a2c6e1
Revises: a7c3e9f1d2b4
Create Date: 2026-09-30
"""

from typing import Sequence, Union

from alembic import op


revision: str = "b8d4f0a2c6e1"
down_revision: Union[str, Sequence[str], None] = "a7c3e9f1d2b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
