from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CadenaCreate(BaseModel):
    nombre_cadena: str = Field(..., examples=["Lider"])

    model_config = ConfigDict(title="Crear cadena")


class CadenaPatch(BaseModel):
    nombre_cadena: Optional[str] = Field(default=None, examples=["Jumbo"])

    model_config = ConfigDict(title="Editar cadena")


class CadenaResponse(BaseModel):
    id_cadena: int
    nombre_cadena: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, title="Respuesta cadena")
