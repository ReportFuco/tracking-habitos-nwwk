from pydantic import BaseModel, ConfigDict, model_validator

class SerieFuerzaResponse(BaseModel):
    id_fuerza_detalle: int
    es_calentamiento: bool
    cantidad_peso: float
    repeticiones: int

    # campos aplanados
    nombre_ejercicio: str | None = None
    tipo_ejercicio: str | None = None
    subcategoria_ejercicio: str | None = None
    url_video: str | None = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def flatten_ejercicio(cls, data):
        if hasattr(data, "ejercicio") and data.ejercicio:
            data = data.__dict__.copy()
            ejercicio = data.pop("ejercicio")

            data["nombre_ejercicio"] = ejercicio.nombre
            subcategoria = ejercicio.subcategoria_musculo
            musculo = subcategoria.musculo if subcategoria else None

            data["tipo_ejercicio"] = musculo.nombre if musculo else None
            data["subcategoria_ejercicio"] = subcategoria.nombre if subcategoria else None
            data["url_video"] = ejercicio.url_video

        return data


class SerieFuerzaCreate(BaseModel):
    id_ejercicio: int
    es_calentamiento: bool
    cantidad_peso: float
    repeticiones: int


class SerieFuerzaPatch(BaseModel):
    id_ejercicio: int | None = None
    es_calentamiento: bool | None = None
    cantidad_peso: float | None = None
    repeticiones: int | None = None
