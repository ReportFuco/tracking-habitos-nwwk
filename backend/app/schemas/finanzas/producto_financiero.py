from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ProductoFinancieroBase(BaseModel):
    id_banco: int = Field(..., examples=[1])
    nombre_producto: str = Field(..., examples=["CuentaRUT"])
    descripcion: str | None = Field(
        default=None,
        examples=["Producto financiero principal del banco"],
    )


class ProductoFinancieroCreate(ProductoFinancieroBase):
    pass


class ProductoFinancieroPatch(BaseModel):
    id_banco: Optional[int] = Field(default=None, examples=[1])
    nombre_producto: Optional[str] = Field(default=None, examples=["CMR Platinum"])
    descripcion: Optional[str] = Field(default=None, examples=["Tarjeta de credito premium"])
    activo: Optional[bool] = Field(default=None, examples=[True])


class ProductoFinancieroResponse(BaseModel):
    id_producto_financiero: int
    id_banco: int
    nombre_banco: str | None = None
    nombre_producto: str
    descripcion: str | None = None
    activo: bool
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def flatten_banco(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            data = data.__dict__.copy()

        banco = data.get("banco")
        if banco:
            data["nombre_banco"] = banco.nombre_banco
        return data

    model_config = ConfigDict(from_attributes=True)
