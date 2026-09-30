from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.finanzas import EnumTipoDeuda


def _limpiar_texto(valor: str | None) -> str | None:
    if valor is None:
        return None
    return " ".join(valor.split()) or None


class DeudaResponse(BaseModel):
    id_deuda: int = Field(..., examples=[1])
    tipo: EnumTipoDeuda = Field(..., examples=[EnumTipoDeuda.DEBO.value])
    nombre: str = Field(..., examples=["Crédito de consumo"])
    contraparte: Optional[str] = Field(None, examples=["Banco Estado"])
    descripcion: Optional[str] = None
    monto_total: int = Field(..., examples=[1200000])
    abonado: int = Field(..., examples=[300000], description="Suma de los movimientos que la abonan.")
    saldo: int = Field(..., examples=[900000], description="monto_total - abonado.")
    estado: Literal["activa", "pagada"] = Field(..., description="'pagada' cuando el saldo llega a 0.")
    cantidad_abonos: int = Field(0, examples=[3])
    ultimo_abono: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(title="Respuesta deuda")


class DeudaListResponse(BaseModel):
    items: list[DeudaResponse] = Field(default_factory=list)
    total_debo: int = Field(..., description="Saldo pendiente de las deudas 'debo'.")
    total_me_deben: int = Field(..., description="Saldo pendiente de las deudas 'me_deben'.")

    model_config = ConfigDict(title="Lista de deudas")


class DeudaCreate(BaseModel):
    tipo: EnumTipoDeuda = Field(
        ...,
        examples=[EnumTipoDeuda.DEBO.value],
        description="'debo' se abona con gastos; 'me_deben' se abona con ingresos.",
    )
    nombre: str = Field(..., min_length=1, max_length=120, examples=["Crédito de consumo"])
    contraparte: Optional[str] = Field(
        None,
        max_length=120,
        examples=["Banco Estado"],
        description="A quién se le debe o quién debe.",
    )
    monto_total: int = Field(..., gt=0, examples=[1200000], description="Monto total en CLP.")
    descripcion: Optional[str] = Field(None, max_length=500)

    _nombre = field_validator("nombre")(_limpiar_texto)
    _contraparte = field_validator("contraparte")(_limpiar_texto)

    @field_validator("nombre")
    @classmethod
    def nombre_no_vacio(cls, valor: str | None) -> str:
        if not valor:
            raise ValueError("El nombre no puede estar vacío.")
        return valor

    model_config = ConfigDict(title="Crear deuda")


class DeudaPatch(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=120)
    # null borra la contraparte y la descripción (columnas nullable).
    contraparte: Optional[str] = Field(None, max_length=120)
    monto_total: Optional[int] = Field(None, gt=0)
    descripcion: Optional[str] = Field(None, max_length=500)

    _nombre = field_validator("nombre")(_limpiar_texto)
    _contraparte = field_validator("contraparte")(_limpiar_texto)

    @model_validator(mode="after")
    def validar_no_nulos(self):
        nulos = sorted(
            campo for campo in ("nombre", "monto_total")
            if campo in self.model_fields_set and getattr(self, campo) is None
        )
        if nulos:
            raise ValueError(f"Estos campos no pueden ser nulos: {', '.join(nulos)}.")
        return self

    model_config = ConfigDict(title="Modificar deuda")
