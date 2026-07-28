"""classify existing exercises subcategories

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-05-06 11:45:00.000000

"""

from typing import Sequence, Union

from alembic import op


revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE entrenamientos.ejercicios
        SET id_subcategoria_musculo = CASE
            WHEN lower(nombre) LIKE '%tricep%polea alta%' THEN 7
            WHEN lower(nombre) LIKE '%press francés%' THEN 6
            WHEN lower(nombre) LIKE '%extension de tricep%' THEN 7
            WHEN lower(nombre) LIKE '%extensión de tricep%' THEN 7
            WHEN lower(nombre) LIKE '%fondos%' THEN 7
            WHEN lower(nombre) LIKE '%inclinad%' THEN 10
            WHEN lower(nombre) LIKE '%polea baja%' THEN 10
            WHEN lower(nombre) LIKE '%polea alta%' THEN 12
            WHEN lower(nombre) LIKE '%press banca%' THEN 11
            WHEN lower(nombre) LIKE '%prensa pecho%' THEN 11
            WHEN lower(nombre) LIKE '%aperturas%' THEN 11
            WHEN lower(nombre) LIKE '%mariposa%' THEN 11
            WHEN lower(nombre) LIKE '%press militar%' THEN 14
            WHEN lower(nombre) LIKE '%elevaciones frontales%' THEN 14
            WHEN lower(nombre) LIKE '%elevaciones laterales%' THEN 15
            WHEN lower(nombre) LIKE '%deltoides trasero%' THEN 16
            WHEN lower(nombre) LIKE '%martillo%' THEN 4
            WHEN lower(nombre) LIKE '%araña%' THEN 3
            WHEN lower(nombre) LIKE '%predicador%' THEN 3
            WHEN lower(nombre) LIKE '%jalón%' THEN 18
            WHEN lower(nombre) LIKE '%jalon%' THEN 18
            WHEN lower(nombre) LIKE '%remo%' THEN 20
            ELSE id_subcategoria_musculo
        END
        WHERE id_subcategoria_musculo IN (1, 5, 9, 13, 17, 23);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE entrenamientos.ejercicios e
        SET id_subcategoria_musculo = sm_general.id_subcategoria_musculo
        FROM entrenamientos.subcategoria_musculo sm_actual
        JOIN entrenamientos.subcategoria_musculo sm_general
          ON sm_general.id_musculo = sm_actual.id_musculo
         AND sm_general.codigo = 'general'
        WHERE sm_actual.id_subcategoria_musculo = e.id_subcategoria_musculo
          AND e.id_ejercicio IN (
              SELECT id_ejercicio
              FROM entrenamientos.ejercicios
              WHERE lower(nombre) LIKE '%inclinad%'
                 OR lower(nombre) LIKE '%polea baja%'
                 OR lower(nombre) LIKE '%polea alta%'
                 OR lower(nombre) LIKE '%press banca%'
                 OR lower(nombre) LIKE '%prensa pecho%'
                 OR lower(nombre) LIKE '%aperturas%'
                 OR lower(nombre) LIKE '%mariposa%'
                 OR lower(nombre) LIKE '%press militar%'
                 OR lower(nombre) LIKE '%elevaciones frontales%'
                 OR lower(nombre) LIKE '%elevaciones laterales%'
                 OR lower(nombre) LIKE '%deltoides trasero%'
                 OR lower(nombre) LIKE '%martillo%'
                 OR lower(nombre) LIKE '%araña%'
                 OR lower(nombre) LIKE '%predicador%'
                 OR lower(nombre) LIKE '%press francés%'
                 OR lower(nombre) LIKE '%extension de tricep%'
                 OR lower(nombre) LIKE '%extensión de tricep%'
                 OR lower(nombre) LIKE '%fondos%'
                 OR lower(nombre) LIKE '%jalón%'
                 OR lower(nombre) LIKE '%jalon%'
                 OR lower(nombre) LIKE '%remo%'
          );
        """
    )
