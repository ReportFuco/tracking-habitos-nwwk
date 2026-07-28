# Analítica de Finanzas Explicada Fácil

## Objetivo

Este documento explica en simple qué significa cada analítica del módulo de finanzas y cómo se puede mostrar en el dashboard del frontend.

La idea es que cualquier persona del equipo entienda:

- qué mide cada dato
- cómo interpretarlo
- cuándo sirve
- qué cuidado tener al mostrarlo

## Contexto general

Estas analíticas se calculan a partir de los `movimientos` del usuario.

Un movimiento puede ser:

- `gasto`
- `ingreso`

Y además, cuando es gasto, puede clasificarse como:

- `fijo`
- `variable`

También se puede agrupar por:

- categoría
- cuenta
- mes

## Endpoints actuales

- `GET /api/finanzas/analitica/resumen`
- `GET /api/finanzas/analitica/tendencia-mensual`
- `GET /api/finanzas/analitica/distribucion-categorias`
- `GET /api/finanzas/analitica/distribucion-cuentas`

## 1. Resumen

Endpoint:

```txt
GET /api/finanzas/analitica/resumen
```

Este endpoint entrega una foto general del mes.

Sirve para las tarjetas principales del dashboard.

### `gasto_total`

Qué significa:

- cuánto dinero salió en gastos durante el mes

Cómo leerlo:

- si sube mucho, el usuario está gastando más que antes

Dónde mostrarlo:

- card principal de "Gasto del mes"

### `ingreso_total`

Qué significa:

- cuánto dinero entró durante el mes

Cómo leerlo:

- permite comparar si el usuario está registrando ingresos suficientes frente a sus gastos

Dónde mostrarlo:

- card principal de "Ingresos del mes"

### `balance_total`

Qué significa:

- diferencia entre ingresos y gastos
- fórmula: `ingresos - gastos`

Cómo leerlo:

- positivo: entró más dinero del que salió
- negativo: salió más dinero del que entró

Dónde mostrarlo:

- card de "Balance mensual"

### `gasto_fijo_total`

Qué significa:

- suma de los gastos fijos del mes

Ejemplos típicos:

- arriendo
- suscripciones
- cuentas
- colegiatura

Cómo leerlo:

- ayuda a entender cuánto del gasto mensual es poco flexible

### `gasto_variable_total`

Qué significa:

- suma de los gastos variables del mes

Ejemplos típicos:

- comida fuera de casa
- farmacia
- transporte ocasional
- compras no recurrentes

Cómo leerlo:

- muestra la parte del gasto que más se puede ajustar

### `cantidad_movimientos`

Qué significa:

- cantidad total de movimientos registrados en el periodo

Cómo leerlo:

- sirve para medir actividad y nivel de registro

Cuidado:

- no significa cuánto dinero se movió, solo cuántos registros hubo

### `ticket_promedio_gasto`

Qué significa:

- promedio de monto por cada gasto

Cómo leerlo:

- ayuda a ver si el usuario hace muchos gastos pequeños o pocos gastos grandes

Ejemplo:

- si el gasto total es `100.000` y hubo `10` gastos, el ticket promedio es `10.000`

### `gasto_mayor`

Qué significa:

- el gasto individual más alto del mes

Cómo leerlo:

- sirve para detectar el "golpe grande" del periodo

Dónde mostrarlo:

- como dato secundario o insight

### `tasa_ahorro_pct`

Qué significa:

- porcentaje del ingreso que quedó disponible después de gastar

Fórmula:

```txt
(ingresos - gastos) / ingresos * 100
```

Cómo leerlo:

- alto: el usuario está guardando más parte de sus ingresos
- bajo: está gastando casi todo lo que entra
- negativo: está gastando más de lo que ingresa

Cuidado:

- solo tiene sentido si el usuario registra ingresos
- si no hay ingresos, este valor puede venir en `null`

### `variacion_gasto_vs_mes_anterior`

Qué significa:

- cuánto subió o bajó el gasto respecto al mes anterior

Cómo leerlo:

- positivo: este mes gastó más
- negativo: este mes gastó menos

Ejemplo:

- mes anterior: `200.000`
- mes actual: `250.000`
- variación: `50.000`

### `variacion_gasto_vs_mes_anterior_pct`

Qué significa:

- el cambio de gasto en porcentaje respecto al mes anterior

Cómo leerlo:

- ayuda más que el valor bruto cuando los montos cambian mucho entre usuarios

Ejemplo:

- pasar de `200.000` a `250.000` es un alza de `25%`

Cuidado:

- si el mes anterior fue `0`, este valor puede venir en `null`

### `proyeccion_gasto_fin_mes`

Qué significa:

- estimación de cuánto podría terminar gastando el usuario al cerrar el mes

Cómo se calcula:

- se toma lo gastado hasta hoy
- se proyecta al total de días del mes

Cómo leerlo:

- permite anticipar si el usuario va encaminado a gastar más o menos que lo habitual

Cuidado:

- es una proyección, no un valor definitivo
- tiene más sentido en mitad de mes o cerca del cierre
- normalmente solo aplica para el mes actual

