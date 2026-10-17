"""Fechas con zona horaria en las salidas MCP.

La BD guarda fechas naive en hora de Chile y la API REST las devuelve así. Pero el
``outputSchema`` de una herramienta declara ``format: date-time`` (RFC 3339), que exige
offset: un cliente que valida el formato (claude.ai lo hace) rechaza la respuesta
completa. ``adaptar_fechas`` envuelve cada herramienta para que su salida use modelos
derivados donde todo ``datetime`` sale con el offset de Chile, sin tocar la API REST.
"""
import functools
import inspect
import types
from datetime import datetime
from typing import Annotated, Any, Union, get_args, get_origin
from zoneinfo import ZoneInfo

from pydantic import AfterValidator, BaseModel, create_model


CHILE_TZ = ZoneInfo("America/Santiago")


def a_hora_chile(valor: datetime) -> datetime:
    """Una fecha naive se asume en hora de Chile; una con zona se convierte."""
    if valor.tzinfo is None:
        return valor.replace(tzinfo=CHILE_TZ)
    return valor.astimezone(CHILE_TZ)


FechaHoraChile = Annotated[datetime, AfterValidator(a_hora_chile)]


def _con_zona(tipo: Any) -> Any:
    if tipo is datetime:
        return FechaHoraChile
    if inspect.isclass(tipo) and issubclass(tipo, BaseModel):
        return version_mcp(tipo)
    origen = get_origin(tipo)
    argumentos = get_args(tipo)
    if origen is None or not argumentos:
        return tipo
    if origen is Annotated:
        nuevo = _con_zona(argumentos[0])
        return tipo if nuevo is argumentos[0] else Annotated[(nuevo, *tipo.__metadata__)]
    nuevos = tuple(_con_zona(argumento) for argumento in argumentos)
    if all(nuevo is viejo for nuevo, viejo in zip(nuevos, argumentos)):
        return tipo
    if origen in (Union, types.UnionType):
        return Union[nuevos]
    return origen[nuevos if len(nuevos) > 1 else nuevos[0]]


@functools.cache
def version_mcp(modelo: type[BaseModel]) -> type[BaseModel]:
    """Subclase de ``modelo`` con sus ``datetime`` (también anidados) en hora de Chile con
    offset. Si no tiene ninguno devuelve el mismo modelo."""
    campos = {}
    for nombre, info in modelo.model_fields.items():
        nuevo = _con_zona(info.annotation)
        if nuevo is not info.annotation:
            campos[nombre] = (nuevo, info)
    if not campos:
        return modelo
    return create_model(modelo.__name__, __base__=modelo, __module__=modelo.__module__, **campos)


def adaptar_fechas(herramienta):
    """Envuelve una herramienta async cuyo retorno es un modelo con fechas para que el
    ``outputSchema`` y la respuesta usen ``version_mcp`` del modelo."""
    firma = inspect.signature(herramienta)
    retorno = firma.return_annotation
    if not (inspect.isclass(retorno) and issubclass(retorno, BaseModel)):
        return herramienta
    modelo = version_mcp(retorno)
    if modelo is retorno:
        return herramienta

    @functools.wraps(herramienta)
    async def envoltura(*args, **kwargs):
        resultado = await herramienta(*args, **kwargs)
        return modelo.model_validate(resultado.model_dump())

    envoltura.__signature__ = firma.replace(return_annotation=modelo)
    envoltura.__annotations__ = {**herramienta.__annotations__, "return": modelo}
    return envoltura
