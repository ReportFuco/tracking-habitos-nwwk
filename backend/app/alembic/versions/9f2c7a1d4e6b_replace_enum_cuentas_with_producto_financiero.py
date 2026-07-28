"""replace enum cuentas with producto financiero

Revision ID: 9f2c7a1d4e6b
Revises: 4f6a8c1b2d9e
Create Date: 2026-04-19 13:20:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9f2c7a1d4e6b"
down_revision: Union[str, Sequence[str], None] = "4f6a8c1b2d9e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "producto_financiero",
        sa.Column("id_producto_financiero", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("id_banco", sa.Integer(), nullable=False),
        sa.Column("nombre_producto", sa.String(length=100), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["id_banco"], ["finanzas.banco.id_banco"]),
        sa.PrimaryKeyConstraint("id_producto_financiero"),
        sa.UniqueConstraint("id_banco", "nombre_producto", name="uq_producto_financiero_banco_nombre"),
        schema="finanzas",
    )

    op.add_column(
        "cuenta_bancaria",
        sa.Column("id_producto_financiero", sa.Integer(), nullable=True),
        schema="finanzas",
    )
    op.create_foreign_key(
        "fk_cuenta_bancaria_producto_financiero",
        "cuenta_bancaria",
        "producto_financiero",
        ["id_producto_financiero"],
        ["id_producto_financiero"],
        source_schema="finanzas",
        referent_schema="finanzas",
    )

    op.execute(
        """
        INSERT INTO finanzas.producto_financiero (
            id_banco,
            nombre_producto,
            descripcion,
            activo,
            created_at
        )
        SELECT DISTINCT
            cb.id_banco,
            cb.tipo_cuenta::text,
            NULL,
            true,
            now()
        FROM finanzas.cuenta_bancaria cb;
        """
    )

    op.execute(
        """
        UPDATE finanzas.cuenta_bancaria cb
        SET id_producto_financiero = pf.id_producto_financiero
        FROM finanzas.producto_financiero pf
        WHERE pf.id_banco = cb.id_banco
          AND pf.nombre_producto = cb.tipo_cuenta::text;
        """
    )

    op.alter_column(
        "cuenta_bancaria",
        "id_producto_financiero",
        existing_type=sa.Integer(),
        nullable=False,
        schema="finanzas",
    )

    op.execute(
        """
        ALTER TABLE finanzas.cuenta_bancaria
        DROP CONSTRAINT IF EXISTS cuenta_bancaria_id_banco_fkey;
        """
    )
    op.drop_column("cuenta_bancaria", "tipo_cuenta", schema="finanzas")
    op.drop_column("cuenta_bancaria", "id_banco", schema="finanzas")

    op.execute('DROP TYPE IF EXISTS finanzas.cuentas_bancarias')


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE t.typname = 'cuentas_bancarias'
                  AND n.nspname = 'finanzas'
            ) THEN
                CREATE TYPE finanzas.cuentas_bancarias AS ENUM (
                    'cuenta corriente',
                    'cuenta vista',
                    'cuenta ahorro',
                    'cuenta credito'
                );
            END IF;
        END $$;
        """
    )

    op.add_column(
        "cuenta_bancaria",
        sa.Column("id_banco", sa.Integer(), nullable=True),
        schema="finanzas",
    )
    op.add_column(
        "cuenta_bancaria",
        sa.Column(
            "tipo_cuenta",
            sa.Enum(
                "cuenta corriente",
                "cuenta vista",
                "cuenta ahorro",
                "cuenta credito",
                name="cuentas_bancarias",
                schema="finanzas",
            ),
            nullable=True,
            server_default=sa.text("'cuenta vista'::finanzas.cuentas_bancarias"),
        ),
        schema="finanzas",
    )

    op.execute(
        """
        UPDATE finanzas.cuenta_bancaria cb
        SET
            id_banco = pf.id_banco,
            tipo_cuenta = CASE
                WHEN lower(pf.nombre_producto) IN (
                    'cuenta corriente',
                    'cuenta vista',
                    'cuenta ahorro',
                    'cuenta credito'
                )
                THEN lower(pf.nombre_producto)::finanzas.cuentas_bancarias
                ELSE 'cuenta vista'::finanzas.cuentas_bancarias
            END
        FROM finanzas.producto_financiero pf
        WHERE pf.id_producto_financiero = cb.id_producto_financiero;
        """
    )

    op.alter_column(
        "cuenta_bancaria",
        "id_banco",
        existing_type=sa.Integer(),
        nullable=False,
        schema="finanzas",
    )
    op.alter_column(
        "cuenta_bancaria",
        "tipo_cuenta",
        existing_type=sa.Enum(
            "cuenta corriente",
            "cuenta vista",
            "cuenta ahorro",
            "cuenta credito",
            name="cuentas_bancarias",
            schema="finanzas",
        ),
        nullable=False,
        schema="finanzas",
    )

    op.create_foreign_key(
        "cuenta_bancaria_id_banco_fkey",
        "cuenta_bancaria",
        "banco",
        ["id_banco"],
        ["id_banco"],
        source_schema="finanzas",
        referent_schema="finanzas",
    )

    op.drop_constraint(
        "fk_cuenta_bancaria_producto_financiero",
        "cuenta_bancaria",
        schema="finanzas",
        type_="foreignkey",
    )
    op.drop_column("cuenta_bancaria", "id_producto_financiero", schema="finanzas")
    op.drop_table("producto_financiero", schema="finanzas")
