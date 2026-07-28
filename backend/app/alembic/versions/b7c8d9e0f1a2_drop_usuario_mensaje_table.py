"""drop usuarios.mensaje table

Revision ID: b7c8d9e0f1a2
Revises: a1b2c3d4e5f6
Create Date: 2026-04-19 15:20:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7c8d9e0f1a2"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("mensaje", schema="usuarios")


def downgrade() -> None:
    op.create_table(
        "mensaje",
        sa.Column("id_mensaje", sa.BigInteger(), nullable=False),
        sa.Column("id_usuario", sa.Integer(), nullable=False),
        sa.Column("contenido", sa.Text(), nullable=False),
        sa.Column("direccion", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["id_usuario"], ["usuarios.usuario.id_usuario"]),
        sa.PrimaryKeyConstraint("id_mensaje"),
        schema="usuarios",
    )
