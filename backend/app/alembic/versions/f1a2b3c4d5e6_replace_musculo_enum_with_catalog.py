"""replace musculo enum with catalog

Revision ID: f1a2b3c4d5e6
Revises: e6f7a8b9c0d1
Create Date: 2026-05-06 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "e6f7a8b9c0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


MUSCULOS = (
    (1, "bicep", "Bíceps"),
    (2, "tricep", "Tríceps"),
    (3, "pecho", "Pecho"),
    (4, "hombro", "Hombro"),
    (5, "espalda", "Espalda"),
    (6, "cuadricep", "Cuádriceps"),
    (7, "femoral", "Femoral"),
    (8, "gluteo", "Glúteo"),
    (9, "pantorrilla", "Pantorrilla"),
    (10, "abdomen", "Abdomen"),
    (11, "antebrazo", "Antebrazo"),
)


SUBCATEGORIAS = (
    (1, 1, "general", "General"),
    (2, 1, "cabeza_larga", "Cabeza larga"),
    (3, 1, "cabeza_corta", "Cabeza corta"),
    (4, 1, "braquial", "Braquial"),
    (5, 2, "general", "General"),
    (6, 2, "cabeza_larga", "Cabeza larga"),
    (7, 2, "cabeza_lateral", "Cabeza lateral"),
    (8, 2, "cabeza_medial", "Cabeza medial"),
    (9, 3, "general", "General"),
    (10, 3, "superior", "Superior"),
    (11, 3, "medio", "Medio"),
    (12, 3, "inferior", "Inferior"),
    (13, 4, "general", "General"),
    (14, 4, "anterior", "Anterior"),
    (15, 4, "lateral", "Lateral"),
    (16, 4, "posterior", "Posterior"),
    (17, 5, "general", "General"),
    (18, 5, "dorsales", "Dorsales"),
    (19, 5, "trapecio", "Trapecio"),
    (20, 5, "romboides", "Romboides"),
    (21, 5, "espalda_alta", "Espalda alta"),
    (22, 5, "espalda_baja", "Espalda baja"),
    (23, 6, "general", "General"),
    (24, 6, "recto_femoral", "Recto femoral"),
    (25, 6, "vasto_lateral", "Vasto lateral"),
    (26, 6, "vasto_medial", "Vasto medial"),
    (27, 6, "vasto_intermedio", "Vasto intermedio"),
    (28, 7, "general", "General"),
    (29, 7, "biceps_femoral", "Bíceps femoral"),
    (30, 7, "semitendinoso", "Semitendinoso"),
    (31, 7, "semimembranoso", "Semimembranoso"),
    (32, 8, "general", "General"),
    (33, 8, "gluteo_mayor", "Glúteo mayor"),
    (34, 8, "gluteo_medio", "Glúteo medio"),
    (35, 8, "gluteo_menor", "Glúteo menor"),
    (36, 9, "general", "General"),
    (37, 9, "gastrocnemio", "Gastrocnemio"),
    (38, 9, "soleo", "Sóleo"),
    (39, 10, "general", "General"),
    (40, 10, "recto_abdominal", "Recto abdominal"),
    (41, 10, "oblicuos", "Oblicuos"),
    (42, 10, "transverso", "Transverso"),
    (43, 11, "general", "General"),
    (44, 11, "flexores", "Flexores"),
    (45, 11, "extensores", "Extensores"),
)


def upgrade() -> None:
    op.create_table(
        "musculo",
        sa.Column("id_musculo", sa.SmallInteger(), nullable=False),
        sa.Column("codigo", sa.String(length=40), nullable=False),
        sa.Column("nombre", sa.String(length=80), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id_musculo"),
        sa.UniqueConstraint("codigo"),
        sa.UniqueConstraint("nombre"),
        schema="entrenamientos",
    )

    op.create_table(
        "subcategoria_musculo",
        sa.Column("id_subcategoria_musculo", sa.SmallInteger(), nullable=False),
        sa.Column("id_musculo", sa.SmallInteger(), nullable=False),
        sa.Column("codigo", sa.String(length=60), nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["id_musculo"], ["entrenamientos.musculo.id_musculo"]),
        sa.PrimaryKeyConstraint("id_subcategoria_musculo"),
        sa.UniqueConstraint("id_musculo", "codigo", name="uq_subcategoria_musculo_musculo_codigo"),
        sa.UniqueConstraint("id_musculo", "nombre", name="uq_subcategoria_musculo_musculo_nombre"),
        schema="entrenamientos",
    )

    musculo_table = sa.table(
        "musculo",
        sa.column("id_musculo", sa.SmallInteger),
        sa.column("codigo", sa.String),
        sa.column("nombre", sa.String),
        schema="entrenamientos",
    )
    op.bulk_insert(
        musculo_table,
        [{"id_musculo": id_, "codigo": codigo, "nombre": nombre} for id_, codigo, nombre in MUSCULOS],
    )

    subcategoria_table = sa.table(
        "subcategoria_musculo",
        sa.column("id_subcategoria_musculo", sa.SmallInteger),
        sa.column("id_musculo", sa.SmallInteger),
        sa.column("codigo", sa.String),
        sa.column("nombre", sa.String),
        schema="entrenamientos",
    )
    op.bulk_insert(
        subcategoria_table,
        [
            {
                "id_subcategoria_musculo": id_,
                "id_musculo": id_musculo,
                "codigo": codigo,
                "nombre": nombre,
            }
            for id_, id_musculo, codigo, nombre in SUBCATEGORIAS
        ],
    )

    op.add_column(
        "ejercicios",
        sa.Column("id_subcategoria_musculo", sa.SmallInteger(), nullable=True),
        schema="entrenamientos",
    )
    op.create_foreign_key(
        "fk_ejercicios_subcategoria_musculo",
        "ejercicios",
        "subcategoria_musculo",
        ["id_subcategoria_musculo"],
        ["id_subcategoria_musculo"],
        source_schema="entrenamientos",
        referent_schema="entrenamientos",
    )

    op.execute(
        """
        UPDATE entrenamientos.ejercicios e
        SET id_subcategoria_musculo = sm.id_subcategoria_musculo
        FROM entrenamientos.musculo m
        JOIN entrenamientos.subcategoria_musculo sm
          ON sm.id_musculo = m.id_musculo
         AND sm.codigo = 'general'
        WHERE m.codigo = e.tipo::text;
        """
    )

    op.alter_column(
        "ejercicios",
        "id_subcategoria_musculo",
        existing_type=sa.SmallInteger(),
        nullable=False,
        schema="entrenamientos",
    )
    op.drop_column("ejercicios", "tipo", schema="entrenamientos")
    op.execute("DROP TYPE IF EXISTS entrenamientos.musculos")


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE t.typname = 'musculos'
                  AND n.nspname = 'entrenamientos'
            ) THEN
                CREATE TYPE entrenamientos.musculos AS ENUM (
                    'bicep',
                    'tricep',
                    'pecho',
                    'hombro',
                    'espalda',
                    'cuadricep'
                );
            END IF;
        END $$;
        """
    )

    op.add_column(
        "ejercicios",
        sa.Column(
            "tipo",
            sa.Enum(
                "bicep",
                "tricep",
                "pecho",
                "hombro",
                "espalda",
                "cuadricep",
                name="musculos",
                schema="entrenamientos",
            ),
            nullable=True,
        ),
        schema="entrenamientos",
    )

    op.execute(
        """
        UPDATE entrenamientos.ejercicios e
        SET tipo = CASE
            WHEN m.codigo IN ('bicep', 'tricep', 'pecho', 'hombro', 'espalda', 'cuadricep')
            THEN m.codigo::entrenamientos.musculos
            ELSE 'espalda'::entrenamientos.musculos
        END
        FROM entrenamientos.subcategoria_musculo sm
        JOIN entrenamientos.musculo m ON m.id_musculo = sm.id_musculo
        WHERE sm.id_subcategoria_musculo = e.id_subcategoria_musculo;
        """
    )

    op.alter_column(
        "ejercicios",
        "tipo",
        existing_type=sa.Enum(
            "bicep",
            "tricep",
            "pecho",
            "hombro",
            "espalda",
            "cuadricep",
            name="musculos",
            schema="entrenamientos",
        ),
        nullable=False,
        schema="entrenamientos",
    )
    op.drop_constraint(
        "fk_ejercicios_subcategoria_musculo",
        "ejercicios",
        schema="entrenamientos",
        type_="foreignkey",
    )
    op.drop_column("ejercicios", "id_subcategoria_musculo", schema="entrenamientos")
    op.drop_table("subcategoria_musculo", schema="entrenamientos")
    op.drop_table("musculo", schema="entrenamientos")
