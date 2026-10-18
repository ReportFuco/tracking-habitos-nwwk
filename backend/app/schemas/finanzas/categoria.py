from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime
from typing import Optional


def _limpiar_nombre(valor: str | None) -> str | None:
    if valor is None:
        return None
    limpio = " ".join(valor.split())
    if not limpio:
        raise ValueError("El nombre no puede estar vacío.")
    return limpio


class CategoriaResponse(BaseModel):
    id_categoria:int = Field(..., examples=[1])
    nombre:str = Field(..., examples=["comida"])
    es_propia: bool = Field(
        False,
        description="True si la creó el usuario; false si es una categoría por defecto.",
    )
    activo: bool = Field(True, description="False si está archivada.")
    oculta: bool = Field(False, description="True si el usuario la ocultó: no se ofrece al registrar.")
    usos_recientes: int = Field(0, description="Movimientos del usuario en ella en los últimos 90 días.")
    created_at:datetime = Field(..., examples=["2026-01-03T22:11:30.105251"])

    model_config = ConfigDict(
        title="Respuesta categoría",
        from_attributes=True
    )

class CategoriaCreate(BaseModel):
    nombre:str = Field(..., min_length=1, max_length=100, examples=["comida"])
    por_defecto: bool = Field(
        False,
        description="Solo superusuarios: crea una categoría por defecto, visible para todos.",
    )

    _nombre = field_validator("nombre")(_limpiar_nombre)

    model_config = ConfigDict(
        title="Crear categoría"
    )


class CategoriaPatch(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100, examples=["nueva categoría"])
    activo: Optional[bool] = Field(None, description="true desarchiva una categoría archivada.")

    _nombre = field_validator("nombre")(_limpiar_nombre)

    model_config = ConfigDict(
        title="Modificar categoría"
    )


class CategoriaOcultar(BaseModel):
    oculta: bool = Field(..., description="true la saca de las listas para registrar; false la vuelve a mostrar.")


class MoverMovimientosRequest(BaseModel):
    id_categoria_destino: int = Field(..., ge=1)
    confirmar: bool = Field(False, description="false solo cuenta cuántos se moverían; true los mueve.")


class MoverMovimientosResponse(BaseModel):
    aplicado: bool
    id_categoria_origen: int
    id_categoria_destino: int
    cantidad: int
    monto_total: int
