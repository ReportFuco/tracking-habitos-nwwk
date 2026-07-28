from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class MovimientoVinculadoResumen(BaseModel):
    id_transaccion: int
    id_cuenta: int
    nombre_cuenta: Optional[str] = None
    monto: int
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def flatten_movimiento(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            data = data.__dict__.copy()

        cuenta = data.get("cuenta")
        if cuenta:
            data["id_cuenta"] = cuenta.id_cuenta
            data["nombre_cuenta"] = cuenta.nombre_cuenta

        return data

    model_config = ConfigDict(from_attributes=True)


class CompraVinculadaResumen(BaseModel):
    id_compra: int
    fecha_compra: datetime
    id_local: int
    nombre_local: Optional[str] = None
    nombre_cadena: Optional[str] = None
    total_compra: Decimal = Decimal("0")

    @model_validator(mode="before")
    @classmethod
    def flatten_compra(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            data = data.__dict__.copy()

        local = data.get("local")
        if local:
            data["id_local"] = local.id_local
            data["nombre_local"] = local.nombre_local
            if getattr(local, "cadena", None):
                data["nombre_cadena"] = local.cadena.nombre_cadena

        detalles = data.get("detalles", []) or []
        data["total_compra"] = sum((detalle.precio_total for detalle in detalles), Decimal("0"))
        return data

    model_config = ConfigDict(from_attributes=True)


class MovimientoCompraCreate(BaseModel):
    id_movimiento: int = Field(..., examples=[1])
    id_compra: int = Field(..., examples=[1])
    monto_asociado: Optional[Decimal] = Field(None, examples=[13990])

    model_config = ConfigDict(title="Crear vínculo movimiento compra")


class MovimientoCompraResponse(BaseModel):
    id_movimiento_compra: int
    id_movimiento: int
    id_compra: int
    monto_asociado: Optional[Decimal] = None
    created_at: datetime
    movimiento: Optional[MovimientoVinculadoResumen] = None
    compra: Optional[CompraVinculadaResumen] = None

    @model_validator(mode="before")
    @classmethod
    def flatten_relations(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            data = data.__dict__.copy()
        return data

    model_config = ConfigDict(from_attributes=True, title="Respuesta vínculo movimiento compra")


class CompraCompletaDetalleCreate(BaseModel):
    id_producto: int
    cantidad_comprada: Decimal
    unidad_compra: str
    precio_unitario: Decimal
    precio_total: Decimal
    cantidad_unidades: Optional[int] = None


class CompraCompletaCreate(BaseModel):
    id_local: int
    fecha_compra: datetime
    detalles: list[CompraCompletaDetalleCreate] = Field(..., min_length=1)
    id_movimiento: Optional[int] = None
    monto_asociado: Optional[Decimal] = None

    model_config = ConfigDict(title="Crear compra completa")
