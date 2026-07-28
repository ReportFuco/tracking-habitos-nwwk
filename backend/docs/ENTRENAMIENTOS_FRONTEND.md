# Entrenamientos Frontend

Guía para adaptar el front al módulo de entrenamientos después del cambio de `EnumMusculo` a catálogo de músculos y subcategorías.

## Objetivo

El front ya no debe registrar ejercicios usando un enum como `tipo: "pecho"`.

Ahora cada ejercicio se clasifica con:

- `id_musculo`: músculo principal, solo para filtrar o agrupar
- `id_subcategoria_musculo`: zona específica que se guarda en el ejercicio
- `musculo_nombre` y `subcategoria_nombre`: textos listos para mostrar

La regla importante es:

```txt
Crear o editar ejercicio => enviar id_subcategoria_musculo
Listar o mostrar ejercicio => usar musculo_nombre y subcategoria_nombre
```

## Endpoints Base

Prefijo:

```txt
/api/entrenamientos
```

Endpoints clave para el front:

| Método | Endpoint | Uso |
|---|---|---|
| `GET` | `/ejercicios/musculos` | Cargar catálogo de músculos y subcategorías |
| `GET` | `/ejercicios/` | Listar/buscar ejercicios |
| `POST` | `/ejercicios/` | Crear ejercicio |
| `PATCH` | `/ejercicios/{id_ejercicio}` | Editar ejercicio |
| `GET` | `/fuerza/activo` | Ver sesión activa con series |
| `POST` | `/fuerza/` | Iniciar sesión |
| `PATCH` | `/fuerza/activo/cerrar` | Cerrar sesión |
| `POST` | `/series/` | Agregar serie |
| `PATCH` | `/series/{id_fuerza_detalle}` | Editar serie |
| `DELETE` | `/series/{id_fuerza_detalle}` | Eliminar serie |

## Catálogo de Músculos

Usar este endpoint al entrar a vistas donde se creen, editen o filtren ejercicios:

```http
GET /api/entrenamientos/ejercicios/musculos
```

Respuesta:

```json
[
  {
    "id_musculo": 3,
    "codigo": "pecho",
    "nombre": "Pecho",
    "activo": true,
    "subcategorias": [
      {
        "id_subcategoria_musculo": 9,
        "id_musculo": 3,
        "codigo": "general",
        "nombre": "General",
        "activo": true
      },
      {
        "id_subcategoria_musculo": 10,
        "id_musculo": 3,
        "codigo": "superior",
        "nombre": "Superior",
        "activo": true
      }
    ]
  }
]
```

Recomendación de UI:

1. Select de músculo principal.
2. Select de subcategoría filtrado por el músculo elegido.
3. El submit guarda solo `id_subcategoria_musculo`.

No guardar `codigo` como fuente de verdad en formularios. Puede servir para rutas, filtros legacy o etiquetas internas, pero la relación real es por ID.

## Listado de Ejercicios

Endpoint:

```http
GET /api/entrenamientos/ejercicios/
```

Query params:

| Param | Tipo | Uso recomendado |
|---|---:|---|
| `q` | `string` | Buscador por nombre, músculo o subcategoría |
| `id_musculo` | `int` | Filtro por músculo principal |
| `id_subcategoria_musculo` | `int` | Filtro fino por zona específica |
| `tipo` | `string` | Legacy, evitar para pantallas nuevas |

Ejemplos:

```http
GET /api/entrenamientos/ejercicios/?id_musculo=3
GET /api/entrenamientos/ejercicios/?id_subcategoria_musculo=11
GET /api/entrenamientos/ejercicios/?q=press
```

Respuesta:

```json
{
  "id_ejercicio": 1,
  "nombre": "Press banca con barra",
  "id_subcategoria_musculo": 11,
  "url_video": null,
  "id_musculo": 3,
  "musculo_codigo": "pecho",
  "musculo_nombre": "Pecho",
  "subcategoria_codigo": "medio",
  "subcategoria_nombre": "Medio"
}
```

Cómo mostrarlo:

```txt
Press banca con barra
Pecho / Medio
```

Si `subcategoria_nombre` es `General`, se puede mostrar solo el músculo o mostrar `Pecho / General`, según la densidad de la pantalla.

## Crear Ejercicio

Endpoint:

```http
POST /api/entrenamientos/ejercicios/
```

Payload:

```json
{
  "nombre": "Press banca plano",
  "id_subcategoria_musculo": 11,
  "url_video": "https://youtube.com/ejemplo"
}
```

Validaciones recomendadas en front:

- `nombre` requerido
- `id_subcategoria_musculo` requerido
- `url_video` opcional
- bloquear submit si no hay subcategoría seleccionada

Errores importantes:

| Status | Causa |
|---:|---|
| `404` | Subcategoría no existe o está inactiva |
| `409` | Ya existe un ejercicio con ese nombre |

## Editar Ejercicio

Endpoint:

```http
PATCH /api/entrenamientos/ejercicios/{id_ejercicio}
```

Payload parcial:

```json
{
  "id_subcategoria_musculo": 10
}
```

Para precargar el formulario:

1. Usar `id_musculo` para seleccionar músculo.
2. Filtrar `subcategorias` de ese músculo.
3. Seleccionar `id_subcategoria_musculo`.

