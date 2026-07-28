"""rename cuenta_bancaria to cuenta_usuario

Revision ID: c3d4e5f6a7b8
Revises: b7c8d9e0f1a2
Create Date: 2026-04-19 16:05:00.000000

"""

from typing import Sequence, Union

from alembic import op


revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b7c8d9e0f1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.rename_table("cuenta_bancaria", "cuenta_usuario", schema="finanzas")

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'fk_cuenta_bancaria_producto_financiero'
            ) THEN
                ALTER TABLE finanzas.cuenta_usuario
                RENAME CONSTRAINT fk_cuenta_bancaria_producto_financiero
                TO fk_cuenta_usuario_producto_financiero;
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'cuenta_bancaria_pkey'
            ) THEN
                ALTER TABLE finanzas.cuenta_usuario
                RENAME CONSTRAINT cuenta_bancaria_pkey
                TO cuenta_usuario_pkey;
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'cuenta_bancaria_id_usuario_fkey'
            ) THEN
                ALTER TABLE finanzas.cuenta_usuario
                RENAME CONSTRAINT cuenta_bancaria_id_usuario_fkey
                TO cuenta_usuario_id_usuario_fkey;
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'movimiento_id_cuenta_fkey'
            ) THEN
                ALTER TABLE finanzas.movimiento
                RENAME CONSTRAINT movimiento_id_cuenta_fkey
                TO movimiento_id_cuenta_usuario_fkey;
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        ALTER SEQUENCE IF EXISTS finanzas.cuenta_bancaria_id_cuenta_seq
        RENAME TO cuenta_usuario_id_cuenta_seq;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER SEQUENCE IF EXISTS finanzas.cuenta_usuario_id_cuenta_seq
        RENAME TO cuenta_bancaria_id_cuenta_seq;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'movimiento_id_cuenta_usuario_fkey'
            ) THEN
                ALTER TABLE finanzas.movimiento
                RENAME CONSTRAINT movimiento_id_cuenta_usuario_fkey
                TO movimiento_id_cuenta_fkey;
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'cuenta_usuario_id_usuario_fkey'
            ) THEN
                ALTER TABLE finanzas.cuenta_usuario
                RENAME CONSTRAINT cuenta_usuario_id_usuario_fkey
                TO cuenta_bancaria_id_usuario_fkey;
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'cuenta_usuario_pkey'
            ) THEN
                ALTER TABLE finanzas.cuenta_usuario
                RENAME CONSTRAINT cuenta_usuario_pkey
                TO cuenta_bancaria_pkey;
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'fk_cuenta_usuario_producto_financiero'
            ) THEN
                ALTER TABLE finanzas.cuenta_usuario
                RENAME CONSTRAINT fk_cuenta_usuario_producto_financiero
                TO fk_cuenta_bancaria_producto_financiero;
            END IF;
        END $$;
        """
    )

    op.rename_table("cuenta_usuario", "cuenta_bancaria", schema="finanzas")
