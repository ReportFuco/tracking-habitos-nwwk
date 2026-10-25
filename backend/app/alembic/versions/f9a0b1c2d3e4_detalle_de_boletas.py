"""detalle de boletas y aviso para detallar compras

- ``finanzas.movimiento.comercio``: cadena donde se compró (Líder, Jumbo...), normalizada.
- ``finanzas.movimiento_item.descuento`` y ``descripcion_boleta``: oferta de la línea y el
  texto tal como sale en la boleta, para reconocer el producto en la próxima.
- ``finanzas.preferencia_categoria.pedir_detalle``: la categoría avisa por Push que
  conviene detallar la boleta (null = valor por defecto según el nombre).
- ``finanzas.aviso_detalle_compra``: avisos pendientes y enviados.

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
Create Date: 2026-10-25 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f9a0b1c2d3e4"
down_revision: Union[str, Sequence[str], None] = "e8f9a0b1c2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("movimiento", sa.Column("comercio", sa.String(length=60), nullable=True), schema="finanzas")
    op.add_column("movimiento_item", sa.Column("descuento", sa.Integer(), nullable=True), schema="finanzas")
    op.add_column(
        "movimiento_item",
        sa.Column("descripcion_boleta", sa.String(length=120), nullable=True),
        schema="finanzas",
    )
    op.create_check_constraint(
        "ck_movimiento_item_descuento_no_negativo",
        "movimiento_item",
        "descuento IS NULL OR descuento >= 0",
        schema="finanzas",
    )
    op.add_column(
        "preferencia_categoria",
        sa.Column("pedir_detalle", sa.Boolean(), nullable=True),
        schema="finanzas",
    )
    op.create_table(
        "aviso_detalle_compra",
        sa.Column("id_movimiento", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("enviado_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["id_movimiento"], ["finanzas.movimiento.id_transaccion"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id_movimiento"),
        schema="finanzas",
    )


def downgrade() -> None:
    op.drop_table("aviso_detalle_compra", schema="finanzas")
    op.drop_column("preferencia_categoria", "pedir_detalle", schema="finanzas")
    op.drop_constraint(
        "ck_movimiento_item_descuento_no_negativo", "movimiento_item", schema="finanzas", type_="check"
    )
    op.drop_column("movimiento_item", "descripcion_boleta", schema="finanzas")
    op.drop_column("movimiento_item", "descuento", schema="finanzas")
    op.drop_column("movimiento", "comercio", schema="finanzas")
