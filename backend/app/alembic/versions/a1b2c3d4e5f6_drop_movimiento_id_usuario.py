"""drop movimiento id_usuario and infer ownership from cuenta

Revision ID: a1b2c3d4e5f6
Revises: 9f2c7a1d4e6b
Create Date: 2026-04-19 15:05:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "9f2c7a1d4e6b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE finanzas.movimiento
        DROP CONSTRAINT IF EXISTS movimiento_id_usuario_fkey;
        """
    )
    op.drop_column("movimiento", "id_usuario", schema="finanzas")


def downgrade() -> None:
    op.add_column(
        "movimiento",
        sa.Column("id_usuario", sa.Integer(), nullable=True),
        schema="finanzas",
    )

    op.execute(
        """
        UPDATE finanzas.movimiento mov
        SET id_usuario = cb.id_usuario
        FROM finanzas.cuenta_bancaria cb
        WHERE cb.id_cuenta = mov.id_cuenta;
        """
    )

    op.alter_column(
        "movimiento",
        "id_usuario",
        existing_type=sa.Integer(),
        nullable=False,
        schema="finanzas",
    )

    op.create_foreign_key(
        "movimiento_id_usuario_fkey",
        "movimiento",
        "usuario",
        ["id_usuario"],
        ["id_usuario"],
        source_schema="finanzas",
        referent_schema="usuarios",
    )
