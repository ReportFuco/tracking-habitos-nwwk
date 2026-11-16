"""Herramientas MCP del módulo de nutrición: calorías del día, búsqueda de alimentos y
anotar comidas, también desde la foto de un plato (con calorías estimadas)."""
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from mcp.server.mcpserver import Context
from pydantic import BaseModel, Field, ValidationError, model_validator

from app.auth.scopes import NUTRICION_READ, NUTRICION_WRITE
from app.mcp.fechas import CHILE_TZ, adaptar_fechas
from app.mcp.tools.entrenamientos import ELIMINA
from app.mcp.tools.finanzas import CREA, SOLO_LECTURA, sesion_usuario
from app.schemas.nutricion import ConsumoCreate, ConsumoDetalleItem, ConsumoResponse
from app.schemas.nutricion.consumo import TipoComida
from app.schemas.nutricion.resumen import AlimentosBusqueda, DiaNutricion, TendenciaNutricion
from app.services.nutricion import comidas


def _hoy_chile() -> date:
    return datetime.now(CHILE_TZ).date()


def _a_hora_chile_naive(valor: datetime | None) -> datetime:
    """fecha_consumo se guarda naive en hora de Chile."""
    if valor is None:
        return datetime.now(CHILE_TZ).replace(tzinfo=None, microsecond=0)
    if valor.tzinfo is None:
        return valor
    return valor.astimezone(CHILE_TZ).replace(tzinfo=None)


class AlimentoComida(BaseModel):
    """Un alimento de la comida: producto del catálogo o alimento libre con sus calorías."""

    id_producto: Annotated[
        int | None,
        Field(description="Id de buscar_alimentos. Las calorías se calculan con su tabla nutricional."),
    ] = None
    nombre_alimento: Annotated[
        str | None,
        Field(max_length=160, description="Si no está en el catálogo: nombre legible, ej. 'Pastel de choclo'."),
    ] = None
    cantidad: Annotated[Decimal, Field(gt=0, description="Ej. 150 (g), 1 (porción), 2 (unidades).")]
    unidad: Annotated[
        str,
        Field(
            min_length=1,
            max_length=30,
            description="g, ml, unidad, porcion, taza o cucharada. Con un producto, usa la unidad de su porción o 'unidad'.",
        ),
    ]
    calorias: Annotated[
        Decimal | None,
        Field(ge=0, description="kcal de TODA la cantidad (no por 100 g). Obligatoria en un alimento libre."),
    ] = None
    proteinas: Annotated[Decimal | None, Field(ge=0, description="Gramos de toda la cantidad.")] = None
    carbohidratos: Annotated[Decimal | None, Field(ge=0, description="Gramos de toda la cantidad.")] = None
    grasas: Annotated[Decimal | None, Field(ge=0, description="Gramos de toda la cantidad.")] = None
    estimado: Annotated[
        bool,
        Field(description="true si las calorías son una estimación (foto de un plato), no de una etiqueta."),
    ] = False

    @model_validator(mode="after")
    def _validar(self):
        # Las mismas reglas que la app (producto o nombre, y calorías en lo libre).
        try:
            ConsumoDetalleItem(**self._como_item())
        except ValidationError as exc:
            raise ValueError(exc.errors()[0]["msg"].removeprefix("Value error, ")) from None
        return self

    def _como_item(self) -> dict:
        return {
            "id_producto": self.id_producto,
            "nombre_alimento": self.nombre_alimento,
            "cantidad_consumida": self.cantidad,
            "unidad_consumida": self.unidad,
            "calorias": self.calorias,
            "proteinas": self.proteinas,
            "carbohidratos": self.carbohidratos,
            "grasas": self.grasas,
            "estimado": self.estimado,
        }


async def resumen_nutricion_dia(
    ctx: Context,
    fecha: Annotated[date | None, Field(description="Día en calendario de Chile. Por defecto, hoy.")] = None,
) -> DiaNutricion:
    """Calorías y macros consumidos en un día contra la meta vigente (calorias_restantes es
    lo que queda; negativo si se pasó), con cada comida y sus alimentos. Úsala para "cuánto
    llevo hoy", "cuánto me queda" o antes de anotar, para no duplicar una comida."""
    async with sesion_usuario(ctx, NUTRICION_READ) as (db, usuario):
        return await comidas.resumen_dia(db, usuario.id_usuario, fecha or _hoy_chile())


