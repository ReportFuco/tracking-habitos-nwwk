"""Salidas compactas de las herramientas MCP.

Las respuestas REST traen campos que al LLM no le sirven (ubicacion, timestamps de
creacion) y le gastan contexto; aqui va solo lo necesario para razonar.
"""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models import CategoriaFinanza, CuentaUsuario, Movimiento, MovimientoItem, Producto


class CuentaMCP(BaseModel):
    id_cuenta: int
    nombre_cuenta: str
    producto: str | None = None
    banco: str | None = None
    saldo_inicial: int | None = Field(None, description="Saldo en CLP al cierre de fecha_saldo_inicial.")
    fecha_saldo_inicial: date | None = None
    saldo_actual: int = Field(
        description=(
            "Saldo inicial más todos los movimientos posteriores, por fecha contable. En una "
            "tarjeta de crédito queda negativo: su valor absoluto es lo que se debe."
        ),
    )

    @classmethod
    def desde_modelo(cls, cuenta: CuentaUsuario, saldo_actual: int) -> "CuentaMCP":
        producto = cuenta.producto_financiero
        return cls(
            id_cuenta=cuenta.id_cuenta,
            nombre_cuenta=cuenta.nombre_cuenta,
            producto=producto.nombre_producto if producto else None,
            banco=producto.banco.nombre_banco if producto and producto.banco else None,
            saldo_inicial=cuenta.saldo_inicial,
            fecha_saldo_inicial=cuenta.fecha_saldo_inicial,
            saldo_actual=saldo_actual,
        )


class CuentasMCP(BaseModel):
    items: list[CuentaMCP]


class CategoriaMCP(BaseModel):
    id_categoria: int
    nombre: str
    es_propia: bool = Field(description="True si la creó el usuario; false si es por defecto.")

    @classmethod
    def desde_modelo(cls, categoria: CategoriaFinanza) -> "CategoriaMCP":
        return cls(
            id_categoria=categoria.id_categoria,
            nombre=categoria.nombre,
            es_propia=categoria.es_propia,
        )


class CategoriasMCP(BaseModel):
    items: list[CategoriaMCP]


class ProductoMCP(BaseModel):
    id_producto: int
    nombre: str
    marca: str | None = None
    contenido: str | None = Field(None, description="Contenido neto y formato, ej. '1 L · Botella'.")
    estado: str = Field(description="'aprobado', o 'pendiente'/'rechazado' si lo propuso el usuario.")

    @classmethod
    def desde_modelo(cls, producto: Producto) -> "ProductoMCP":
        contenido = None
        if producto.contenido_neto is not None:
            contenido = f"{producto.contenido_neto.normalize():f} {producto.unidad_contenido or ''}".strip()
        detalle = " · ".join(parte for parte in (contenido, producto.formato, producto.sabor) if parte)
        return cls(
            id_producto=producto.id_producto,
            nombre=producto.nombre_producto,
            marca=producto.nombre_marca,
            contenido=detalle or None,
            estado=producto.estado,
        )


class ProductosMCP(BaseModel):
    items: list[ProductoMCP]


class ItemMCP(BaseModel):
    id_item: int
    id_producto: int
    producto: str
    cantidad: float
    precio_total: int | None = Field(None, description="CLP pagados por la línea completa.")

    @classmethod
    def desde_modelo(cls, item: MovimientoItem) -> "ItemMCP":
        marca = item.producto.nombre_marca
        nombre = item.producto.nombre_producto
        return cls(
            id_item=item.id_item,
            id_producto=item.id_producto,
            producto=f"{nombre} ({marca})" if marca else nombre,
            cantidad=float(item.cantidad),
            precio_total=item.precio_total,
        )


