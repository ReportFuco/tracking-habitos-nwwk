"""Reglas de categoría: la descripción del movimiento decide su categoría."""
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _limpiar_patron(valor: str) -> str:
    limpio = " ".join(valor.split())
    if len(limpio) < 3:
        raise ValueError("El patrón debe tener al menos 3 caracteres.")
    return limpio


class ReglaCategoriaCreate(BaseModel):
    patron: str = Field(
        ...,
        max_length=80,
        examples=["TOTTUS"],
        description="Texto que debe contener la descripción. Ignora mayúsculas y tildes.",
    )
    id_categoria: int = Field(..., ge=1)

    _patron = field_validator("patron")(_limpiar_patron)


class ReglaCategoriaResponse(BaseModel):
    id_regla: int
    patron: str
    id_categoria: int
    categoria: str
    created_at: datetime

    model_config = ConfigDict(title="Regla de categoría")


class AplicarReglasRequest(BaseModel):
    desde: date | None = Field(None, description="Desde este día (fecha de operación), incluido.")
    hasta: date | None = Field(None, description="Hasta este día, incluido.")
    solo_desde_categorias: list[int] | None = Field(
        None,
        description=(
            "Solo cambia movimientos que hoy están en estas categorías (ej. las que se van a "
            "ocultar). Sin lista, cualquiera."
        ),
    )
    confirmar: bool = Field(False, description="false solo muestra qué cambiaría; true lo aplica.")


class CambioReglas(BaseModel):
    id_categoria_anterior: int
    categoria_anterior: str
    id_categoria_nueva: int
    categoria_nueva: str
    cantidad: int
    monto_total: int
    ejemplos: list[str] = Field(default_factory=list, description="Hasta 3 descripciones.")


class AplicarReglasResponse(BaseModel):
    aplicado: bool
    revisados: int
    cambiados: int
    cambios: list[CambioReglas]
