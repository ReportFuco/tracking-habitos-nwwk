from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ConsumoDetalleCreate(BaseModel):
    id_consumo: int
    id_producto: int
    cantidad_consumida: Decimal
    unidad_consumida: str

    model_config = ConfigDict(title="Crear detalle de consumo")


class ConsumoDetallePatch(BaseModel):
    id_producto: Optional[int] = None
    cantidad_consumida: Optional[Decimal] = None
    unidad_consumida: Optional[str] = None

    model_config = ConfigDict(title="Editar detalle de consumo")


class ConsumoDetalleResponse(BaseModel):
    id_consumo_detalle: int
    id_consumo: int
    id_producto: int
    cantidad_consumida: Decimal
    unidad_consumida: str

    model_config = ConfigDict(from_attributes=True, title="Respuesta detalle consumo")
