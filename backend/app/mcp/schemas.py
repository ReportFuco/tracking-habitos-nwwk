"""Salidas compactas de las herramientas MCP.

Las respuestas REST traen campos que al LLM no le sirven (ubicacion, timestamps de
creacion) y le gastan contexto; aqui va solo lo necesario para razonar.
"""
from datetime import datetime

from pydantic import BaseModel, Field

from app.models import CategoriaFinanza, CuentaUsuario, Movimiento, MovimientoItem, Producto


class CuentaMCP(BaseModel):
    id_cuenta: int
    nombre_cuenta: str
    producto: str | None = None
    banco: str | None = None

    @classmethod
    def desde_modelo(cls, cuenta: CuentaUsuario) -> "CuentaMCP":
        producto = cuenta.producto_financiero
        return cls(
            id_cuenta=cuenta.id_cuenta,
            nombre_cuenta=cuenta.nombre_cuenta,
            producto=producto.nombre_producto if producto else None,
            banco=producto.banco.nombre_banco if producto and producto.banco else None,
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
    fecha: datetime = Field(description="Fecha y hora en calendario de Chile (sin zona horaria).")
    tipo_movimiento: str = Field(description="'gasto' o 'ingreso'.")
    tipo_gasto: str = Field(description="'fijo' o 'variable'.")
    monto: int = Field(description="Monto en CLP, entero y siempre positivo.")
    categoria: str | None = None
    id_categoria: int
    cuenta: str | None = None
    id_cuenta: int
    descripcion: str | None = None
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
            tipo_movimiento=movimiento.tipo_movimiento.value,
            tipo_gasto=movimiento.tipo_gasto.value,
            monto=movimiento.monto,
            categoria=movimiento.categoria.nombre if movimiento.categoria else None,
            id_categoria=movimiento.id_categoria,
            cuenta=movimiento.cuenta.nombre_cuenta if movimiento.cuenta else None,
            id_cuenta=movimiento.id_cuenta,
            descripcion=movimiento.descripcion,
            id_deuda=movimiento.id_deuda,
            deuda=movimiento.deuda.nombre if movimiento.deuda else None,
            productos=[ItemMCP.desde_modelo(item) for item in movimiento.items],
        )


class MovimientosMCP(BaseModel):
    items: list[MovimientoMCP]
    offset: int
    limit: int
    hay_mas: bool = Field(description="True si existen más resultados: repetir con offset + limit.")


class MovimientoEliminadoMCP(BaseModel):
    id_movimiento: int
    eliminado: bool = True


class DeudaEliminadaMCP(BaseModel):
    id_deuda: int
    eliminada: bool = True


class ImportacionDeshechaMCP(BaseModel):
    id_importacion: int
    movimientos_eliminados: int
