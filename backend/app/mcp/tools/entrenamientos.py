"""Herramientas MCP del modulo de entrenamientos: historial de fuerza, progreso, carga por
musculo y las notas de seguimiento que el asistente deja al usuario en la app."""
from datetime import date
from typing import Annotated, Literal

from mcp.server.mcpserver import Context
from mcp.types import ToolAnnotations
from pydantic import Field

from app.auth.scopes import ENTRENAMIENTOS_READ, ENTRENAMIENTOS_WRITE
from app.mcp.auth import SCOPE_CLIENTE_NOMBRE
from app.mcp.tools.finanzas import CREA, SOLO_LECTURA, sesion_usuario
from app.schemas.entrenamientos.analisis import (
    CargaMuscularResponse,
    EjerciciosBusqueda,
    ProgresoEjercicio,
    ResumenSemanal,
    SeguimientoResponse,
    SeguimientosResponse,
    SesionDetalle,
    SesionesResponse,
    TipoSeguimiento,
)
from app.services.entrenamientos import carga, seguimiento, sesiones
from app.services.entrenamientos.carga import ZONAS


ZonaMuscular = Literal[tuple(ZONAS)]  # type: ignore[valid-type]

ELIMINA = ToolAnnotations(
    read_only_hint=False,
    destructive_hint=True,
    idempotent_hint=True,
    open_world_hint=False,
)


async def listar_sesiones_fuerza(
    ctx: Context,
    desde: Annotated[date | None, Field(description="Primer día (calendario de Chile), ej. 2026-10-01.")] = None,
    hasta: Annotated[date | None, Field(description="Último día, inclusive.")] = None,
    limite: Annotated[int, Field(ge=1, le=100)] = 20,
) -> SesionesResponse:
    """Sesiones de fuerza del usuario, de la más reciente a la más antigua: fecha, duración,
    gimnasio, series de trabajo y calentamiento, ejercicios y zonas trabajadas.

    Para el detalle serie por serie de una sesión usa detalle_sesion_fuerza.
    """
    async with sesion_usuario(ctx, ENTRENAMIENTOS_READ) as (db, usuario):
        lista = await sesiones.listar_sesiones(db, usuario.id_usuario, desde=desde, hasta=hasta, limite=limite)
        return SesionesResponse(sesiones=lista)


async def detalle_sesion_fuerza(
    ctx: Context,
    id_entrenamiento_fuerza: Annotated[int, Field(description="Id de listar_sesiones_fuerza.")],
) -> SesionDetalle:
    """Todas las series de una sesión en orden: ejercicio, peso, repeticiones, negativas y
    si fue calentamiento. En ejercicios con mancuernas peso_kg es por mancuerna."""
    async with sesion_usuario(ctx, ENTRENAMIENTOS_READ) as (db, usuario):
        return await sesiones.detalle_sesion(db, usuario.id_usuario, id_entrenamiento_fuerza)


async def buscar_ejercicios(
    ctx: Context,
    texto: Annotated[str, Field(min_length=1, max_length=100, description="Ej. 'press banca', 'remo mancuerna'.")],
    limite: Annotated[int, Field(ge=1, le=50)] = 15,
) -> EjerciciosBusqueda:
    """Busca ejercicios del catálogo por nombre, músculo o equipamiento (sin importar tildes
    ni orden de las palabras). Devuelve el id que necesita progreso_ejercicio."""
    async with sesion_usuario(ctx, ENTRENAMIENTOS_READ) as (db, _usuario):
        return EjerciciosBusqueda(ejercicios=await sesiones.buscar_ejercicios(db, texto, limite=limite))


async def progreso_ejercicio(
    ctx: Context,
    id_ejercicio: Annotated[int, Field(description="Id de buscar_ejercicios o de una sesión.")],
    semanas: Annotated[int, Field(ge=1, le=104)] = 12,
) -> ProgresoEjercicio:
    """Evolución de un ejercicio sesión a sesión: mejor peso con sus repeticiones, 1RM
    estimado (Epley), series de trabajo y tonelaje. Úsala para ver si progresa, se estancó
    o retrocede, y para sugerir la carga de la próxima sesión."""
    async with sesion_usuario(ctx, ENTRENAMIENTOS_READ) as (db, usuario):
        return await sesiones.progreso_ejercicio(db, usuario.id_usuario, id_ejercicio, semanas=semanas)


async def resumen_semanal_fuerza(
    ctx: Context,
    semanas: Annotated[int, Field(ge=1, le=52)] = 8,
) -> ResumenSemanal:
    """Sesiones, series de trabajo y tonelaje por semana (lunes a domingo), de la más
    antigua a la actual. Sirve para ver constancia y tendencia del volumen total."""
    async with sesion_usuario(ctx, ENTRENAMIENTOS_READ) as (db, usuario):
        return ResumenSemanal(semanas=await sesiones.resumen_semanal(db, usuario.id_usuario, semanas=semanas))


