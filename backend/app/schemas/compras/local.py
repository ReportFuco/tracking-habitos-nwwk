from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, model_validator


class LocalCreate(BaseModel):
    id_cadena: Optional[int] = None
    nombre_local: str
    latitud: Optional[Decimal] = None
    longitud: Optional[Decimal] = None
    direccion: Optional[str] = None

    model_config = ConfigDict(title="Crear local")


class LocalPatch(BaseModel):
    id_cadena: Optional[int] = None
    nombre_local: Optional[str] = None
    latitud: Optional[Decimal] = None
    longitud: Optional[Decimal] = None
    direccion: Optional[str] = None

    model_config = ConfigDict(title="Editar local")


class LocalResponse(BaseModel):
    id_local: int
    id_cadena: Optional[int]
    nombre_local: str
    nombre_cadena: Optional[str] = None
    latitud: Optional[Decimal]
    longitud: Optional[Decimal]
    direccion: Optional[str]
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def flatten_cadena(cls, data):
        if not isinstance(data, dict):
            data = data.__dict__.copy()

        cadena = data.get("cadena")
        if cadena:
            data["id_cadena"] = cadena.id_cadena
            data["nombre_cadena"] = cadena.nombre_cadena

        return data

    model_config = ConfigDict(from_attributes=True, title="Respuesta local")
