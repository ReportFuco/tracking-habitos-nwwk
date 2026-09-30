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
from decimal import Decimal
from uuid import UUID


def _formatear_cantidad(valor: Decimal | None) -> str | None:
    if valor is None:
        return None
    return f"{valor.normalize():f}"


class MovimientoItemResponse(BaseModel):
    id_item: int
    id_producto: int
    nombre_producto: str
    nombre_marca: Optional[str] = None
    detalle_producto: Optional[str] = Field(
        None,
        examples=["1 L · Botella"],
        description="Contenido y formato del producto, para distinguir variantes.",
    )
    estado_producto: str = Field(
        ...,
        description="'aprobado', o 'pendiente'/'rechazado' si es una propuesta del usuario.",
    )
    cantidad: float = Field(..., examples=[2])
    precio_total: Optional[int] = Field(None, examples=[2380])
    precio_unitario: Optional[float] = Field(None, examples=[1190])

    @model_validator(mode="before")
    @classmethod
    def aplanar_producto(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        producto = data.producto
        contenido = None
        if producto.contenido_neto is not None:
            contenido = " ".join(
                parte for parte in (_formatear_cantidad(producto.contenido_neto), producto.unidad_contenido) if parte
            )
        detalle = " · ".join(parte for parte in (contenido, producto.formato, producto.sabor) if parte) or None
        cantidad = float(data.cantidad)
        return {
            "id_item": data.id_item,
            "id_producto": data.id_producto,
            "nombre_producto": producto.nombre_producto,
            "nombre_marca": producto.nombre_marca,
            "detalle_producto": detalle,
            "estado_producto": producto.estado,
            "cantidad": cantidad,
            "precio_total": data.precio_total,
            "precio_unitario": (
                round(data.precio_total / cantidad, 2) if data.precio_total is not None and cantidad else None
            ),
        }

    model_config = ConfigDict(title="Producto de un gasto")


class MovimientoItemCreate(BaseModel):
    id_producto: int = Field(..., ge=1, description="Ver GET /api/catalogo/producto/.")
    cantidad: Decimal = Field(
        Decimal("1"),
        gt=0,
        le=100000,
        decimal_places=3,
        examples=[2],
        description="Unidades, o kilos/litros si se vende a granel (ej. 0.75).",
    )
    precio_total: Optional[int] = Field(
        None,
        ge=0,
        examples=[2380],
        description="Lo que se pagó por esta línea (cantidad × precio unitario), en CLP.",
    )

    model_config = ConfigDict(title="Agregar producto a un gasto")


class MovimientoItemPatch(BaseModel):
    id_producto: Optional[int] = Field(None, ge=1)
    cantidad: Optional[Decimal] = Field(None, gt=0, le=100000, decimal_places=3)
    # null borra el precio (la columna es nullable).
    precio_total: Optional[int] = Field(None, ge=0)

    @model_validator(mode="after")
    def validar_no_nulos(self):
        nulos = sorted(
            campo for campo in ("id_producto", "cantidad")
            if campo in self.model_fields_set and getattr(self, campo) is None
        )
        if nulos:
            raise ValueError(f"Estos campos no pueden ser nulos: {', '.join(nulos)}.")
        return self

    model_config = ConfigDict(title="Editar producto de un gasto")


class MovimientoResponse(BaseModel):

    id_transaccion:int = Field(..., examples=[1])
    client_request_id: Optional[UUID] = None
    tipo_movimiento: EnumTipoMovimiento = Field(..., examples=[EnumTipoMovimiento.GASTO.value])
    tipo_gasto: EnumTipoGasto = Field(..., examples=[EnumTipoGasto.FIJO.value])
    id_categoria: int = Field(..., examples=[1])
    categoria: Optional[str] = Field(None, examples=["comida"])
    nombre_cuenta: Optional[str] = Field(None, examples=["Nombre cuenta"])
    id_deuda: Optional[int] = Field(None, description="Deuda que abona este movimiento.")
    deuda: Optional[str] = Field(None, examples=["Crédito de consumo"], description="Nombre de la deuda.")
    items: list[MovimientoItemResponse] = Field(
        default_factory=list,
        description="Productos detallados del gasto. Puede cubrir solo parte del monto.",
    )
    total_detallado: int = Field(
        0,
        examples=[9900],
        description="Suma de los precios de los productos detallados.",
    )

    monto:int = Field(..., examples=[5000])
    descripcion: Optional[str] = Field(
        None,
        examples=["Descripcion del movimiento"],
    )
    en_lugar_compra: bool = False
    latitud: Optional[float] = Field(None, ge=-90, le=90)
    longitud: Optional[float] = Field(None, ge=-180, le=180)
    precision_ubicacion: Optional[float] = Field(None, ge=0, allow_inf_nan=False)
    created_at: datetime = Field(..., examples=["2026-01-03T18:37:18.638764"])

    @model_validator(mode='before')
    @classmethod
    def validate_info(cls, data: Any)->Any:
        # Copia: escribir sobre __dict__ del objeto ORM dejaba `categoria` como texto en
        # la instancia de la sesión.
        data = dict(data) if isinstance(data, dict) else dict(data.__dict__)

        categoria = data.get("categoria")
        cuenta = data.get("cuenta")
        deuda = data.get("deuda")

        if categoria:
            data["categoria"] = categoria.nombre
        if cuenta:
            data["nombre_cuenta"] = cuenta.nombre_cuenta
        if deuda is not None and not isinstance(deuda, str):
            data["deuda"] = deuda.nombre

        items = data.get("items") or []
        data["total_detallado"] = sum(
            (item.precio_total or 0) if not isinstance(item, dict) else (item.get("precio_total") or 0)
            for item in items
        )

        return data
    
    model_config = ConfigDict(
        title="Respuesta movimiento",
        from_attributes=True
    )


class MovimientoCreate(BaseModel):
    client_request_id: Optional[UUID] = Field(
        None,
        description="Identificador idempotente generado por el cliente para reintentos offline.",
    )
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
    en_lugar_compra: bool = Field(
        False,
        description="Indica que la ubicación corresponde físicamente al lugar de compra.",
    )
    latitud: Optional[float] = Field(None, ge=-90, le=90)
    longitud: Optional[float] = Field(None, ge=-180, le=180)
    precision_ubicacion: Optional[float] = Field(
        None,
        ge=0,
        allow_inf_nan=False,
        description="Precisión estimada de la geolocalización, en metros.",
    )
    created_at: Optional[datetime] = Field(
        None,
        examples=["2025-12-15T10:30:00"],
        description="Fecha del movimiento. Si no se envía, se usa la fecha actual."
    )
    id_deuda: Optional[int] = Field(
        None,
        ge=1,
        description=(
            "Deuda que abona el movimiento: un gasto abona una deuda 'debo' y un ingreso una "
            "'me_deben'. No puede superar el saldo pendiente."
        ),
    )
    items: list[MovimientoItemCreate] = Field(
        default_factory=list,
        max_length=100,
        description=(
            "Productos comprados en el gasto, creados junto con él. Opcional: también se "
            "pueden agregar después con POST /{id_movimiento}/items."
        ),
    )

    @model_validator(mode="after")
    def validate_items(self):
        if self.items and self.tipo_movimiento != EnumTipoMovimiento.GASTO:
            raise ValueError("Solo los gastos pueden detallar productos.")
        return self

    @model_validator(mode="after")
    def validate_purchase_location(self):
        location = (self.latitud, self.longitud, self.precision_ubicacion)

        if self.en_lugar_compra:
            if self.tipo_movimiento != EnumTipoMovimiento.GASTO:
                raise ValueError("La ubicación del lugar de compra solo aplica a gastos.")
            if any(value is None for value in location):
                raise ValueError(
                    "Latitud, longitud y precisión son obligatorias al indicar el lugar de compra."
                )
        elif any(value is not None for value in location):
            raise ValueError(
                "La ubicación solo puede enviarse cuando en_lugar_compra es verdadero."
            )

        return self

    model_config = ConfigDict(
        title="Crear movimiento"
    )


# Columnas NOT NULL: en el PATCH un null explicito no significa "borrar", es invalido.
CAMPOS_PATCH_NO_NULOS = ("tipo_movimiento", "tipo_gasto", "id_categoria", "id_cuenta", "monto", "created_at")


class MovimientoPatch(BaseModel):
    tipo_movimiento: Optional[EnumTipoMovimiento] = None
    tipo_gasto: Optional[EnumTipoGasto] = None
    id_categoria: Optional[int] = None
    id_cuenta: Optional[int] = None
    monto: Optional[int] = Field(None, gt=0)
    # null borra la descripcion (la columna es nullable).
    descripcion: Optional[str] = Field(None, max_length=250)
    created_at: Optional[datetime] = None
    # null desvincula el movimiento de la deuda.
    id_deuda: Optional[int] = Field(None, ge=1)

    @model_validator(mode="after")
    def validate_no_nulls(self):
        nulos = sorted(
            campo
            for campo in self.model_fields_set
            if campo in CAMPOS_PATCH_NO_NULOS and getattr(self, campo) is None
        )
        if nulos:
            raise ValueError(f"Estos campos no pueden ser nulos: {', '.join(nulos)}.")
        return self

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