async def tendencia_calorias(
    ctx: Context,
    dias: Annotated[int, Field(ge=1, le=90)] = 7,
    hasta: Annotated[date | None, Field(description="Último día incluido. Por defecto, hoy.")] = None,
) -> TendenciaNutricion:
    """Calorías y macros por día (del más antiguo al más reciente) con la meta de cada día.
    Sirve para "cómo voy esta semana" o si viene cumpliendo la meta. Los días sin comidas
    salen en 0: puede que no haya anotado, no que no haya comido."""
    async with sesion_usuario(ctx, NUTRICION_READ) as (db, usuario):
        return TendenciaNutricion(dias=await comidas.tendencia(db, usuario.id_usuario, hasta or _hoy_chile(), dias))


async def buscar_alimentos(
    ctx: Context,
    texto: Annotated[str, Field(min_length=1, max_length=100, description="Nombre, marca o código de barras.")],
    limite: Annotated[int, Field(ge=1, le=50)] = 15,
) -> AlimentosBusqueda:
    """Busca productos del catálogo de Ritmo (sin importar tildes ni errores de tipeo).
    Los que tienen tabla nutricional van primero: con su id_producto las calorías se
    calculan solas al anotar. calorias_por_porcion es por porcion_cantidad porcion_unidad."""
    async with sesion_usuario(ctx, NUTRICION_READ) as (db, usuario):
        return AlimentosBusqueda(alimentos=await comidas.buscar_alimentos(db, usuario, texto, limite))


async def registrar_comida(
    ctx: Context,
    tipo_comida: Annotated[TipoComida, Field(description="Según la hora si el usuario no lo dice.")],
    alimentos: Annotated[list[AlimentoComida], Field(min_length=1, max_length=50)],
    fecha_hora: Annotated[
        datetime | None,
        Field(description="Cuándo comió, hora de Chile. Por defecto, ahora."),
    ] = None,
    observacion: Annotated[str | None, Field(max_length=250)] = None,
) -> ConsumoResponse:
    """Anota una comida con sus alimentos; el usuario la ve en Ritmo > Nutrición > Comidas
    y suma a su contador del día. Devuelve las calorías calculadas por línea y el total.

    No es idempotente: si una llamada falla o no sabes si se guardó, revisa con
    resumen_nutricion_dia antes de repetirla."""
    async with sesion_usuario(ctx, NUTRICION_WRITE) as (db, usuario):
        datos = ConsumoCreate(
            fecha_consumo=_a_hora_chile_naive(fecha_hora),
            tipo_comida=tipo_comida,
            observacion=observacion,
            detalles=[ConsumoDetalleItem(**a._como_item()) for a in alimentos],
        )
        comida = await comidas.crear_comida(db, usuario.id_usuario, datos)
        return ConsumoResponse.model_validate(comida)


async def eliminar_comida(
    ctx: Context,
    id_consumo: Annotated[int, Field(description="Id de la comida, de resumen_nutricion_dia.")],
) -> str:
    """Elimina una comida con todos sus alimentos. Confírmalo con el usuario antes."""
    async with sesion_usuario(ctx, NUTRICION_WRITE) as (db, usuario):
        await comidas.eliminar_comida(db, usuario.id_usuario, id_consumo)
        return f"Comida {id_consumo} eliminada."


HERRAMIENTAS = (
    (resumen_nutricion_dia, "Calorías del día", SOLO_LECTURA),
    (tendencia_calorias, "Tendencia de calorías", SOLO_LECTURA),
    (buscar_alimentos, "Buscar alimentos", SOLO_LECTURA),
    (registrar_comida, "Registrar comida", CREA),
    (eliminar_comida, "Eliminar comida", ELIMINA),
)


def registrar_herramientas_nutricion(servidor) -> None:
    for funcion, titulo, anotaciones in HERRAMIENTAS:
        servidor.add_tool(adaptar_fechas(funcion), title=titulo, annotations=anotaciones)