## Flujo de Entrenamiento de Fuerza

Pantalla sugerida:

1. Si no hay sesión activa, mostrar CTA para iniciar entrenamiento.
2. Si hay sesión activa, mostrar gimnasio, tiempo/estado y lista de series.
3. Agregar series desde un buscador de ejercicios.
4. Cerrar sesión al terminar.

### Ver Sesión Activa

```http
GET /api/entrenamientos/fuerza/activo
```

Respuesta:

```json
{
  "id_entrenamiento_fuerza": 8,
  "estado": "activo",
  "inicio_at": "2026-05-06T11:00:00",
  "fin_at": null,
  "nombre_gimnasio": "Smart Fit Oeste",
  "nombre_cadena": "Smart Fit",
  "comuna": "Nunoa",
  "direccion": "Av. Siempre Viva 123",
  "latitud": -33.456,
  "longitud": -70.648,
  "series": [
    {
      "id_fuerza_detalle": 101,
      "es_calentamiento": false,
      "cantidad_peso": 60,
      "repeticiones": 8,
      "nombre_ejercicio": "Press banca con barra",
      "tipo_ejercicio": "Pecho",
      "subcategoria_ejercicio": "Medio",
      "url_video": null
    }
  ]
}
```

Si responde `404`, el usuario no tiene sesión activa.

### Iniciar Sesión

```http
POST /api/entrenamientos/fuerza/
```

Payload:

```json
{
  "observacion": "Pecho y tríceps",
  "id_gimnasio": 1
}
```

Errores importantes:

| Status | Causa |
|---:|---|
| `404` | Gimnasio no existe o está inactivo |
| `409` | Ya existe una sesión activa |

### Cerrar Sesión

```http
PATCH /api/entrenamientos/fuerza/activo/cerrar
```

Si responde `404`, no hay sesión activa.

## Series

### Agregar Serie

```http
POST /api/entrenamientos/series/
```

Payload:

```json
{
  "id_ejercicio": 1,
  "es_calentamiento": false,
  "cantidad_peso": 60,
  "repeticiones": 8
}
```

Respuesta:

```json
{
  "id_fuerza_detalle": 101,
  "es_calentamiento": false,
  "cantidad_peso": 60,
  "repeticiones": 8,
  "nombre_ejercicio": "Press banca con barra",
  "tipo_ejercicio": "Pecho",
  "subcategoria_ejercicio": "Medio",
  "url_video": null
}
```

Errores importantes:

| Status | Causa |
|---:|---|
| `404` | No hay entrenamiento activo |
| `404` | Ejercicio no existe |

### Editar Serie

```http
PATCH /api/entrenamientos/series/{id_fuerza_detalle}
```

Payload parcial:

```json
{
  "cantidad_peso": 65,
  "repeticiones": 6
}
```

Regla: la serie debe pertenecer al usuario y a una sesión activa.

### Eliminar Serie

```http
DELETE /api/entrenamientos/series/{id_fuerza_detalle}
```

Regla: la serie debe pertenecer al usuario y a una sesión activa.

## Migración Frontend

Checklist recomendado:

1. Reemplazar usos de `tipo` en formularios de ejercicios por `id_subcategoria_musculo`.
2. Crear loader/cache para `/ejercicios/musculos`.
3. Implementar select dependiente músculo -> subcategoría.
4. Actualizar cards/listados para mostrar `musculo_nombre` y `subcategoria_nombre`.
5. Cambiar filtros nuevos a `id_musculo` o `id_subcategoria_musculo`.
6. Mantener soporte temporal para `tipo` solo si hay pantallas antiguas.
7. En series, mostrar `tipo_ejercicio` y `subcategoria_ejercicio`.
8. Probar crear ejercicio, editar subcategoría, filtrar por músculo y agregar serie.

## Tipos Sugeridos

```ts
type SubcategoriaMusculo = {
  id_subcategoria_musculo: number;
  id_musculo: number;
  codigo: string;
  nombre: string;
  activo: boolean;
};

type Musculo = {
  id_musculo: number;
  codigo: string;
  nombre: string;
  activo: boolean;
  subcategorias: SubcategoriaMusculo[];
};

type Ejercicio = {
  id_ejercicio: number;
  nombre: string;
  id_subcategoria_musculo: number;
  url_video: string | null;
  id_musculo: number | null;
  musculo_codigo: string | null;
  musculo_nombre: string | null;
  subcategoria_codigo: string | null;
  subcategoria_nombre: string | null;
};

type SerieFuerza = {
  id_fuerza_detalle: number;
  es_calentamiento: boolean;
  cantidad_peso: number;
  repeticiones: number;
  nombre_ejercicio: string | null;
  tipo_ejercicio: string | null;
  subcategoria_ejercicio: string | null;
  url_video: string | null;
};
```

## Notas de Compatibilidad

- `tipo` ya no debe enviarse al crear o editar ejercicios.
- `tipo` solo queda como query param legacy en `GET /ejercicios/`.
- Si un ejercicio aparece con subcategoría `General`, se puede editar después para asignar una zona específica.
- Los IDs de subcategoría son pequeños y estables para el catálogo inicial, pero el front debe preferir cargarlos desde `/ejercicios/musculos`.
