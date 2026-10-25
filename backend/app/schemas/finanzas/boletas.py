"""Detalle de una boleta completa en un gasto (solo MCP: el modelo lee la foto)."""
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


MAX_LINEAS_BOLETA = 150


def _texto(valor: str | None) -> str | None:
    if valor is None:
        return None
    limpio = " ".join(valor.split())
    return limpio or None


class ProductoNuevoBoleta(BaseModel):
    nombre: str = Field(
        ...,
        min_length=1,
        max_length=160,
        description="Nombre legible y sin abreviar, sin la marca: 'Leche entera', no 'LECHE ENT'.",
    )
    marca: Optional[str] = Field(None, max_length=120, examples=["Colun"])
    categoria: Optional[str] = Field(
        None,
        max_length=100,
        examples=["Lácteos"],
        description="Tipo de producto: Lácteos, Carnes, Frutas y verduras, Snacks, Bebidas, Aseo...",
    )
    contenido_neto: Optional[Decimal] = Field(None, gt=0, examples=[1])
    unidad_contenido: Optional[str] = Field(None, max_length=30, examples=["L"], description="g, kg, ml, L, unidades...")
    formato: Optional[str] = Field(None, max_length=100, examples=["Caja"])
    sabor: Optional[str] = Field(None, max_length=100)
    codigo_barra: Optional[str] = Field(None, max_length=64, description="EAN, si la boleta lo trae.")

    _textos = field_validator(
        "nombre", "marca", "categoria", "unidad_contenido", "formato", "sabor", "codigo_barra"
    )(_texto)

    @field_validator("nombre")
    @classmethod
    def nombre_no_vacio(cls, valor: str | None) -> str:
        if not valor:
            raise ValueError("El nombre del producto no puede estar vacío.")
        return valor


class LineaBoleta(BaseModel):
    texto: str = Field(
        ...,
        min_length=1,
        max_length=120,
        examples=["LECHE ENT COLUN 1L"],
        description="Texto de la línea tal como sale impreso, sin corregir: así se reconoce en la próxima boleta.",
    )
    codigo: Optional[str] = Field(None, max_length=64, description="Código impreso en la línea (EAN o interno).")
    cantidad: Decimal = Field(
        Decimal("1"),
        gt=0,
        le=100000,
        decimal_places=3,
        description="Unidades, o kilos a granel (ej. 0.756).",
    )
    precio_total: int = Field(..., ge=0, description="CLP pagados por la línea, ya restado su descuento.")
    descuento: int = Field(0, ge=0, description="Oferta o descuento de la línea en CLP.")
    id_producto: Optional[int] = Field(
        None,
        ge=1,
        description="Producto del catálogo, si ya sabes cuál es (ver buscar_productos).",
    )
    producto_nuevo: Optional[ProductoNuevoBoleta] = Field(
        None,
        description=(
            "Datos para crear el producto si no está en el catálogo. Si ya existe uno igual (o la "
            "línea se reconoce de una boleta anterior) se usa ese y no se crea otro."
        ),
    )

    _textos = field_validator("texto", "codigo")(_texto)

    @model_validator(mode="after")
    def un_producto(self):
        if not self.texto:
            raise ValueError("El texto de la línea no puede estar vacío.")
        if self.id_producto is not None and self.producto_nuevo is not None:
            raise ValueError("Usa id_producto o producto_nuevo, no ambos.")
        return self

    model_config = ConfigDict(title="Línea de boleta")


EstadoLinea = Literal["elegido", "reconocido", "nuevo", "sin_producto", "invalida"]


class SugerenciaProducto(BaseModel):
    id_producto: int
    producto: str


class LineaBoletaRevisada(BaseModel):
    indice: int = Field(description="Posición de la línea en la lista enviada, desde 0.")
    texto: str
    estado: EstadoLinea = Field(
        description=(
            "'elegido': id_producto enviado. 'reconocido': calzó con una boleta anterior, el código "
            "de barra o un producto igual ya existente. 'nuevo': se creará en el catálogo. "
            "'sin_producto': falta decir qué producto es. 'invalida': ver error."
        ),
    )
    id_producto: Optional[int] = None
    producto: Optional[str] = Field(None, description="Nombre (marca) del producto que quedará en el gasto.")
    cantidad: float
    precio_total: int
    descuento: int = 0
    error: Optional[str] = None
    sugerencias: list[SugerenciaProducto] = Field(
        default_factory=list,
        description="Productos del catálogo parecidos al texto, para las líneas sin_producto.",
    )


class RevisionBoleta(BaseModel):
    aplicado: bool = Field(description="True si se guardó; false si es solo la vista previa.")
    id_movimiento: int
    comercio: Optional[str] = None
    monto_gasto: int
    total_lineas: int = Field(description="Suma de precio_total de las líneas.")
    diferencia: int = Field(
        description=(
            "monto_gasto - total_lineas. Distinta de 0 por descuentos al total de la boleta, "
            "redondeo, bolsas o líneas que faltan: revísala con el usuario si es grande."
        ),
    )
    descuentos: int = Field(description="Suma de los descuentos de las líneas.")
    productos_nuevos: int = Field(description="Productos que se crean en el catálogo.")
    detalle_previo: int = Field(description="Productos que el gasto ya tenía detallados.")
    lineas: list[LineaBoletaRevisada]
