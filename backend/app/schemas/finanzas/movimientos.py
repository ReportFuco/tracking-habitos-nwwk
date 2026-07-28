from pydantic import (
    BaseModel, 
    model_validator, 
    Field, 
    ConfigDict
)
from typing import Optional, Any
from app.models.finanzas import (
    EnumTipoMovimiento, 
    EnumTipoGasto
)
from datetime import datetime
from app.schemas.compras import CompraVinculadaResumen


class MovimientoResponse(BaseModel):

    id_transaccion:int = Field(..., examples=[1])
    tipo_movimiento: EnumTipoMovimiento = Field(..., examples=[EnumTipoMovimiento.GASTO.value])
    tipo_gasto: EnumTipoGasto = Field(..., examples=[EnumTipoGasto.FIJO.value])
    categoria: Optional[str] = Field(None, examples=["comida"])
    nombre_cuenta: Optional[str] = Field(None, examples=["Nombre cuenta"])
    compras_vinculadas: list[CompraVinculadaResumen] = Field(default_factory=list)
    total_compras_vinculadas: Optional[float] = Field(None, examples=[9900])
    diferencia_total_compras: Optional[float] = Field(None, examples=[100])

    monto:int = Field(..., examples=[5000])
    descripcion: Optional[str] = Field(
        None,
        examples=["Descripcion del movimiento"],
    )
    created_at: datetime = Field(..., examples=["2026-01-03T18:37:18.638764"])

    @model_validator(mode='before')
    @classmethod
    def validate_info(cls, data: Any)->Any:
        if not isinstance(data, dict):
            data = data.__dict__

        categoria = data.get("categoria")
        cuenta = data.get("cuenta")

        if categoria:
            data["categoria"] = categoria.nombre
        if cuenta:
            data["nombre_cuenta"] = cuenta.nombre_cuenta

        vinculos = data.get("vinculos_compra", []) or []
        compras = [vinculo.compra for vinculo in vinculos if getattr(vinculo, "compra", None)]
        data["compras_vinculadas"] = compras

        total_compras = 0
        for compra in compras:
            detalles = getattr(compra, "detalles", []) or []
            total_compras += sum((detalle.precio_total for detalle in detalles), 0)
        if compras:
            data["total_compras_vinculadas"] = float(total_compras)
            monto = data.get("monto")
            if monto is not None:
                data["diferencia_total_compras"] = float(monto - total_compras)

        return data
    
    model_config = ConfigDict(
        title="Respuesta movimiento",
        from_attributes=True
    )


class MovimientoCreate(BaseModel):
    id_categoria: int = Field(..., examples=[1], description="Ingresa el ID de la categoria.")
    id_cuenta: int = Field(..., examples=[1], description="ID de la cuenta del usuario.")
    tipo_movimiento: EnumTipoMovimiento = Field(
        ..., 
        examples=[EnumTipoMovimiento.GASTO.value], 
        description="Se ingresa el tipo de movimiento, este puede ser 'gasto' o 'ingreso'."
    )
    tipo_gasto: EnumTipoGasto = Field(
        ..., 
        examples=[EnumTipoGasto.FIJO.value], 
        description="Se ingresa el tipo de gasto, puede ser 'variable' o 'fijo'."
    )
    monto: int = Field(
        ..., 
        examples=[3500], 
        description="Ingresa el monto del movimiento.",
        gt=0
    )
    
    descripcion: Optional[str] = Field(
        None, 
        examples=["Aquí va la descripción"], 
        description="Ingresa una descripción del gasto, algún detalle."
    )
    created_at: Optional[datetime] = Field(
        None,
        examples=["2025-12-15T10:30:00"],
        description="Fecha del movimiento. Si no se envía, se usa la fecha actual."
    )

    model_config = ConfigDict(
        title="Crear movimiento"
    )


class MovimientoPatch(BaseModel):
    tipo_movimiento: Optional[EnumTipoMovimiento] = None
    tipo_gasto: Optional[EnumTipoGasto] = None
    id_categoria: Optional[int] = None
    id_cuenta: Optional[int] = None
    monto: Optional[int] = None

    model_config = ConfigDict(
        title="Modificar Movimiento"
    )


class MovimientoListResponse(BaseModel):
    items: list[MovimientoResponse] = Field(default_factory=list)
    offset: int = Field(..., examples=[0])
    limit: int = Field(..., examples=[20])
    total_gasto_mensual: float = Field(
        ...,
        examples=[245000],
        description="Suma de gastos del mes actual en horario de Chile."
    )

    model_config = ConfigDict(
        title="Lista paginada de movimientos"
    )
