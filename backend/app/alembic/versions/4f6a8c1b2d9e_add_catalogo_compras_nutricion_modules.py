"""add catalogo compras y nutricion schemas

Revision ID: 4f6a8c1b2d9e
Revises: 878727dff0b2
Create Date: 2026-04-18 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4f6a8c1b2d9e"
down_revision: Union[str, Sequence[str], None] = "878727dff0b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SCHEMAS = ("catalogo", "compras", "nutricion")


def upgrade() -> None:
    for schema in SCHEMAS:
        op.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')

    op.create_table(
        "marca",
        sa.Column("id_marca", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre_marca", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id_marca"),
        sa.UniqueConstraint("nombre_marca"),
        schema="catalogo",
    )

    op.create_table(
        "cadena",
        sa.Column("id_cadena", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre_cadena", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id_cadena"),
        sa.UniqueConstraint("nombre_cadena"),
        schema="compras",
    )

    op.create_table(
        "producto",
        sa.Column("id_producto", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_marca", sa.Integer(), nullable=False),
        sa.Column("nombre_producto", sa.String(length=160), nullable=False),
        sa.Column("codigo_barra", sa.String(length=64), nullable=False),
        sa.Column("categoria", sa.String(length=100), nullable=True),
        sa.Column("subcategoria", sa.String(length=100), nullable=True),
        sa.Column("sabor", sa.String(length=100), nullable=True),
        sa.Column("formato", sa.String(length=100), nullable=True),
        sa.Column("contenido_neto", sa.Numeric(10, 2), nullable=True),
        sa.Column("unidad_contenido", sa.String(length=30), nullable=True),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["id_marca"], ["catalogo.marca.id_marca"]),
        sa.PrimaryKeyConstraint("id_producto"),
        sa.UniqueConstraint("codigo_barra"),
        schema="catalogo",
    )

    op.create_table(
        "local",
        sa.Column("id_local", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_cadena", sa.Integer(), nullable=False),
        sa.Column("nombre_local", sa.String(length=120), nullable=False),
        sa.Column("latitud", sa.Numeric(10, 7), nullable=True),
        sa.Column("longitud", sa.Numeric(10, 7), nullable=True),
        sa.Column("direccion", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["id_cadena"], ["compras.cadena.id_cadena"]),
        sa.PrimaryKeyConstraint("id_local"),
        schema="compras",
    )

    op.create_table(
        "tabla_nutricional",
        sa.Column("id_tabla", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_producto", sa.Integer(), nullable=False),
        sa.Column("porcion_cantidad", sa.Numeric(10, 2), nullable=True),
        sa.Column("porcion_unidad", sa.String(length=30), nullable=True),
        sa.Column("calorias", sa.Numeric(10, 2), nullable=True),
        sa.Column("proteinas", sa.Numeric(10, 2), nullable=True),
        sa.Column("carbohidratos", sa.Numeric(10, 2), nullable=True),
        sa.Column("grasas", sa.Numeric(10, 2), nullable=True),
        sa.Column("azucares", sa.Numeric(10, 2), nullable=True),
        sa.Column("sodio", sa.Numeric(10, 2), nullable=True),
        sa.Column("fibra", sa.Numeric(10, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["id_producto"], ["catalogo.producto.id_producto"]),
        sa.PrimaryKeyConstraint("id_tabla"),
        schema="nutricion",
    )

    op.create_table(
        "compra",
        sa.Column("id_compra", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_local", sa.Integer(), nullable=False),
        sa.Column("id_usuario", sa.Integer(), nullable=False),
        sa.Column("fecha_compra", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["id_local"], ["compras.local.id_local"]),
        sa.ForeignKeyConstraint(["id_usuario"], ["usuarios.usuario.id_usuario"]),
        sa.PrimaryKeyConstraint("id_compra"),
        schema="compras",
    )

    op.create_table(
        "meta_nutricional",
        sa.Column("id_meta", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_usuario", sa.Integer(), nullable=False),
        sa.Column("fecha_inicio", sa.Date(), nullable=False),
        sa.Column("fecha_fin", sa.Date(), nullable=True),
        sa.Column("calorias_objetivo", sa.Integer(), nullable=True),
        sa.Column("proteinas_objetivo", sa.Integer(), nullable=True),
        sa.Column("carbohidratos_objetivo", sa.Integer(), nullable=True),
        sa.Column("grasas_objetivo", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["id_usuario"], ["usuarios.usuario.id_usuario"]),
        sa.PrimaryKeyConstraint("id_meta"),
        schema="nutricion",
    )

    op.create_table(
        "peso_usuario",
        sa.Column("id_peso", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_usuario", sa.Integer(), nullable=False),
        sa.Column("fecha_registro", sa.Date(), nullable=False),
        sa.Column("peso_kg", sa.Numeric(6, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["id_usuario"], ["usuarios.usuario.id_usuario"]),
        sa.PrimaryKeyConstraint("id_peso"),
        schema="nutricion",
    )

    op.create_table(
        "consumo",
        sa.Column("id_consumo", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_usuario", sa.Integer(), nullable=False),
        sa.Column("fecha_consumo", sa.DateTime(), nullable=False),
        sa.Column("tipo_comida", sa.String(length=80), nullable=False),
        sa.Column("observacion", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["id_usuario"], ["usuarios.usuario.id_usuario"]),
        sa.PrimaryKeyConstraint("id_consumo"),
        schema="nutricion",
    )

    op.create_table(
        "compra_detalle",
        sa.Column("id_detalle", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_compra", sa.Integer(), nullable=False),
        sa.Column("id_producto", sa.Integer(), nullable=False),
        sa.Column("cantidad_comprada", sa.Numeric(10, 2), nullable=False),
        sa.Column("unidad_compra", sa.String(length=30), nullable=False),
        sa.Column("precio_unitario", sa.Numeric(12, 2), nullable=False),
        sa.Column("precio_total", sa.Numeric(12, 2), nullable=False),
        sa.Column("cantidad_unidades", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["id_compra"], ["compras.compra.id_compra"]),
        sa.ForeignKeyConstraint(["id_producto"], ["catalogo.producto.id_producto"]),
        sa.PrimaryKeyConstraint("id_detalle"),
        schema="compras",
    )

    op.create_table(
        "consumo_detalle",
        sa.Column("id_consumo_detalle", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_consumo", sa.Integer(), nullable=False),
        sa.Column("id_producto", sa.Integer(), nullable=False),
        sa.Column("cantidad_consumida", sa.Numeric(10, 2), nullable=False),
        sa.Column("unidad_consumida", sa.String(length=30), nullable=False),
        sa.ForeignKeyConstraint(["id_consumo"], ["nutricion.consumo.id_consumo"]),
        sa.ForeignKeyConstraint(["id_producto"], ["catalogo.producto.id_producto"]),
        sa.PrimaryKeyConstraint("id_consumo_detalle"),
        schema="nutricion",
    )


def downgrade() -> None:
    op.drop_table("consumo_detalle", schema="nutricion")
    op.drop_table("compra_detalle", schema="compras")
    op.drop_table("consumo", schema="nutricion")
    op.drop_table("peso_usuario", schema="nutricion")
    op.drop_table("meta_nutricional", schema="nutricion")
    op.drop_table("compra", schema="compras")
    op.drop_table("tabla_nutricional", schema="nutricion")
    op.drop_table("local", schema="compras")
    op.drop_table("producto", schema="catalogo")
    op.drop_table("cadena", schema="compras")
    op.drop_table("marca", schema="catalogo")

    for schema in reversed(SCHEMAS):
        op.execute(f'DROP SCHEMA IF EXISTS "{schema}"')
