from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class PesoUsuarioCreate(BaseModel):
    fecha_registro: date
    peso_kg: Decimal

    model_config = ConfigDict(title="Crear peso usuario")


class PesoUsuarioPatch(BaseModel):
    fecha_registro: Optional[date] = None
    peso_kg: Optional[Decimal] = None

    model_config = ConfigDict(title="Editar peso usuario")


class PesoUsuarioResponse(BaseModel):
    id_peso: int
    id_usuario: int
    fecha_registro: date
    peso_kg: Decimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, title="Respuesta peso usuario")
