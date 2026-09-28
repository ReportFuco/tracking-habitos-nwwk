"""Salidas compactas de las herramientas MCP.

Las respuestas REST traen campos que al LLM no le sirven (ubicacion, compras vinculadas,
timestamps de creacion) y le gastan contexto; aqui va solo lo necesario para razonar.
"""
from datetime import datetime

from pydantic import BaseModel, Field

from app.models import CategoriaFinanza, CuentaUsuario, Movimiento


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

    @classmethod
    def desde_modelo(cls, categoria: CategoriaFinanza) -> "CategoriaMCP":
        return cls(id_categoria=categoria.id_categoria, nombre=categoria.nombre)


class CategoriasMCP(BaseModel):
    items: list[CategoriaMCP]


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
        )


class MovimientosMCP(BaseModel):
    items: list[MovimientoMCP]
    offset: int
    limit: int
    hay_mas: bool = Field(description="True si existen más resultados: repetir con offset + limit.")
