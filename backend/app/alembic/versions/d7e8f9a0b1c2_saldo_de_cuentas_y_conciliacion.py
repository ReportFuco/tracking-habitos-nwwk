"""saldo de cuentas, fecha contable y transferencias

Para que una cuenta cuadre con la cartola del banco:

- ``finanzas.cuenta_usuario``: ``saldo_inicial`` y ``fecha_saldo_inicial`` (saldo al
  cierre de ese día). El saldo a una fecha es el inicial más los movimientos posteriores.
- ``finanzas.movimiento``:
  - ``fecha_contable``: día en que el banco lo registró. La pone la cartola; sin ella el
    movimiento está pendiente de conciliar y el saldo usa su fecha.
  - ``hora_conocida``: false cuando solo se sabe el día (cartolas, fechas sin hora).
  - ``descripcion_original`` y ``clave_cartola``: glosa y clave de la fila de cartola que
    lo creó o con la que se concilió; la clave evita importar la misma fila dos veces.
  - ``id_importacion_conciliacion``: importación que concilió un movimiento registrado a
    mano, para revertirlo al deshacerla.
  - ``id_transferencia``: une los dos movimientos espejo de una transferencia entre
    cuentas propias, que no cuentan como gasto ni ingreso en la analítica.
- Categoría por defecto «Transferencias» para esos movimientos.

Revision ID: d7e8f9a0b1c2
Revises: c6d7e8f9a0b1
Create Date: 2026-10-16 18:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d7e8f9a0b1c2"
down_revision: Union[str, Sequence[str], None] = "c6d7e8f9a0b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("cuenta_usuario", sa.Column("saldo_inicial", sa.Integer(), nullable=True), schema="finanzas")
    op.add_column("cuenta_usuario", sa.Column("fecha_saldo_inicial", sa.Date(), nullable=True), schema="finanzas")

    op.add_column("movimiento", sa.Column("fecha_contable", sa.Date(), nullable=True), schema="finanzas")
    op.add_column(
        "movimiento",
        sa.Column("hora_conocida", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        schema="finanzas",
    )
    op.add_column("movimiento", sa.Column("descripcion_original", sa.Text(), nullable=True), schema="finanzas")
    op.add_column("movimiento", sa.Column("clave_cartola", sa.Uuid(), nullable=True), schema="finanzas")
    op.add_column(
        "movimiento",
        sa.Column("id_importacion_conciliacion", sa.Integer(), nullable=True),
        schema="finanzas",
    )
    op.add_column("movimiento", sa.Column("id_transferencia", sa.Uuid(), nullable=True), schema="finanzas")
    op.create_unique_constraint(
        "uq_movimiento_clave_cartola", "movimiento", ["clave_cartola"], schema="finanzas"
    )
    op.create_foreign_key(
        "fk_movimiento_id_importacion_conciliacion",
        "movimiento",
        "importacion",
        ["id_importacion_conciliacion"],
        ["id_importacion"],
        source_schema="finanzas",
        referent_schema="finanzas",
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_finanzas_movimiento_id_importacion_conciliacion",
        "movimiento",
        ["id_importacion_conciliacion"],
        schema="finanzas",
    )
    op.create_index("ix_finanzas_movimiento_id_transferencia", "movimiento", ["id_transferencia"], schema="finanzas")

    op.execute(
        """
        INSERT INTO finanzas.categoria_finanza (nombre)
        SELECT 'Transferencias'
        WHERE NOT EXISTS (
            SELECT 1 FROM finanzas.categoria_finanza
            WHERE id_usuario IS NULL AND lower(nombre) = 'transferencias'
        )
        """
    )


def downgrade() -> None:
    # La categoría «Transferencias» se deja: puede tener movimientos.
    op.drop_index("ix_finanzas_movimiento_id_transferencia", table_name="movimiento", schema="finanzas")
    op.drop_index("ix_finanzas_movimiento_id_importacion_conciliacion", table_name="movimiento", schema="finanzas")
    op.drop_constraint(
        "fk_movimiento_id_importacion_conciliacion", "movimiento", type_="foreignkey", schema="finanzas"
    )
    op.drop_constraint("uq_movimiento_clave_cartola", "movimiento", type_="unique", schema="finanzas")
    for columna in (
        "id_transferencia",
        "id_importacion_conciliacion",
        "clave_cartola",
        "descripcion_original",
        "hora_conocida",
        "fecha_contable",
    ):
        op.drop_column("movimiento", columna, schema="finanzas")
    op.drop_column("cuenta_usuario", "fecha_saldo_inicial", schema="finanzas")
    op.drop_column("cuenta_usuario", "saldo_inicial", schema="finanzas")
