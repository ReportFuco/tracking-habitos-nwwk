from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, model_validator

from .movimiento_compra import MovimientoVinculadoResumen


class CompraCreate(BaseModel):
    id_local: int
    fecha_compra: datetime

    model_config = ConfigDict(title="Crear compra")


class CompraPatch(BaseModel):
    id_local: Optional[int] = None
    fecha_compra: Optional[datetime] = None

    model_config = ConfigDict(title="Editar compra")


class CompraResponse(BaseModel):
    id_compra: int
    id_local: int
    id_usuario: int
    fecha_compra: datetime
    created_at: datetime
    nombre_local: Optional[str] = None
    nombre_cadena: Optional[str] = None
    total_compra: Decimal = Decimal("0")
    movimientos_vinculados: list[MovimientoVinculadoResumen] = []

    @model_validator(mode="before")
    @classmethod
    def flatten_compra(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            data = data.__dict__.copy()

        local = data.get("local")
        if local:
            data["id_local"] = local.id_local
            data["nombre_local"] = local.nombre_local
            if getattr(local, "cadena", None):
                data["nombre_cadena"] = local.cadena.nombre_cadena

        detalles = data.get("detalles", []) or []
        data["total_compra"] = sum((detalle.precio_total for detalle in detalles), Decimal("0"))

        vinculos = data.get("vinculos_movimiento", []) or []
        data["movimientos_vinculados"] = [vinculo.movimiento for vinculo in vinculos if getattr(vinculo, "movimiento", None)]
        return data

    model_config = ConfigDict(from_attributes=True, title="Respuesta compra")
