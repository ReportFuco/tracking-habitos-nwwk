from pydantic import BaseModel, model_validator, Field, ConfigDict
from datetime import datetime
from typing import Any, Type, Optional
 

class UsuarioCreate(BaseModel):

    username:str = Field(..., min_length=3, max_length=20, examples=["Fuco"])
    nombre: str = Field(..., min_length=1, max_length=50,examples=["Francisco Antonio", "Felipe Ignacio"])
    apellido: str = Field(..., min_length=1, max_length=50, examples=["Arancibia Guaiquiante", "Quinteros Berrios"])
    telefono: str = Field(..., examples=["56978086719"])
    email: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def parsear_numero(cls: Type["UsuarioCreate"], data: Any) -> Any:
        if not isinstance(data, dict):
            data.__dict__
        
        telefono = str(data.get("telefono", ""))
        telefono = (telefono.replace("+", "").replace(" ", "").strip())

        if not telefono.isdigit():
            raise ValueError("El teléfono debe contener solo números.")
        if len(telefono) != 11:
            raise ValueError(f"El número ingresado es de {len(telefono)}. No puede tener más ni menos de 11 números.")
        data["telefono"] = telefono

        return data
    
    model_config = ConfigDict(title="Crear Usuario")


class UsuarioPatchSchema(BaseModel):
    username: Optional[str] = Field(default=None, examples=["Tu nombre de usuario"])
    nombre: Optional[str] = Field(default=None, examples=["Tu nombre"])
    apellido: Optional[str] = Field(default=None, examples=["Tu Apellido"])
    telefono: Optional[str] = Field(default=None, examples=["Tu teléfono"])
    email: Optional[str] = Field(default=None, examples=["Tu correo"])

    model_config = ConfigDict(title="Modificar Usuario")


class UsuarioResponse(BaseModel):
    id_usuario: int = Field(..., examples=[1, 2, 3, 4])
    username:str = Field(..., examples=["Fuco"])
    nombre: str = Field(..., examples=["Francisco Antonio"])
    apellido: str = Field(..., examples=["Arancibia Guaiquiante"])
    telefono: str = Field(..., examples=["56978086719"])
    email: str = Field(..., examples=["frarancibia.g@gmail.com"])
    created_at: datetime = Field(examples=["2025-12-29T23:43:49.887Z"])
    is_active: bool = Field(..., examples=[True, False])
    is_superuser: bool = Field(..., examples=[False, True])

    model_config = ConfigDict(
        from_attributes=True,
        title="Respuesta Usuario"
    )

    # is_active/is_superuser viven en auth.user, no en usuarios.usuario. Se aplanan desde
    # la relacion en vez de declarar dos schemas de perfil paralelos que pueden derivar
    # (ver docs/auditoria/PLAN_FRONTEND.md, FE-ZOD-002): quien arme la query tiene que
    # cargar `Usuario.user` (selectinload), si no estos dos campos quedan ausentes y la
    # validacion falla en vez de mentir con un default.
    @model_validator(mode="before")
    @classmethod
    def flatten_user(cls, data: Any) -> Any:
        if hasattr(data, "user") and data.user:
            data = data.__dict__.copy()
            auth_user = data.pop("user")
            data["is_active"] = auth_user.is_active
            data["is_superuser"] = auth_user.is_superuser

        return data


class UsuarioPerfilResponse(UsuarioResponse):
    model_config = ConfigDict(
        from_attributes=True,
        title="Respuesta Perfil Usuario"
    )