class MovimientoMCP(BaseModel):
    id_movimiento: int
    fecha: datetime = Field(description="Fecha y hora de la operación, en hora de Chile.")
    hora_conocida: bool = Field(description="False si solo se conoce el día (la hora de fecha no es real).")
    fecha_contable: date | None = Field(
        None,
        description="Día en que el banco lo registró, según la cartola. El saldo se calcula con esta fecha.",
    )
    estado: Literal["pendiente", "conciliado"] = Field(
        description="'conciliado' si ya calzó con una fila de cartola (tiene fecha_contable).",
    )
    origen: Literal["manual", "importado"]
    id_importacion: int | None = None
    tipo_movimiento: str = Field(description="'gasto' o 'ingreso'.")
    tipo_gasto: str = Field(description="'fijo' o 'variable'.")
    monto: int = Field(description="Monto en CLP, entero y siempre positivo.")
    categoria: str | None = None
    id_categoria: int
    cuenta: str | None = None
    id_cuenta: int
    descripcion: str | None = None
    descripcion_original: str | None = Field(None, description="Glosa de la cartola con la que calzó.")
    id_transferencia: str | None = Field(
        None,
        description="Si es una transferencia entre cuentas propias: une este movimiento con su espejo.",
    )
    id_deuda: int | None = Field(None, description="Deuda que abona este movimiento.")
    deuda: str | None = None
    productos: list[ItemMCP] = Field(
        default_factory=list,
        description="Productos detallados del gasto; puede cubrir solo parte del monto.",
    )

    @classmethod
    def desde_modelo(cls, movimiento: Movimiento) -> "MovimientoMCP":
        return cls(
            id_movimiento=movimiento.id_transaccion,
            fecha=movimiento.created_at,
            hora_conocida=movimiento.hora_conocida,
            fecha_contable=movimiento.fecha_contable,
            estado="conciliado" if movimiento.fecha_contable else "pendiente",
            origen="importado" if movimiento.id_importacion else "manual",
            id_importacion=movimiento.id_importacion,
            tipo_movimiento=movimiento.tipo_movimiento.value,
            tipo_gasto=movimiento.tipo_gasto.value,
            monto=movimiento.monto,
            categoria=movimiento.categoria.nombre if movimiento.categoria else None,
            id_categoria=movimiento.id_categoria,
            cuenta=movimiento.cuenta.nombre_cuenta if movimiento.cuenta else None,
            id_cuenta=movimiento.id_cuenta,
            descripcion=movimiento.descripcion,
            descripcion_original=movimiento.descripcion_original,
            id_transferencia=str(movimiento.id_transferencia) if movimiento.id_transferencia else None,
            id_deuda=movimiento.id_deuda,
            deuda=movimiento.deuda.nombre if movimiento.deuda else None,
            productos=[ItemMCP.desde_modelo(item) for item in movimiento.items],
        )


class MovimientosMCP(BaseModel):
    items: list[MovimientoMCP]
    total: int = Field(description="Movimientos que cumplen los filtros, en todas las páginas.")
    offset: int
    limit: int
    hay_mas: bool = Field(description="True si existen más resultados: repetir con offset + limit.")


class MovimientoEliminadoMCP(BaseModel):
    id_movimiento: int
    eliminado: bool = True
    id_espejo_eliminado: int | None = Field(
        None,
        description="Si era una transferencia, el movimiento espejo de la otra cuenta, que también se eliminó.",
    )


class SaldoCuentaMCP(BaseModel):
    id_cuenta: int
    cuenta: str
    al: date | None = Field(description="Saldo al cierre de este día. Null: con todos los movimientos.")
    saldo: int = Field(description="CLP. En una tarjeta de crédito, negativo = deuda.")
    saldo_inicial: int | None = None
    fecha_saldo_inicial: date | None = None
    ingresos: int = Field(description="Suma de ingresos considerados (desde fecha_saldo_inicial, excluida).")
    gastos: int = Field(description="Suma de gastos considerados.")
    cantidad_movimientos: int
    pendientes: int = Field(
        description=(
            "Movimientos considerados que aún no calzan con la cartola (sin fecha contable): "
            "el saldo usa su fecha de operación y pueden explicar una diferencia con el banco."
        ),
    )


class TransferenciaMCP(BaseModel):
    id_transferencia: str
    origen: MovimientoMCP = Field(description="Gasto en la cuenta de origen.")
    destino: MovimientoMCP = Field(description="Ingreso en la cuenta de destino.")


class DeudaEliminadaMCP(BaseModel):
    id_deuda: int
    eliminada: bool = True


class ImportacionDeshechaMCP(BaseModel):
    id_importacion: int
    movimientos_eliminados: int
    conciliaciones_revertidas: int = Field(
        description="Movimientos registrados a mano que vuelven a quedar pendientes de conciliar.",
    )
