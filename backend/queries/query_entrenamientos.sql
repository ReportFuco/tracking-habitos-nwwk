
SELECT to_char(en.created_at, 'dd-mm-yyyy') as fecha,
       ef.id_entrenamiento_fuerza,
       g.nombre_gimnasio,
       e.nombre,
       sf.cantidad_peso,
       sf.repeticiones,
       (sf.cantidad_peso * sf.repeticiones) AS volumen_serie
from serie_fuerza sf
join ejercicios e on e.id_ejercicio = sf.id_ejercicio
join entrenamiento_fuerza ef on sf.id_entrenamiento_fuerza = ef.id_entrenamiento_fuerza
join gimnasio g on ef.id_gimnasio = g.id_gimnasio
join entrenamiento en on ef.id_entrenamiento = en.id_entrenamiento
where sf.es_calentamiento = 'false';