## 2. Tendencia Mensual

Endpoint:

```txt
GET /api/finanzas/analitica/tendencia-mensual
```

Este endpoint sirve para gráficos de evolución en el tiempo.

Entrega datos por mes.

### `gasto_total`

Qué significa:

- cuánto gastó el usuario en ese mes específico

### `ingreso_total`

Qué significa:

- cuánto ingresó el usuario en ese mes específico

### `balance_total`

Qué significa:

- diferencia entre ingresos y gastos de ese mes

### `cantidad_movimientos`

Qué significa:

- cuántos movimientos tuvo ese mes

Uso ideal en frontend:

- gráfico de barras para gastos e ingresos
- gráfico de línea para evolución de gasto
- selector de últimos `3`, `6` o `12` meses

Qué pregunta responde:

- "¿Estoy gastando más que antes?"
- "¿Mis ingresos y gastos vienen subiendo o bajando?"

## 3. Distribución por Categorías

Endpoint:

```txt
GET /api/finanzas/analitica/distribucion-categorias
```

Este endpoint muestra en qué categorías se concentra el gasto o ingreso del periodo.

### `total_periodo`

Qué significa:

- suma total del tipo de movimiento consultado en ese mes

Ejemplo:

- si pides `gasto`, este total será la suma de todos los gastos del periodo

### `categoria`

Qué significa:

- nombre de la categoría financiera

### `total`

Qué significa:

- cuánto dinero se movió en esa categoría

### `cantidad_movimientos`

Qué significa:

- cuántos movimientos hubo en esa categoría

### `porcentaje_del_total`

Qué significa:

- qué porcentaje del total del periodo representa esa categoría

Ejemplo:

- si en comida gastó `80.000` y el total del mes fue `200.000`, entonces comida representa `40%`

Uso ideal en frontend:

- gráfico de torta
- gráfico de barras horizontales
- ranking "Top categorías del mes"

Qué pregunta responde:

- "¿En qué estoy gastando más?"
- "¿Qué categoría pesa más en mi mes?"

## 4. Distribución por Cuentas

Endpoint:

```txt
GET /api/finanzas/analitica/distribucion-cuentas
```

Este endpoint muestra desde qué cuenta se concentran más movimientos o montos.

### `nombre_cuenta`

Qué significa:

- nombre de la cuenta del usuario

### `total`

Qué significa:

- monto total movido por esa cuenta en el periodo y tipo consultado

### `cantidad_movimientos`

Qué significa:

- cantidad de movimientos que pasaron por esa cuenta

### `porcentaje_del_total`

Qué significa:

- cuánto representa esa cuenta dentro del total del periodo

Uso ideal en frontend:

- barras por cuenta
- ranking de cuentas más usadas

Qué pregunta responde:

- "¿Qué cuenta estoy usando más?"
- "¿Desde qué cuenta sale la mayor parte de mis gastos?"

## Cómo se podría mostrar en un dashboard

### Fila 1: tarjetas principales

- gasto del mes
- ingresos del mes
- balance del mes
- proyección fin de mes

### Fila 2: gráficos

- tendencia de últimos 6 meses
- distribución por categorías
- fijo vs variable

### Fila 3: detalle

- distribución por cuentas
- top categorías
- últimos movimientos

## Interpretaciones útiles para el usuario

### Caso 1: gasto alto pero balance positivo

Qué significa:

- el usuario está gastando mucho, pero sus ingresos todavía alcanzan

### Caso 2: gasto variable muy alto

Qué significa:

- hay espacio para ajustar hábitos de consumo

### Caso 3: gasto fijo muy alto

Qué significa:

- gran parte del gasto mensual ya está comprometido

### Caso 4: variación mensual muy positiva en gasto

Qué significa:

- este mes se está yendo más dinero que el anterior

### Caso 5: tasa de ahorro baja o negativa

Qué significa:

- el usuario está guardando poco o está gastando más de lo que ingresa

## Cuidados al mostrar estos datos

- no confundir `cantidad_movimientos` con monto total
- no presentar la `proyeccion_gasto_fin_mes` como si fuera un valor final
- si no hay ingresos, explicar bien que la tasa de ahorro no aplica
- si no hay movimientos, mostrar estado vacío amigable y no un error
- usar colores semánticos:
  - gasto: rojo o tono cálido
  - ingreso: verde
  - balance positivo: verde o neutro positivo
  - balance negativo: rojo

## Resumen corto para producto

Si lo quisiéramos resumir en una sola frase por endpoint:

- `resumen`: "cómo va el mes"
- `tendencia-mensual`: "cómo ha evolucionado en el tiempo"
- `distribucion-categorias`: "en qué se está gastando o ingresando"
- `distribucion-cuentas`: "desde qué cuenta se mueve más dinero"

## Próximo paso sugerido

Después de estas analíticas, lo más natural sería agregar:

- comparativa `fijo vs variable` como endpoint propio
- top gastos del mes
- top comercios usando el vínculo con compras
- porcentaje de gastos conciliados con compras vinculadas
