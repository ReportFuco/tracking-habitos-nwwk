-- SELECT * FROM categoria_finanza;

-- prueba
SELECT * FROM movimiento;


WITH gastos AS (
    SELECT
        CASE
            WHEN 
                mov.descripcion ILIKE '%monster%'
                OR mov.descripcion ILIKE '%red bull%'
            THEN 'Energetica'
            ELSE 'No Energética'
        END AS producto,
        mov.monto   AS monto
    FROM movimiento AS mov
WHERE mov.tipo_movimiento = 'gasto'
)
SELECT 
    producto,
    SUM(monto) AS gastado
FROM gastos
GROUP BY producto
ORDER BY gastado DESC;


UPDATE "user" SET is_superuser = TRUE WHERE id = 1

select * from "user"