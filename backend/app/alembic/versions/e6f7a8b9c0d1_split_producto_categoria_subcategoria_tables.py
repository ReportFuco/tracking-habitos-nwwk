"""split producto categoria and subcategoria into separate tables

Revision ID: e6f7a8b9c0d1
Revises: d4e5f6a7b8c9
Create Date: 2026-04-20 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "categoria_producto",
        sa.Column("id_categoria", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre_categoria", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id_categoria"),
        sa.UniqueConstraint("nombre_categoria"),
        schema="catalogo",
    )

    op.create_table(
        "subcategoria_producto",
        sa.Column("id_subcategoria", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_categoria", sa.Integer(), nullable=False),
        sa.Column("nombre_subcategoria", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["id_categoria"], ["catalogo.categoria_producto.id_categoria"]),
        sa.PrimaryKeyConstraint("id_subcategoria"),
        sa.UniqueConstraint(
            "id_categoria",
            "nombre_subcategoria",
            name="uq_subcategoria_producto_categoria_nombre",
        ),
        schema="catalogo",
    )

    op.add_column("producto", sa.Column("id_categoria", sa.Integer(), nullable=True), schema="catalogo")
    op.add_column("producto", sa.Column("id_subcategoria", sa.Integer(), nullable=True), schema="catalogo")

    op.create_foreign_key(
        "fk_producto_categoria_producto",
        "producto",
        "categoria_producto",
        ["id_categoria"],
        ["id_categoria"],
        source_schema="catalogo",
        referent_schema="catalogo",
    )
    op.create_foreign_key(
        "fk_producto_subcategoria_producto",
        "producto",
        "subcategoria_producto",
        ["id_subcategoria"],
        ["id_subcategoria"],
        source_schema="catalogo",
        referent_schema="catalogo",
    )

    op.execute(
        """
        INSERT INTO catalogo.categoria_producto (nombre_categoria)
        SELECT DISTINCT
            COALESCE(NULLIF(trim(categoria), ''), 'SIN_CATEGORIA') AS categoria_normalizada
        FROM catalogo.producto
        WHERE categoria IS NOT NULL OR subcategoria IS NOT NULL
        """
    )

    op.execute(
        """
        UPDATE catalogo.producto p
        SET id_categoria = c.id_categoria
        FROM catalogo.categoria_producto c
        WHERE c.nombre_categoria = COALESCE(NULLIF(trim(p.categoria), ''), 'SIN_CATEGORIA')
          AND (p.categoria IS NOT NULL OR p.subcategoria IS NOT NULL)
        """
    )

    op.execute(
        """
        INSERT INTO catalogo.subcategoria_producto (id_categoria, nombre_subcategoria)
        SELECT DISTINCT
            p.id_categoria,
            trim(p.subcategoria)
        FROM catalogo.producto p
        WHERE p.id_categoria IS NOT NULL
          AND p.subcategoria IS NOT NULL
          AND trim(p.subcategoria) <> ''
        """
    )

    op.execute(
        """
        UPDATE catalogo.producto p
        SET id_subcategoria = s.id_subcategoria
        FROM catalogo.subcategoria_producto s
        WHERE s.id_categoria = p.id_categoria
          AND s.nombre_subcategoria = trim(p.subcategoria)
          AND p.subcategoria IS NOT NULL
          AND trim(p.subcategoria) <> ''
        """
    )

    op.drop_column("producto", "subcategoria", schema="catalogo")
    op.drop_column("producto", "categoria", schema="catalogo")


def downgrade() -> None:
    op.add_column("producto", sa.Column("categoria", sa.String(length=100), nullable=True), schema="catalogo")
    op.add_column("producto", sa.Column("subcategoria", sa.String(length=100), nullable=True), schema="catalogo")

    op.execute(
        """
        UPDATE catalogo.producto p
        SET categoria = c.nombre_categoria
        FROM catalogo.categoria_producto c
        WHERE c.id_categoria = p.id_categoria
        """
    )

    op.execute(
        """
        UPDATE catalogo.producto p
        SET subcategoria = s.nombre_subcategoria
        FROM catalogo.subcategoria_producto s
        WHERE s.id_subcategoria = p.id_subcategoria
        """
    )

    op.drop_constraint(
        "fk_producto_subcategoria_producto",
        "producto",
        schema="catalogo",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_producto_categoria_producto",
        "producto",
        schema="catalogo",
        type_="foreignkey",
    )

    op.drop_column("producto", "id_subcategoria", schema="catalogo")
    op.drop_column("producto", "id_categoria", schema="catalogo")

    op.drop_table("subcategoria_producto", schema="catalogo")
    op.drop_table("categoria_producto", schema="catalogo")
