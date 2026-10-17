from pydantic import BaseModel, model_validator, Field, ConfigDict
from datetime import date, datetime
from typing import Any, Optional
from .movimientos import MovimientoResponse


# Respuesta de las cuentas
class CuentaUsuarioResponse(BaseModel):
    id_cuenta:int = Field(..., examples=[1])
    nombre_cuenta: str = Field(..., examples=["Cuenta Falabella corriente"])
    id_producto_financiero: int = Field(..., examples=[1])
    nombre_producto: str = Field(..., examples=["Cuenta Corriente"])
    nombre_banco: Optional[str] = Field(None, examples=["Falabella"])
    saldo_inicial: Optional[int] = Field(None, description="Saldo al cierre de fecha_saldo_inicial.")
    fecha_saldo_inicial: Optional[date] = None
    saldo_actual: Optional[int] = Field(
        None,
        examples=[362875],
        description=(
            "Saldo inicial más los movimientos posteriores. Null si el usuario aún no declara "
            "cuánto tiene en la cuenta. En tarjetas de crédito es negativo (lo que se debe)."
        ),
    )
    created_at : datetime

    @model_validator(mode="before")
    @classmethod
    def flatten_banco(cls, data: Any)->Any:
        if not isinstance(data, dict):
            data = data.__dict__.copy()

        producto_financiero = data.get("producto_financiero", None)

        if producto_financiero:
            data["id_producto_financiero"] = producto_financiero.id_producto_financiero
            data["nombre_producto"] = producto_financiero.nombre_producto
            if producto_financiero.banco:
                data["nombre_banco"] = producto_financiero.banco.nombre_banco

        return data
    
    model_config = ConfigDict(
        title="Respuesta simple cuenta",
        from_attributes=True
    )


# Con movimientos
class CuentaUsuarioMovimientosResponse(CuentaUsuarioResponse):
    
    transacciones: list[MovimientoResponse] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def flatten_transacciones(cls, data:Any)->Any:
        if not isinstance(data, dict):
            data = data.__dict__.copy()

        transacciones = data.get("transacciones", [])
        
        if transacciones:
            data["transacciones"] = sorted(
                transacciones,
                key=lambda movimiento: (
                    getattr(movimiento, "created_at", datetime.min),
                    getattr(movimiento, "id_transaccion", 0),
                ),
                reverse=True,
            )
        return data
            
    model_config = ConfigDict(
        title="Detalle respuesta movimientos cuentas",
        from_attributes=True
    )


class CuentaUsuarioCreate(BaseModel):
    
    id_producto_financiero: int = Field(..., examples=[1])
    nombre_cuenta: str = Field(..., examples=["Tu nombre de cuenta"])
    saldo_actual: Optional[int] = Field(
        None,
        examples=[150000],
        description="Cuánto hay hoy en la cuenta (negativo si es lo que se debe). Opcional.",
    )

    model_config = ConfigDict(
        title="Crear cuenta"
    )


class CuentaSaldoDeclarar(BaseModel):
    """Cuánto hay hoy en la cuenta, según el banco."""

    saldo: int = Field(
        ...,
        examples=[362875],
        description="CLP. Negativo si es lo que se debe (tarjeta de crédito) o un sobregiro.",
    )

    model_config = ConfigDict(title="Declarar saldo de hoy")


class CuentaUsuarioPatch(BaseModel):
    """Actualizar cuenta"""

    nombre_cuenta: Optional[str] = Field(None, examples=["Nuevo nombre de cuenta"])
    id_producto_financiero: Optional[int] = Field(None, examples=[1])
    saldo_inicial: Optional[int] = Field(
        None,
        examples=[782612],
        description="Saldo en CLP al cierre de fecha_saldo_inicial. Puede ser negativo (sobregiro).",
    )
    fecha_saldo_inicial: Optional[date] = Field(
        None,
        examples=["2025-11-02"],
        description="Día del saldo inicial. Los movimientos de ese día o anteriores no cuentan en el saldo.",
    )
