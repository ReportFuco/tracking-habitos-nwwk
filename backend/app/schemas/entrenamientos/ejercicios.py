from pydantic import BaseModel, ConfigDict, Field, model_validator


class EjercicioBase(BaseModel):
    nombre: str
    id_subcategoria_musculo: int
    url_video: str | None = None


class EjercicioCreate(EjercicioBase):
    pass


class EjercicioPatch(BaseModel):
    nombre: str | None = None
    id_subcategoria_musculo: int | None = None
    url_video: str | None = None


class EjercicioResponse(EjercicioBase):
    id_ejercicio: int
    id_musculo: int | None = None
    musculo_codigo: str | None = None
    musculo_nombre: str | None = None
    subcategoria_codigo: str | None = None
    subcategoria_nombre: str | None = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def flatten_subcategoria(cls, data):
        if hasattr(data, "subcategoria_musculo") and data.subcategoria_musculo:
            values = data.__dict__.copy()
            subcategoria = values.get("subcategoria_musculo")
            musculo = subcategoria.musculo

            values["id_musculo"] = subcategoria.id_musculo
            values["subcategoria_codigo"] = subcategoria.codigo
            values["subcategoria_nombre"] = subcategoria.nombre
            values["musculo_codigo"] = musculo.codigo if musculo else None
            values["musculo_nombre"] = musculo.nombre if musculo else None
            return values

        return data


class SubcategoriaMusculoResponse(BaseModel):
    id_subcategoria_musculo: int
    id_musculo: int
    codigo: str
    nombre: str
    activo: bool

    model_config = ConfigDict(from_attributes=True)


class MusculoResponse(BaseModel):
    id_musculo: int
    codigo: str
    nombre: str
    activo: bool
    subcategorias: list[SubcategoriaMusculoResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
