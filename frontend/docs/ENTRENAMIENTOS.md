# Cambios frontend tracking hábitos

## Ruta app

/app/entrenamientos
/app/entrenamientos/activo

## Objetivo

Mejorar el flujo de registro recordando la última serie y limpiando la UI después de guardar.

## Requerimientos

- Guardar la última serie registrada en `localStorage` o recuperarla desde backend.
- En el siguiente registro, usar esa última serie como recomendación/valor inicial.
- Definir prioridad de fuente:
- backend si existe dato reciente
- fallback a `localStorage`
- Después de guardar un registro, colapsar el formulario en modo acordeón.
- Bloquear el zoom en mobile dentro del flujo de registro.
- `repeticiones` debe ser numérico.
- `peso` debe ser decimal (revisar compatibilidad/validación en backend).
- Cuando se finaliza el entrenamiento activo, redirigir a `Inicio > Entrenamientos`.
- agrupar en acordion los registros de series de manera que si es que se repite un ejercicio, solo mostrarlo una vez (agrupado en acordión) y que al clickear se desagrupe viendo el detalle por serie de ese ejercicio

## Resultado esperado

- Menos fricción al registrar.
- Continuidad entre registros.
- UI más limpia después de guardar.
