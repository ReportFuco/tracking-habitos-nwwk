from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class SubcategoriaProductoCreate(BaseModel):
    id_categoria: int = Field(..., examples=[1])
    nombre_subcategoria: str = Field(..., examples=["Yogurt"])

    model_config = ConfigDict(title="Crear subcategoria de producto")


class SubcategoriaProductoPatch(BaseModel):
    id_categoria: Optional[int] = Field(default=None, examples=[1])
    nombre_subcategoria: Optional[str] = Field(default=None, examples=["Leche"])

    model_config = ConfigDict(title="Editar subcategoria de producto")


class SubcategoriaProductoResponse(BaseModel):
    id_subcategoria: int
    id_categoria: int
    nombre_subcategoria: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, title="Respuesta subcategoria de producto")
