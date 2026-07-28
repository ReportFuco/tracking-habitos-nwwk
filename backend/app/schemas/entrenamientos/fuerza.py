from pydantic import BaseModel, ConfigDict, Field, model_validator
from datetime import datetime
from .gimnasio import GimnasioSimpleResponse
from .series import SerieFuerzaResponse


class EntrenoFuerzaResponse(BaseModel):
    id_entrenamiento:int
    id_entrenamiento_fuerza: int
    estado: str
    inicio_at: datetime
    fin_at: datetime | None

    nombre_gimnasio: str | None = None
    nombre_cadena: str | None = None
    comuna: str | None = None
    direccion: str | None = None
    latitud: float | None = None
    longitud: float | None = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def flatten_gimnasio(cls, data):
        if hasattr(data, "gimnasio") and data.gimnasio:
            data = data.__dict__.copy()
            gym = data.pop("gimnasio")

            data.update({
                "nombre_gimnasio": gym.nombre_gimnasio,
                "nombre_cadena": gym.nombre_cadena,
                "comuna": gym.comuna,
                "direccion": gym.direccion,
                "latitud": gym.latitud,
                "longitud": gym.longitud,
            })

        return data


class EntrenoFuerzaCreate(BaseModel):
    observacion:str | None = None
    id_gimnasio: int

    model_config={
        "title":"Crear entreno de Fuerza"
    }


class EntrenoFuerzaSerieResponse(BaseModel):
    id_entrenamiento_fuerza: int
    estado: str
    inicio_at: datetime
    fin_at: datetime | None

    nombre_gimnasio: str | None = None
    nombre_cadena: str | None = None
    comuna: str | None = None
    direccion: str | None = None
    latitud: float | None = None
    longitud: float | None = None

    series: list[SerieFuerzaResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def flatten_gimnasio(cls, data):
        if hasattr(data, "gimnasio") and data.gimnasio:
            data = data.__dict__.copy()
            gym = data.pop("gimnasio")

            data.update({
                "nombre_gimnasio": gym.nombre_gimnasio,
                "nombre_cadena": gym.nombre_cadena,
                "comuna": gym.comuna,
                "direccion": gym.direccion,
                "latitud": gym.latitud,
                "longitud": gym.longitud,
            })

        return data


