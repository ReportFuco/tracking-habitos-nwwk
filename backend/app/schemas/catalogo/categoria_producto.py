from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CategoriaProductoCreate(BaseModel):
    nombre_categoria: str = Field(..., examples=["Lacteos"])

    model_config = ConfigDict(title="Crear categoria de producto")


class CategoriaProductoPatch(BaseModel):
    nombre_categoria: Optional[str] = Field(default=None, examples=["Snacks"])

    model_config = ConfigDict(title="Editar categoria de producto")


class CategoriaProductoResponse(BaseModel):
    id_categoria: int
    nombre_categoria: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, title="Respuesta categoria de producto")
