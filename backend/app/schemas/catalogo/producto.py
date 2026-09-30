from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _texto_opcional(valor: str | None) -> str | None:
    if valor is None:
        return None
    limpio = " ".join(valor.split())
    return limpio or None


def _nombre(valor: str | None) -> str | None:
    if valor is None:
        return None
    limpio = " ".join(valor.split())
    if not limpio:
        raise ValueError("El nombre del producto no puede estar vacío.")
    return limpio


class ProductoCreate(BaseModel):
    id_marca: Optional[int] = Field(default=None, examples=[1])
    id_categoria: Optional[int] = Field(default=None, examples=[1])
    id_subcategoria: Optional[int] = Field(default=None, examples=[1])
    nombre_producto: str = Field(..., max_length=160, examples=["Yogurt protein"])
    codigo_barra: Optional[str] = Field(default=None, max_length=64, examples=["7801234567890"])
    sabor: Optional[str] = Field(default=None, max_length=100, examples=["Frutilla"])
    formato: Optional[str] = Field(default=None, max_length=100, examples=["Botella"])
    contenido_neto: Optional[Decimal] = Field(default=None, gt=0, examples=[350])
    unidad_contenido: Optional[str] = Field(default=None, max_length=30, examples=["ml"])
    activo: bool = True

    _nombre = field_validator("nombre_producto")(_nombre)
    _textos = field_validator("codigo_barra", "sabor", "formato", "unidad_contenido")(_texto_opcional)

    model_config = ConfigDict(title="Crear producto")


class ProductoPatch(BaseModel):
    id_marca: Optional[int] = None
    id_categoria: Optional[int] = None
    id_subcategoria: Optional[int] = None
    nombre_producto: Optional[str] = Field(default=None, max_length=160)
    codigo_barra: Optional[str] = Field(default=None, max_length=64)
    sabor: Optional[str] = Field(default=None, max_length=100)
    formato: Optional[str] = Field(default=None, max_length=100)
    contenido_neto: Optional[Decimal] = Field(default=None, gt=0)
    unidad_contenido: Optional[str] = Field(default=None, max_length=30)
    activo: Optional[bool] = None

    _nombre = field_validator("nombre_producto")(_nombre)
    _textos = field_validator("codigo_barra", "sabor", "formato", "unidad_contenido")(_texto_opcional)

    model_config = ConfigDict(title="Editar producto")


class ProductoFusionar(BaseModel):
    id_producto_destino: int = Field(
        ...,
        description="Producto aprobado que se conserva. El duplicado se elimina y sus usos pasan a este.",
    )

    model_config = ConfigDict(title="Fusionar producto")


class ProductoResponse(BaseModel):
    id_producto: int
    id_marca: Optional[int]
    nombre_marca: Optional[str]
    id_categoria: Optional[int]
    id_subcategoria: Optional[int]
    nombre_producto: str
    codigo_barra: Optional[str]
    categoria: Optional[str]
    subcategoria: Optional[str]
    sabor: Optional[str]
    formato: Optional[str]
    contenido_neto: Optional[Decimal]
    unidad_contenido: Optional[str]
    activo: bool
    estado: str = Field(description="'pendiente', 'aprobado' o 'rechazado'.")
    id_usuario_creador: Optional[int] = None
    username_creador: Optional[str] = Field(
        None,
        description="Solo en la cola de revisión del administrador.",
    )
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, title="Respuesta producto")
