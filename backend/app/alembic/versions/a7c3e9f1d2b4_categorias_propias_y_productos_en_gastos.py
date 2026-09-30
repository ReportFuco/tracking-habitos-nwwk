"""categorías propias, productos en gastos y catálogo con aprobación

- ``finanzas.categoria_finanza``: las filas existentes quedan como categorías por defecto
  (``id_usuario`` nulo). Cada usuario puede crear las suyas. El nombre único pasa a ser
  sin distinguir mayúsculas y por grupo (por defecto / de cada usuario). ``activo``
  permite archivar una categoría que ya tiene movimientos.
- ``catalogo.producto``: ``estado`` y ``id_usuario_creador``. Los productos existentes
  quedan aprobados; los nuevos de usuarios nacen pendientes. El código de barra solo es
  único dentro del catálogo aprobado.
- ``finanzas.movimiento_item``: productos detallados dentro de un gasto.
- Se elimina el esquema ``compras`` (cadena, local, compra, compra_detalle,
  movimiento_compra). Los productos pasan a colgar directo del gasto. Al 28-09-2026
  producción no tenía compras ni locales; solo 6 cadenas sin uso.

El downgrade recrea ``compras`` vacío. Si ya hay categorías propias o productos
pendientes con nombres o códigos repetidos, restaurar las restricciones únicas falla:
es intencional, no hay forma de volver sin decidir qué hacer con esos datos.

Revision ID: a7c3e9f1d2b4
Revises: 4356ac9155a5
Create Date: 2026-09-28
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a7c3e9f1d2b4"
down_revision: Union[str, Sequence[str], None] = "4356ac9155a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Categorías por defecto y propias ---------------------------------------------
    op.add_column(
        "categoria_finanza",
        sa.Column("id_usuario", sa.Integer(), nullable=True),
        schema="finanzas",
    )
    op.add_column(
        "categoria_finanza",
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        schema="finanzas",
    )
    op.create_foreign_key(
        "categoria_finanza_id_usuario_fkey",
        "categoria_finanza",
        "usuario",
        ["id_usuario"],
        ["id_usuario"],
        source_schema="finanzas",
        referent_schema="usuarios",
        ondelete="CASCADE",
    )
    op.drop_constraint("categoria_finanza_nombre_key", "categoria_finanza", schema="finanzas", type_="unique")
    op.create_index(
        "uq_categoria_finanza_defecto_nombre",
        "categoria_finanza",
        [sa.text("lower(nombre)")],
        unique=True,
        schema="finanzas",
        postgresql_where=sa.text("id_usuario IS NULL"),
    )
    op.create_index(
        "uq_categoria_finanza_usuario_nombre",
        "categoria_finanza",
        ["id_usuario", sa.text("lower(nombre)")],
        unique=True,
        schema="finanzas",
        postgresql_where=sa.text("id_usuario IS NOT NULL"),
    )

    # --- Catálogo de productos con aprobación ------------------------------------------
    op.add_column(
        "producto",
        sa.Column("id_usuario_creador", sa.Integer(), nullable=True),
        schema="catalogo",
    )
    # Lo que ya existía lo cargó un administrador: queda aprobado. Después el default
    # pasa a 'pendiente', que es lo que corresponde a una propuesta de usuario.
    op.add_column(
        "producto",
        sa.Column("estado", sa.String(length=20), server_default=sa.text("'aprobado'"), nullable=False),
        schema="catalogo",
    )
    op.alter_column("producto", "estado", server_default=sa.text("'pendiente'"), schema="catalogo")
    op.create_check_constraint(
        "ck_producto_estado",
        "producto",
        "estado IN ('pendiente', 'aprobado', 'rechazado')",
        schema="catalogo",
    )
    op.create_foreign_key(
        "producto_id_usuario_creador_fkey",
        "producto",
        "usuario",
        ["id_usuario_creador"],
        ["id_usuario"],
        source_schema="catalogo",
        referent_schema="usuarios",
        ondelete="SET NULL",
    )
    op.drop_constraint("producto_codigo_barra_key", "producto", schema="catalogo", type_="unique")
    op.create_index(
        "uq_producto_codigo_barra_aprobado",
        "producto",
        ["codigo_barra"],
        unique=True,
        schema="catalogo",
        postgresql_where=sa.text("estado = 'aprobado' AND codigo_barra IS NOT NULL"),
    )

    # --- Productos dentro de un gasto --------------------------------------------------
    op.create_table(
        "movimiento_item",
        sa.Column("id_item", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_movimiento", sa.Integer(), nullable=False),
        sa.Column("id_producto", sa.Integer(), nullable=False),
        sa.Column("cantidad", sa.Numeric(10, 3), server_default=sa.text("1"), nullable=False),
        sa.Column("precio_total", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("cantidad > 0", name="ck_movimiento_item_cantidad_positiva"),
        sa.CheckConstraint(
            "precio_total IS NULL OR precio_total >= 0",
            name="ck_movimiento_item_precio_no_negativo",
        ),
        sa.ForeignKeyConstraint(
            ["id_movimiento"],
            ["finanzas.movimiento.id_transaccion"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["id_producto"], ["catalogo.producto.id_producto"]),
        sa.PrimaryKeyConstraint("id_item"),
        schema="finanzas",
    )
    op.create_index(
        "ix_finanzas_movimiento_item_id_movimiento",
        "movimiento_item",
        ["id_movimiento"],
        schema="finanzas",
    )
    op.create_index(
        "ix_finanzas_movimiento_item_id_producto",
        "movimiento_item",
        ["id_producto"],
        schema="finanzas",
    )

    # --- Fin del módulo de compras -----------------------------------------------------
    op.drop_table("movimiento_compra", schema="compras")
    op.drop_table("compra_detalle", schema="compras")
    op.drop_table("compra", schema="compras")
    op.drop_table("local", schema="compras")
    op.drop_table("cadena", schema="compras")
    # Sin CASCADE: si quedara algo en el esquema, mejor que la migración falle.
    op.execute("DROP SCHEMA IF EXISTS compras")


def downgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS compras")
    op.execute(
        """
        CREATE TABLE compras.cadena (
            id_cadena SERIAL PRIMARY KEY,
            nombre_cadena VARCHAR(120) NOT NULL UNIQUE,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
        );
        CREATE TABLE compras.local (
            id_local SERIAL PRIMARY KEY,
            id_cadena INTEGER REFERENCES compras.cadena(id_cadena),
            nombre_local VARCHAR(120) NOT NULL,
            latitud NUMERIC(10, 7),
            longitud NUMERIC(10, 7),
            direccion VARCHAR(255),
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
        );
        CREATE TABLE compras.compra (
            id_compra SERIAL PRIMARY KEY,
            id_local INTEGER NOT NULL REFERENCES compras.local(id_local),
            id_usuario INTEGER NOT NULL REFERENCES usuarios.usuario(id_usuario),
            fecha_compra TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
        );
        CREATE TABLE compras.compra_detalle (
            id_detalle SERIAL PRIMARY KEY,
            id_compra INTEGER NOT NULL REFERENCES compras.compra(id_compra),
            id_producto INTEGER NOT NULL REFERENCES catalogo.producto(id_producto),
            cantidad_comprada NUMERIC(10, 2) NOT NULL,
            unidad_compra VARCHAR(30) NOT NULL,
            precio_unitario NUMERIC(12, 2) NOT NULL,
            precio_total NUMERIC(12, 2) NOT NULL,
            cantidad_unidades INTEGER
        );
        CREATE TABLE compras.movimiento_compra (
            id_movimiento_compra SERIAL PRIMARY KEY,
            id_movimiento INTEGER NOT NULL
                REFERENCES finanzas.movimiento(id_transaccion) ON DELETE CASCADE,
            id_compra INTEGER NOT NULL REFERENCES compras.compra(id_compra) ON DELETE CASCADE,
            monto_asociado NUMERIC(12, 2),
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
            CONSTRAINT uq_movimiento_compra_movimiento_compra UNIQUE (id_movimiento, id_compra)
        );
        """
    )

    op.drop_index("ix_finanzas_movimiento_item_id_producto", table_name="movimiento_item", schema="finanzas")
    op.drop_index("ix_finanzas_movimiento_item_id_movimiento", table_name="movimiento_item", schema="finanzas")
    op.drop_table("movimiento_item", schema="finanzas")

    op.drop_index("uq_producto_codigo_barra_aprobado", table_name="producto", schema="catalogo")
    op.create_unique_constraint("producto_codigo_barra_key", "producto", ["codigo_barra"], schema="catalogo")
    op.drop_constraint("producto_id_usuario_creador_fkey", "producto", schema="catalogo", type_="foreignkey")
    op.drop_constraint("ck_producto_estado", "producto", schema="catalogo", type_="check")
    op.drop_column("producto", "estado", schema="catalogo")
    op.drop_column("producto", "id_usuario_creador", schema="catalogo")

    op.drop_index("uq_categoria_finanza_usuario_nombre", table_name="categoria_finanza", schema="finanzas")
    op.drop_index("uq_categoria_finanza_defecto_nombre", table_name="categoria_finanza", schema="finanzas")
    op.create_unique_constraint("categoria_finanza_nombre_key", "categoria_finanza", ["nombre"], schema="finanzas")
    op.drop_constraint("categoria_finanza_id_usuario_fkey", "categoria_finanza", schema="finanzas", type_="foreignkey")
    op.drop_column("categoria_finanza", "activo", schema="finanzas")
    op.drop_column("categoria_finanza", "id_usuario", schema="finanzas")
