from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class MarcaCreate(BaseModel):
    nombre_marca: str = Field(..., examples=["Nestle"])

    model_config = ConfigDict(title="Crear marca")


class MarcaPatch(BaseModel):
    nombre_marca: Optional[str] = Field(default=None, examples=["Soprole"])

    model_config = ConfigDict(title="Editar marca")


class MarcaResponse(BaseModel):
    id_marca: int
    nombre_marca: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, title="Respuesta marca")
