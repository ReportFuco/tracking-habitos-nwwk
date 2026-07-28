"""add movimiento_compra and nullable local cadena

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-19 17:10:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "local",
        "id_cadena",
        existing_type=sa.Integer(),
        nullable=True,
        schema="compras",
    )

    op.create_table(
        "movimiento_compra",
        sa.Column("id_movimiento_compra", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_movimiento", sa.Integer(), nullable=False),
        sa.Column("id_compra", sa.Integer(), nullable=False),
        sa.Column("monto_asociado", sa.Numeric(12, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["id_movimiento"],
            ["finanzas.movimiento.id_transaccion"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["id_compra"],
            ["compras.compra.id_compra"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id_movimiento_compra"),
        sa.UniqueConstraint("id_movimiento", "id_compra", name="uq_movimiento_compra_movimiento_compra"),
        schema="compras",
    )


def downgrade() -> None:
    op.drop_table("movimiento_compra", schema="compras")

    op.alter_column(
        "local",
        "id_cadena",
        existing_type=sa.Integer(),
        nullable=False,
        schema="compras",
    )
