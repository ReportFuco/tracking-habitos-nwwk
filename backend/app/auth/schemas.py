from typing import Any
from datetime import datetime

from fastapi_users import schemas
from pydantic import BaseModel, Field, EmailStr, ConfigDict, model_validator


class UsuarioAuthRead(schemas.BaseUser[int]):
    id: int
    email: str
    is_active: bool
    is_superuser: bool


class UsuarioAuthCreate(schemas.CreateUpdateDictModel):

    email: EmailStr = Field(examples=["tu-correo@gmail.com"])
    password: str = Field(examples=["Tu clave secreta"], min_length=6, max_length=20)
    username: str = Field(examples=["tu nombre de usuario"], max_length=20)
    nombre: str = Field(examples=["Tu nombre"], max_length=20)
    apellido: str = Field(examples=["Tu apellido"], max_length=20)
    telefono: str = Field(examples=["Tu teléfono"], max_length=11)

    @model_validator(mode="before")
    @classmethod
    def normalizar_telefono(cls, data: Any) -> Any:
        if isinstance(data, dict):
            telefono = str(data.get("telefono", ""))
            telefono = telefono.replace("+", "").replace(" ", "").strip()

            if not telefono.isdigit():
                raise ValueError("El telefono debe contener solo numeros.")
            if len(telefono) != 11:
                raise ValueError(
                    f"El numero ingresado es de {len(telefono)}. Debe tener exactamente 11 numeros."
                )

            data["telefono"] = telefono

        return data

    model_config = ConfigDict(
        extra="forbid"
    )


class ApiKeyCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=80, examples=["LangChain agent"])

    model_config = ConfigDict(extra="forbid")


class ApiKeyResponse(BaseModel):
    id_api_key: int
    nombre: str
    key_prefix: str
    activo: bool
    usage_count: int
    last_used_at: datetime | None
    last_used_ip: str | None
    created_at: datetime
    revoked_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class ApiKeyCreatedResponse(ApiKeyResponse):
    api_key: str = Field(
        ...,
        description="API key completa. Solo se muestra una vez al crearla.",
    )
