from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional


class CategoriaResponse(BaseModel):
    id_categoria:int = Field(..., examples=[1])
    nombre:str = Field(..., examples=["comida"])
    created_at:datetime = Field(..., examples=["2026-01-03T22:11:30.105251"])

    model_config = ConfigDict(
        title="Respuesta categoría",
        from_attributes=True
    )

class CategoriaCreate(BaseModel):
    nombre:str = Field(..., examples=["comida"])

    model_config = ConfigDict(
        title="Crear categoría"
    )


class CategoriaPatch(BaseModel):
    nombre: Optional[str] = Field(..., examples=["nueva categoría"])

    model_config = ConfigDict(
        title="Modificar categoría"
    )