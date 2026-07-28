
-- Ver los usuarios activos

SELECT * FROM "user";

SELECT 
    u.username,
    cat.nombre,
    cb.nombre_cuenta,
    mov.tipo_movimiento,
    mov.tipo_gasto,
    mov.monto,
    mov.descripcion,
    mov.created_at,
    CASE
        WHEN mov.descripcion ILIKE '%monster%'
            OR mov.descripcion ILIKE '%redbull%'
        THEN 'Energética'
        ELSE 'No energética'
    END AS energeticas
FROM movimiento AS mov
LEFT JOIN cuenta_usuario AS cb
    ON mov.id_cuenta = cb.id_cuenta
LEFT JOIN usuario AS u
    ON cb.id_usuario = u.id_usuario
LEFT JOIN categoria_finanza AS cat
    ON cat.id_categoria = mov.id_categoria
;



SELECT * FROM usuario


