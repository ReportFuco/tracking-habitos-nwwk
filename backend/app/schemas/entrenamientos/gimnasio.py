from pydantic import BaseModel
from datetime import datetime


class GimnasioCreate(BaseModel):
    nombre_gimnasio: str
    nombre_cadena: str | None
    direccion: str
    comuna: str | None
    latitud: float
    longitud:float

    model_config = {
        "from_attributes":True,
        "title": "Crear Gimnasio",
        "json_schema_extra":{
            "example":{
                "nombre_gimnasio": "Smart Fit Oeste",
                "nombre_cadena": "Smart Fit",
                "direccion": "Av. Siempre Viva 123",
                "comuna": "Ñuñoa",
                "latitud": -33.456,
                "longitud": -70.648
            }
        }
    }


class GimnasioEdit(BaseModel):
    nombre_gimnasio: str | None = None
    nombre_cadena: str | None = None
    direccion: str | None = None
    comuna: str | None = None
    latitud: float | None = None
    longitud:float | None = None

    model_config = {
        "from_attributes": True,
        "title": "Editar Gimnasio",
        "json_schema_extra": {
            "example": {
                "nombre_gimnasio": "Smart Fit Oeste",
                "nombre_cadena": "Smart Fit",
                "direccion": "Av. Siempre Viva 123",
                "comuna": "Ñuñoa",
                "latitud": -33.456,
                "longitud": -70.648
            }
        }
    }


class GimnasioResponse(BaseModel):
    id_gimnasio: int
    nombre_gimnasio: str
    nombre_cadena: str | None
    direccion: str
    comuna: str | None
    latitud: float
    longitud:float
    activo: bool
    created_at: datetime

    model_config = {
        'from_attributes': True,
        'title':"Respuesta Gimnasio",
        "json_schema_extra": {
            "example": {
                "id_gimnasio": 1,
                "nombre_gimnasio": "Smart Fit",
                "direccion": "Av. Siempre Viva 123",
                "comuna": "Ñuñoa",
                "latitud": -33.456,
                "longitud": -70.648,
                "activo": True,
                "created_at": "2025-12-23T09:17:44.901232"
            }
        }
    }


class GimnasioSimpleResponse(BaseModel):
    nombre_gimnasio: str
    comuna: str
    latitud: float
    longitud: float

    model_config = {
        "from_attributes": True,
    }