async def carga_muscular(
    ctx: Context,
    modo: Annotated[
        Literal["7d", "semana"],
        Field(description="7d: los últimos 7 días hasta ahora (acumulado continuo). semana: de lunes a domingo."),
    ] = "7d",
    fecha: Annotated[
        date | None,
        Field(description="Con modo 'semana', cualquier día de la semana a revisar. Por defecto, la actual."),
    ] = None,
) -> CargaMuscularResponse:
    """Carga por zona muscular: series efectivas (1 por serie directa, 0,5 por indirecta),
    tonelaje, nivel y última vez trabajada. Es lo mismo que el usuario ve en el mapa del
    cuerpo de la pestaña Seguimiento.

    Niveles por semana: bajo < 4 series, moderado 4-10, óptimo 10-20, alto > 20 (posible
    sobrecarga). Úsala para detectar músculos sobrecargados o descuidados y desbalances
    (pecho vs dorsales, cuádriceps vs femorales).
    """
    async with sesion_usuario(ctx, ENTRENAMIENTOS_READ) as (db, usuario):
        periodo = carga.periodo_movil() if modo == "7d" else carga.periodo_semana(fecha)
        return CargaMuscularResponse.desde_carga(await carga.calcular_carga(db, usuario.id_usuario, periodo))


async def listar_seguimientos(
    ctx: Context,
    limite: Annotated[int, Field(ge=1, le=100)] = 20,
) -> SeguimientosResponse:
    """Notas de seguimiento ya publicadas para el usuario, de la más reciente a la más
    antigua. Revísalas antes de publicar una nueva para no repetir lo mismo."""
    async with sesion_usuario(ctx, ENTRENAMIENTOS_READ) as (db, usuario):
        filas = await seguimiento.listar_seguimientos(db, usuario.id_usuario, limite=limite)
        return SeguimientosResponse(seguimientos=[SeguimientoResponse.model_validate(fila) for fila in filas])


async def publicar_seguimiento(
    ctx: Context,
    tipo: Annotated[
        TipoSeguimiento,
        Field(
            description=(
                "seguimiento: cómo viene (progreso, constancia). sugerencia: qué hacer distinto. "
                "alerta: sobrecarga, estancamiento o desbalance. plan: rutina o próximos pasos."
            )
        ),
    ],
    titulo: Annotated[str, Field(min_length=1, max_length=160, description="Corto y concreto, ej. 'Pecho sobrecargado esta semana'.")],
    contenido: Annotated[
        str,
        Field(
            min_length=1,
            max_length=8000,
            description=(
                "Texto para el usuario, en segunda persona y en español. Párrafos cortos; para "
                "listas usa líneas que empiecen con '- '. Apóyate en cifras concretas de sus datos."
            ),
        ),
    ],
    zonas: Annotated[
        list[ZonaMuscular] | None,
        Field(description="Zonas musculares que menciona la nota; se resaltan junto al mapa del cuerpo."),
    ] = None,
) -> SeguimientoResponse:
    """Publica una nota de seguimiento que el usuario verá en Ritmo, en la pestaña
    Seguimiento de entrenamientos. Úsala para dejar por escrito un análisis, una sugerencia
    o un plan cuando el usuario lo pida o lo acepte; no publiques notas sin que lo sepa."""
    async with sesion_usuario(ctx, ENTRENAMIENTOS_WRITE) as (db, usuario):
        request = ctx.request_context.request
        origen = request.scope.get(SCOPE_CLIENTE_NOMBRE) if request is not None else None
        nota = await seguimiento.crear_seguimiento(
            db,
            usuario.id_usuario,
            tipo=tipo,
            titulo=titulo,
            contenido=contenido,
            zonas=list(zonas) if zonas else None,
            origen=origen,
        )
        return SeguimientoResponse.model_validate(nota)


async def eliminar_seguimiento(
    ctx: Context,
    id_seguimiento: Annotated[int, Field(description="Id de listar_seguimientos.")],
) -> str:
    """Elimina una nota de seguimiento publicada. Confírmalo con el usuario antes."""
    async with sesion_usuario(ctx, ENTRENAMIENTOS_WRITE) as (db, usuario):
        await seguimiento.eliminar_seguimiento(db, usuario.id_usuario, id_seguimiento)
        return f"Nota {id_seguimiento} eliminada."


HERRAMIENTAS = (
    (listar_sesiones_fuerza, "Listar sesiones de fuerza", SOLO_LECTURA),
    (detalle_sesion_fuerza, "Detalle de una sesión", SOLO_LECTURA),
    (buscar_ejercicios, "Buscar ejercicios", SOLO_LECTURA),
    (progreso_ejercicio, "Progreso de un ejercicio", SOLO_LECTURA),
    (resumen_semanal_fuerza, "Resumen semanal de fuerza", SOLO_LECTURA),
    (carga_muscular, "Carga por músculo", SOLO_LECTURA),
    (listar_seguimientos, "Listar notas de seguimiento", SOLO_LECTURA),
    (publicar_seguimiento, "Publicar nota de seguimiento", CREA),
    (eliminar_seguimiento, "Eliminar nota de seguimiento", ELIMINA),
)


def registrar_herramientas_entrenamientos(servidor) -> None:
    for funcion, titulo, anotaciones in HERRAMIENTAS:
        servidor.add_tool(funcion, title=titulo, annotations=anotaciones)
