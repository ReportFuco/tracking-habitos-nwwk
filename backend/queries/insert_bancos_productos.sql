-- Seed de bancos y productos financieros
-- Supuestos de columnas:
--   finanzas.banco(id_banco, nombre_banco)
--   finanzas.producto_financiero(id_producto_financiero, id_banco, nombre_producto, descripcion)
--
-- El script es idempotente:
-- - Inserta bancos solo si no existen por nombre
-- - Inserta productos solo si no existen para ese banco por nombre_producto
--
-- Ajusta los nombres de columnas si en tu modelo real difieren.

BEGIN;

/* =========================================================
   1) BANCOS FALTANTES
   ========================================================= */

INSERT INTO finanzas.banco (nombre_banco)
SELECT v.nombre_banco
FROM (
    VALUES
        ('Banco Ripley'),
        ('Tenpo'),
        ('Banco BICE'),
        ('Banco Internacional')
) AS v(nombre_banco)
WHERE NOT EXISTS (
    SELECT 1
    FROM finanzas.banco b
    WHERE LOWER(TRIM(b.nombre_banco)) = LOWER(TRIM(v.nombre_banco))
);

/* =========================================================
   2) PRODUCTOS FINANCIEROS
   ========================================================= */

WITH productos AS (
    SELECT *
    FROM (
        VALUES
            -- Falabella
            ('Falabella', 'cuenta vista', 'Cuenta vista de Banco Falabella para uso diario y movimientos del usuario.'),
            ('Falabella', 'tarjeta de débito', 'Tarjeta de débito asociada a productos de captación del Banco Falabella.'),

            -- Banco Estado
            ('Banco Estado', 'cuenta corriente', 'Cuenta corriente de BancoEstado para gestión de ingresos, pagos y transferencias.'),
            ('Banco Estado', 'cuenta de ahorro', 'Producto de ahorro de BancoEstado para guardar dinero y generar historial de ahorro.'),
            ('Banco Estado', 'tarjeta de crédito', 'Tarjeta de crédito emitida por BancoEstado para compras y pagos en cuotas.'),

            -- Itaú
            ('Itaú', 'cuenta corriente', 'Cuenta corriente de Itaú para operaciones bancarias habituales del usuario.'),
            ('Itaú', 'tarjeta de crédito', 'Tarjeta de crédito de Itaú para compras nacionales e internacionales.'),

            -- Scotiabank
            ('Scotiabank', 'cuenta corriente', 'Cuenta corriente de Scotiabank para administración de dinero y pagos.'),
            ('Scotiabank', 'cuenta vista', 'Cuenta vista de Scotiabank orientada a uso personal y movimientos frecuentes.'),
            ('Scotiabank', 'tarjeta de crédito', 'Tarjeta de crédito de Scotiabank para compras, avances y cuotas.'),

            -- Consorcio
            ('Consorcio', 'cuenta vista', 'Cuenta vista digital de Banco Consorcio para movimientos del día a día.'),
            ('Consorcio', 'cuenta corriente', 'Cuenta corriente de Banco Consorcio para uso personal.'),
            ('Consorcio', 'tarjeta de crédito', 'Tarjeta de crédito de Banco Consorcio para compras y administración de cupo.'),

            -- Banco De Chile
            ('Banco De Chile', 'cuenta corriente', 'Cuenta corriente de Banco de Chile para administración financiera personal.'),
            ('Banco De Chile', 'cuenta fan', 'Cuenta FAN de Banco de Chile, enfocada en operación digital de dinero.'),
            ('Banco De Chile', 'fan ahorro', 'Producto de ahorro digital asociado al ecosistema FAN de Banco de Chile.'),
            ('Banco De Chile', 'tarjeta de crédito', 'Tarjeta de crédito de Banco de Chile para compras y cuotas.'),

            -- Santander
            ('Santander', 'cuenta corriente', 'Cuenta corriente de Santander para pagos, transferencias y administración de saldo.'),
            ('Santander', 'cuenta vista', 'Cuenta vista de Santander para uso diario del usuario.'),
            ('Santander', 'tarjeta de crédito', 'Tarjeta de crédito de Santander para compras, avances y cuotas.'),

            -- Bci
            ('Bci', 'cuenta digital', 'Cuenta digital de Bci con operación en línea y productos asociados.'),
            ('Bci', 'tarjeta de crédito', 'Tarjeta de crédito de Bci para compras y administración de cupo.'),

            -- Banco Ripley
            ('Banco Ripley', 'cuenta corriente', 'Cuenta corriente de Banco Ripley para manejo de dinero y pagos.'),
            ('Banco Ripley', 'cuenta vista', 'Cuenta vista de Banco Ripley para movimientos y uso diario.'),
            ('Banco Ripley', 'tarjeta de crédito ripley', 'Tarjeta de crédito de Banco Ripley para compras, cuotas y avances.'),

            -- Tenpo
            ('Tenpo', 'cuenta tenpo', 'Cuenta Tenpo para administrar saldo y movimientos digitales.'),
            ('Tenpo', 'tarjeta de crédito', 'Tarjeta de crédito Tenpo para compras y uso en comercio físico y digital.'),
            ('Tenpo', 'tarjeta prepago', 'Tarjeta prepago Tenpo para compras y uso controlado de saldo.'),

            -- Banco BICE
            ('Banco BICE', 'cuenta corriente', 'Cuenta corriente de Banco BICE para uso personal.'),
            ('Banco BICE', 'go bice', 'Producto digital GO BICE para operación bancaria de personas.'),
            ('Banco BICE', 'tarjeta de crédito', 'Tarjeta de crédito de Banco BICE para compras y administración de cupo.'),

            -- Banco Internacional
            ('Banco Internacional', 'cuenta corriente remunerada', 'Cuenta corriente remunerada de Banco Internacional para personas.'),
            ('Banco Internacional', 'tarjeta de crédito', 'Tarjeta de crédito de Banco Internacional para compras y pagos en cuotas.')
    ) AS t(nombre_banco, nombre_producto, descripcion)
)
INSERT INTO finanzas.producto_financiero (id_banco, nombre_producto, descripcion)
SELECT
    b.id_banco,
    p.nombre_producto,
    p.descripcion
FROM productos p
JOIN finanzas.banco b
    ON LOWER(TRIM(b.nombre_banco)) = LOWER(TRIM(p.nombre_banco))
WHERE NOT EXISTS (
    SELECT 1
    FROM finanzas.producto_financiero pf
    WHERE pf.id_banco = b.id_banco
      AND LOWER(TRIM(pf.nombre_producto)) = LOWER(TRIM(p.nombre_producto))
);

COMMIT;
