"""align cuentas_bancarias enum values

Revision ID: b55e6790738e
Revises: ddc0f10054bd
Create Date: 2026-03-29 01:25:52.729049

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b55e6790738e'
down_revision: Union[str, Sequence[str], None] = 'ddc0f10054bd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_enum e ON e.enumtypid = t.oid
                WHERE t.typname = 'cuentas_bancarias'
                  AND e.enumlabel = 'Cuenta Corriente'
            ) THEN
                ALTER TYPE cuentas_bancarias RENAME VALUE 'Cuenta Corriente' TO 'cuenta corriente';
            END IF;

            IF EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_enum e ON e.enumtypid = t.oid
                WHERE t.typname = 'cuentas_bancarias'
                  AND e.enumlabel = 'Cuenta vista'
            ) THEN
                ALTER TYPE cuentas_bancarias RENAME VALUE 'Cuenta vista' TO 'cuenta vista';
            END IF;

            IF EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_enum e ON e.enumtypid = t.oid
                WHERE t.typname = 'cuentas_bancarias'
                  AND e.enumlabel = 'Cuenta ahorro'
            ) THEN
                ALTER TYPE cuentas_bancarias RENAME VALUE 'Cuenta ahorro' TO 'cuenta ahorro';
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_enum e ON e.enumtypid = t.oid
                WHERE t.typname = 'cuentas_bancarias'
                  AND e.enumlabel = 'cuenta credito'
            ) THEN
                ALTER TYPE cuentas_bancarias ADD VALUE 'cuenta credito';
            END IF;
        END $$;
        """
    )

    op.execute(
        """
        ALTER TABLE cuenta_bancaria
        ALTER COLUMN tipo_cuenta
        SET DEFAULT 'cuenta vista'::cuentas_bancarias;
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_enum e ON e.enumtypid = t.oid
                WHERE t.typname = 'cuentas_bancarias'
                  AND e.enumlabel = 'cuenta corriente'
            ) THEN
                ALTER TYPE cuentas_bancarias RENAME VALUE 'cuenta corriente' TO 'Cuenta Corriente';
            END IF;

            IF EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_enum e ON e.enumtypid = t.oid
                WHERE t.typname = 'cuentas_bancarias'
                  AND e.enumlabel = 'cuenta vista'
            ) THEN
                ALTER TYPE cuentas_bancarias RENAME VALUE 'cuenta vista' TO 'Cuenta vista';
            END IF;

            IF EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_enum e ON e.enumtypid = t.oid
                WHERE t.typname = 'cuentas_bancarias'
                  AND e.enumlabel = 'cuenta ahorro'
            ) THEN
                ALTER TYPE cuentas_bancarias RENAME VALUE 'cuenta ahorro' TO 'Cuenta ahorro';
            END IF;
        END $$;
        """
    )

    op.execute(
        """
        ALTER TABLE cuenta_bancaria
        ALTER COLUMN tipo_cuenta
        SET DEFAULT 'Cuenta vista'::cuentas_bancarias;
        """
    )
