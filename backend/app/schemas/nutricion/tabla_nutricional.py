from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class TablaNutricionalCreate(BaseModel):
    id_producto: int
    porcion_cantidad: Optional[Decimal] = None
    porcion_unidad: Optional[str] = None
    calorias: Optional[Decimal] = None
    proteinas: Optional[Decimal] = None
    carbohidratos: Optional[Decimal] = None
    grasas: Optional[Decimal] = None
    azucares: Optional[Decimal] = None
    sodio: Optional[Decimal] = None
    fibra: Optional[Decimal] = None

    model_config = ConfigDict(title="Crear tabla nutricional")


class TablaNutricionalPatch(BaseModel):
    id_producto: Optional[int] = None
    porcion_cantidad: Optional[Decimal] = None
    porcion_unidad: Optional[str] = None
    calorias: Optional[Decimal] = None
    proteinas: Optional[Decimal] = None
    carbohidratos: Optional[Decimal] = None
    grasas: Optional[Decimal] = None
    azucares: Optional[Decimal] = None
    sodio: Optional[Decimal] = None
    fibra: Optional[Decimal] = None

    model_config = ConfigDict(title="Editar tabla nutricional")


class TablaNutricionalResponse(BaseModel):
    id_tabla: int
    id_producto: int
    porcion_cantidad: Optional[Decimal]
    porcion_unidad: Optional[str]
    calorias: Optional[Decimal]
    proteinas: Optional[Decimal]
    carbohidratos: Optional[Decimal]
    grasas: Optional[Decimal]
    azucares: Optional[Decimal]
    sodio: Optional[Decimal]
    fibra: Optional[Decimal]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, title="Respuesta tabla nutricional")
