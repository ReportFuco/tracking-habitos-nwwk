"""fix exercise subcategory classification

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-05-06 11:55:00.000000

"""

from typing import Sequence, Union

from alembic import op


revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, Sequence[str], None] = "a2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE entrenamientos.ejercicios
        SET id_subcategoria_musculo = CASE
            WHEN lower(nombre) LIKE '%tricep%polea alta%' THEN 7
            WHEN lower(nombre) LIKE '%prensa pecho%' THEN 11
            ELSE id_subcategoria_musculo
        END
        WHERE lower(nombre) LIKE '%tricep%polea alta%'
           OR lower(nombre) LIKE '%prensa pecho%';
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE entrenamientos.ejercicios
        SET id_subcategoria_musculo = CASE
            WHEN lower(nombre) LIKE '%tricep%polea alta%' THEN 12
            WHEN lower(nombre) LIKE '%prensa pecho%' THEN 9
            ELSE id_subcategoria_musculo
        END
        WHERE lower(nombre) LIKE '%tricep%polea alta%'
           OR lower(nombre) LIKE '%prensa pecho%';
        """
    )
