from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class CompraDetalleCreate(BaseModel):
    id_compra: int
    id_producto: int
    cantidad_comprada: Decimal
    unidad_compra: str
    precio_unitario: Decimal
    precio_total: Decimal
    cantidad_unidades: Optional[int] = None

    model_config = ConfigDict(title="Crear detalle de compra")


class CompraDetallePatch(BaseModel):
    id_producto: Optional[int] = None
    cantidad_comprada: Optional[Decimal] = None
    unidad_compra: Optional[str] = None
    precio_unitario: Optional[Decimal] = None
    precio_total: Optional[Decimal] = None
    cantidad_unidades: Optional[int] = None

    model_config = ConfigDict(title="Editar detalle de compra")


class CompraDetalleResponse(BaseModel):
    id_detalle: int
    id_compra: int
    id_producto: int
    cantidad_comprada: Decimal
    unidad_compra: str
    precio_unitario: Decimal
    precio_total: Decimal
    cantidad_unidades: Optional[int]

    model_config = ConfigDict(from_attributes=True, title="Respuesta detalle compra")
