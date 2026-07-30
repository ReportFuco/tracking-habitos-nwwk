"""extend musculo catalog and add ejercicio media columns

Amplía el catálogo muscular con los grupos que faltaban para poder clasificar el dataset
público de ejercicios, y agrega a `ejercicios` las columnas de media, equipamiento e
instrucciones que ese dataset aporta.

Todas las columnas nuevas son nullable: los ejercicios que el usuario creó a mano no
tienen imagen ni instrucciones y tienen que seguir siendo válidos.

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-07-30 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, Sequence[str], None] = "b8c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SCHEMA = "entrenamientos"

# Ids explícitos y contiguos a los que ya existen (músculos 1-11, subcategorías 1-45):
# el catálogo se referencia por id desde `ejercicios`, así que no puede depender del
# orden de inserción.
MUSCULOS_NUEVOS = (
    (12, "aductor", "Aductores"),
    (13, "abductor", "Abductores"),
    (14, "serrato", "Serrato anterior"),
    (15, "cuello", "Cuello"),
    (16, "cardio", "Cardio"),
)

SUBCATEGORIAS_NUEVAS = (
    (46, 12, "general", "General"),
    (47, 13, "general", "General"),
    (48, 14, "general", "General"),
    (49, 15, "general", "General"),
    (50, 16, "general", "General"),
)

COLUMNAS_NUEVAS = (
    # Id del ejercicio en el dataset de origen. Es la clave con la que la importación
    # reconoce lo que ya insertó, para poder reejecutarse sin duplicar.
    sa.Column("codigo_externo", sa.String(length=16), nullable=True),
    sa.Column("nombre_original", sa.String(length=160), nullable=True),
    sa.Column("equipamiento", sa.String(length=60), nullable=True),
    sa.Column("musculos_secundarios", postgresql.JSONB(), nullable=True),
    sa.Column("instrucciones", postgresql.JSONB(), nullable=True),
    sa.Column("url_imagen", sa.String(length=255), nullable=True),
    sa.Column("url_animacion", sa.String(length=255), nullable=True),
    sa.Column("atribucion", sa.String(length=200), nullable=True),
)


def upgrade() -> None:
    musculo = sa.table(
        "musculo",
        sa.column("id_musculo", sa.SmallInteger),
        sa.column("codigo", sa.String),
        sa.column("nombre", sa.String),
        schema=SCHEMA,
    )
    op.bulk_insert(
        musculo,
        [
            {"id_musculo": id_, "codigo": codigo, "nombre": nombre}
            for id_, codigo, nombre in MUSCULOS_NUEVOS
        ],
    )

    subcategoria = sa.table(
        "subcategoria_musculo",
        sa.column("id_subcategoria_musculo", sa.SmallInteger),
        sa.column("id_musculo", sa.SmallInteger),
        sa.column("codigo", sa.String),
        sa.column("nombre", sa.String),
        schema=SCHEMA,
    )
    op.bulk_insert(
        subcategoria,
        [
            {
                "id_subcategoria_musculo": id_,
                "id_musculo": id_musculo,
                "codigo": codigo,
                "nombre": nombre,
            }
            for id_, id_musculo, codigo, nombre in SUBCATEGORIAS_NUEVAS
        ],
    )

    for columna in COLUMNAS_NUEVAS:
        op.add_column("ejercicios", columna, schema=SCHEMA)

    # Los nombres traducidos del dataset llegan a 93 caracteres y el límite anterior era
    # de 100, demasiado justo para lo que se pueda editar después.
    op.alter_column(
        "ejercicios",
        "nombre",
        existing_type=sa.String(length=100),
        type_=sa.String(length=160),
        existing_nullable=False,
        schema=SCHEMA,
    )

    op.create_unique_constraint(
        "uq_ejercicios_codigo_externo",
        "ejercicios",
        ["codigo_externo"],
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_ejercicios_codigo_externo", "ejercicios", schema=SCHEMA, type_="unique"
    )

    op.alter_column(
        "ejercicios",
        "nombre",
        existing_type=sa.String(length=160),
        type_=sa.String(length=100),
        existing_nullable=False,
        schema=SCHEMA,
    )

    for columna in reversed(COLUMNAS_NUEVAS):
        op.drop_column("ejercicios", columna.name, schema=SCHEMA)

    ids_subcategorias = tuple(id_ for id_, *_ in SUBCATEGORIAS_NUEVAS)
    ids_musculos = tuple(id_ for id_, *_ in MUSCULOS_NUEVOS)

    op.execute(
        sa.text(
            f"DELETE FROM {SCHEMA}.subcategoria_musculo "
            f"WHERE id_subcategoria_musculo IN {ids_subcategorias}"
        )
    )
    op.execute(
        sa.text(
            f"DELETE FROM {SCHEMA}.musculo WHERE id_musculo IN {ids_musculos}"
        )
    )
