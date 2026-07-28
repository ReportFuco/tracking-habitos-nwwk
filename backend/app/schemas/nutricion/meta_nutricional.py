from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class MetaNutricionalCreate(BaseModel):
    fecha_inicio: date
    fecha_fin: Optional[date] = None
    calorias_objetivo: Optional[int] = None
    proteinas_objetivo: Optional[int] = None
    carbohidratos_objetivo: Optional[int] = None
    grasas_objetivo: Optional[int] = None

    model_config = ConfigDict(title="Crear meta nutricional")


class MetaNutricionalPatch(BaseModel):
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    calorias_objetivo: Optional[int] = None
    proteinas_objetivo: Optional[int] = None
    carbohidratos_objetivo: Optional[int] = None
    grasas_objetivo: Optional[int] = None

    model_config = ConfigDict(title="Editar meta nutricional")


class MetaNutricionalResponse(BaseModel):
    id_meta: int
    id_usuario: int
    fecha_inicio: date
    fecha_fin: Optional[date]
    calorias_objetivo: Optional[int]
    proteinas_objetivo: Optional[int]
    carbohidratos_objetivo: Optional[int]
    grasas_objetivo: Optional[int]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, title="Respuesta meta nutricional")
