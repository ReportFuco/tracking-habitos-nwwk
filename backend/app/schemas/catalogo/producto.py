from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ProductoCreate(BaseModel):
    id_marca: int
    id_categoria: Optional[int] = Field(default=None, examples=[1])
    id_subcategoria: Optional[int] = Field(default=None, examples=[1])
    nombre_producto: str = Field(..., examples=["Yogurt protein"])
    codigo_barra: str = Field(..., examples=["7801234567890"])
    sabor: Optional[str] = Field(default=None, examples=["Frutilla"])
    formato: Optional[str] = Field(default=None, examples=["Botella"])
    contenido_neto: Optional[Decimal] = Field(default=None, examples=[350])
    unidad_contenido: Optional[str] = Field(default=None, examples=["ml"])
    activo: bool = True

    model_config = ConfigDict(title="Crear producto")


class ProductoPatch(BaseModel):
    id_marca: Optional[int] = None
    id_categoria: Optional[int] = None
    id_subcategoria: Optional[int] = None
    nombre_producto: Optional[str] = None
    codigo_barra: Optional[str] = None
    sabor: Optional[str] = None
    formato: Optional[str] = None
    contenido_neto: Optional[Decimal] = None
    unidad_contenido: Optional[str] = None
    activo: Optional[bool] = None

    model_config = ConfigDict(title="Editar producto")


class ProductoResponse(BaseModel):
    id_producto: int
    id_marca: int
    id_categoria: Optional[int]
    id_subcategoria: Optional[int]
    nombre_producto: str
    codigo_barra: str
    categoria: Optional[str]
    subcategoria: Optional[str]
    sabor: Optional[str]
    formato: Optional[str]
    contenido_neto: Optional[Decimal]
    unidad_contenido: Optional[str]
    activo: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, title="Respuesta producto")
