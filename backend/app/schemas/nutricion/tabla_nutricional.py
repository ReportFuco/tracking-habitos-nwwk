from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict

from ._tipos import Numero


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
    nombre_producto: Optional[str]
    # Del producto: para convertir "1 unidad" a gramos/ml contra la porción de la tabla.
    contenido_neto: Optional[Numero] = None
    unidad_contenido: Optional[str] = None
    porcion_cantidad: Optional[Numero]
    porcion_unidad: Optional[str]
    calorias: Optional[Numero]
    proteinas: Optional[Numero]
    carbohidratos: Optional[Numero]
    grasas: Optional[Numero]
    azucares: Optional[Numero]
    sodio: Optional[Numero]
    fibra: Optional[Numero]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, title="Respuesta tabla nutricional")
