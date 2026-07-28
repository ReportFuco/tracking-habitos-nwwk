from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ConsumoCreate(BaseModel):
    fecha_consumo: datetime
    tipo_comida: str
    observacion: Optional[str] = None

    model_config = ConfigDict(title="Crear consumo")


class ConsumoPatch(BaseModel):
    fecha_consumo: Optional[datetime] = None
    tipo_comida: Optional[str] = None
    observacion: Optional[str] = None

    model_config = ConfigDict(title="Editar consumo")


class ConsumoResponse(BaseModel):
    id_consumo: int
    id_usuario: int
    fecha_consumo: datetime
    tipo_comida: str
    observacion: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, title="Respuesta consumo")
