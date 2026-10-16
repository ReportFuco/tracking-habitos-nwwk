"""seguimiento ia de entrenamientos

Notas que un asistente de IA deja al usuario por MCP (seguimiento, sugerencias, alertas
de sobrecarga, planes) y que se leen en la pestaña Seguimiento del modulo.

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a0
Create Date: 2026-10-16 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c6d7e8f9a0b1"
down_revision: Union[str, Sequence[str], None] = "b5c6d7e8f9a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "seguimiento_ia",
        sa.Column("id_seguimiento", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_usuario", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.String(length=20), nullable=False),
        sa.Column("titulo", sa.String(length=160), nullable=False),
        sa.Column("contenido", sa.Text(), nullable=False),
        sa.Column("zonas", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("origen", sa.String(length=120), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "tipo IN ('seguimiento', 'sugerencia', 'alerta', 'plan')",
            name="ck_seguimiento_ia_tipo",
        ),
        sa.ForeignKeyConstraint(
            ["id_usuario"], ["usuarios.usuario.id_usuario"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id_seguimiento"),
        schema="entrenamientos",
    )
    op.create_index(
        "ix_entrenamientos_seguimiento_ia_id_usuario",
        "seguimiento_ia",
        ["id_usuario"],
        schema="entrenamientos",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_entrenamientos_seguimiento_ia_id_usuario",
        table_name="seguimiento_ia",
        schema="entrenamientos",
    )
    op.drop_table("seguimiento_ia", schema="entrenamientos")
