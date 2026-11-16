"""calorias y macros por linea de consumo, y alimentos libres

- ``nutricion.consumo_detalle.id_producto`` pasa a ser opcional: una línea puede ser un
  alimento libre (``nombre_alimento``) que no está en el catálogo, por ejemplo un plato
  estimado desde una foto.
- ``calorias``, ``proteinas``, ``carbohidratos`` y ``grasas``: totales de la línea,
  calculados con la tabla nutricional al guardar (producto) o escritos a mano (libre).
- ``estimado``: la línea viene de una estimación aproximada (foto), no de una etiqueta.

Revision ID: a0c1e2b3d4f5
Revises: f9a0b1c2d3e4
Create Date: 2026-11-16 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a0c1e2b3d4f5"
down_revision: Union[str, Sequence[str], None] = "f9a0b1c2d3e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "nutricion"
TABLA = "consumo_detalle"
NUTRIENTES = ("calorias", "proteinas", "carbohidratos", "grasas")


def upgrade() -> None:
    op.alter_column(TABLA, "id_producto", existing_type=sa.Integer(), nullable=True, schema=SCHEMA)
    op.add_column(TABLA, sa.Column("nombre_alimento", sa.String(length=160), nullable=True), schema=SCHEMA)
    for campo in NUTRIENTES:
        op.add_column(TABLA, sa.Column(campo, sa.Numeric(10, 2), nullable=True), schema=SCHEMA)
    op.add_column(
        TABLA,
        sa.Column("estimado", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        schema=SCHEMA,
    )
    op.create_check_constraint(
        "ck_consumo_detalle_producto_o_nombre",
        TABLA,
        "id_producto IS NOT NULL OR nombre_alimento IS NOT NULL",
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_constraint("ck_consumo_detalle_producto_o_nombre", TABLA, schema=SCHEMA, type_="check")
    op.execute(f"DELETE FROM {SCHEMA}.{TABLA} WHERE id_producto IS NULL")
    op.drop_column(TABLA, "estimado", schema=SCHEMA)
    for campo in NUTRIENTES:
        op.drop_column(TABLA, campo, schema=SCHEMA)
    op.drop_column(TABLA, "nombre_alimento", schema=SCHEMA)
    op.alter_column(TABLA, "id_producto", existing_type=sa.Integer(), nullable=False, schema=SCHEMA)
