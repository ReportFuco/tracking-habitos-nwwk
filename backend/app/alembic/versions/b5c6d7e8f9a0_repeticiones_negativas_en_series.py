"""repeticiones negativas en series

Cuantas negativas (fase excentrica, normalmente asistidas al fallo) se hicieron al final
de una serie, aparte de sus repeticiones. Las series existentes quedan en 0.

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
Create Date: 2026-10-16 10:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b5c6d7e8f9a0"
down_revision: Union[str, Sequence[str], None] = "a4b5c6d7e8f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "serie_fuerza",
        sa.Column(
            "repeticiones_negativas",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        schema="entrenamientos",
    )
    op.create_check_constraint(
        "ck_serie_fuerza_negativas_rango",
        "serie_fuerza",
        "repeticiones_negativas BETWEEN 0 AND 50",
        schema="entrenamientos",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_serie_fuerza_negativas_rango", "serie_fuerza", schema="entrenamientos", type_="check"
    )
    op.drop_column("serie_fuerza", "repeticiones_negativas", schema="entrenamientos")
