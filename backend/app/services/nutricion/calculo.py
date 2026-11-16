"""Calorías y macros de una línea de consumo a partir de la tabla nutricional."""

from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import ConsumoDetalle, Producto, TablaNutricional
from app.services.errores import NoEncontrado

NUTRIENTES = ("calorias", "proteinas", "carbohidratos", "grasas")
CENTESIMA = Decimal("0.01")

_SINONIMOS_UNIDAD = {
    "gr": "g",
    "grs": "g",
    "gramo": "g",
    "gramos": "g",
    "kilo": "kg",
    "kilos": "kg",
    "cc": "ml",
    "mililitro": "ml",
    "mililitros": "ml",
    "lt": "l",
    "litro": "l",
    "litros": "l",
    "porción": "porcion",
    "porciones": "porcion",
    "unidades": "unidad",
    "un": "unidad",
}

# Unidad mayor -> (unidad base, factor). Permite anotar "0.25 kg" contra una tabla por 100 g.
_A_BASE = {"kg": ("g", Decimal("1000")), "l": ("ml", Decimal("1000"))}


def normalizar_unidad(unidad: str | None) -> str:
    u = (unidad or "").strip().lower().rstrip(".")
    return _SINONIMOS_UNIDAD.get(u, u)


def _a_base(cantidad: Decimal, unidad: str) -> tuple[Decimal, str]:
    if unidad in _A_BASE:
        base, factor = _A_BASE[unidad]
        return cantidad * factor, base
    return cantidad, unidad


def _misma_magnitud(a: str, b: str) -> bool:
    """g y ml se toman como equivalentes (densidad ~1): las etiquetas y Open Food Facts
    informan muchas bebidas y lácteos por 100 g aunque se tomen en ml, y al revés."""
    return a == b or {a, b} == {"g", "ml"}


def factor_porcion(
    cantidad: Decimal, unidad: str, tabla: TablaNutricional, producto: Producto | None
) -> Decimal | None:
    """Cuántas porciones de la tabla representa lo consumido, o None si no se puede saber.

    - "porcion": la cantidad ya son porciones de la tabla.
    - misma unidad que la porción (g, ml, unidad...): cantidad / porción.
    - "unidad" contra una tabla en g/ml: usa el contenido neto del producto (1 yogur de
      125 g contra una tabla por 100 g = 1.25 porciones).
    """
    u = normalizar_unidad(unidad)
    if u == "porcion":
        return cantidad

    porcion = tabla.porcion_cantidad
    if not porcion or porcion <= 0:
        return None
    cant_base, u_base = _a_base(cantidad, u)
    porcion_base, pu_base = _a_base(porcion, normalizar_unidad(tabla.porcion_unidad))

    if _misma_magnitud(u_base, pu_base):
        return cant_base / porcion_base

    if u == "unidad" and producto is not None and producto.contenido_neto:
        contenido_base, cu_base = _a_base(
            producto.contenido_neto, normalizar_unidad(producto.unidad_contenido)
        )
        if _misma_magnitud(cu_base, pu_base):
            return cantidad * contenido_base / porcion_base
    return None


def nutrientes_de_tabla(
    cantidad: Decimal, unidad: str, tabla: TablaNutricional, producto: Producto | None
) -> dict[str, Decimal | None] | None:
    factor = factor_porcion(cantidad, unidad, tabla, producto)
    if factor is None:
        return None
    resultado: dict[str, Decimal | None] = {}
    for campo in NUTRIENTES:
        valor = getattr(tabla, campo)
        resultado[campo] = None if valor is None else (valor * factor).quantize(CENTESIMA, ROUND_HALF_UP)
    return resultado


async def tabla_vigente(db: AsyncSession, id_producto: int) -> TablaNutricional | None:
    """La tabla más reciente del producto (un producto puede tener varias versiones)."""
    return await db.scalar(
        select(TablaNutricional)
        .where(TablaNutricional.id_producto == id_producto)
        .order_by(TablaNutricional.id_tabla.desc())
        .limit(1)
    )


async def obtener_producto(db: AsyncSession, id_producto: int) -> Producto:
    producto = await db.scalar(
        select(Producto).where(Producto.id_producto == id_producto).options(selectinload(Producto.marca))
    )
    if not producto:
        raise NoEncontrado(f"Producto {id_producto} no encontrado")
    return producto


async def calcular_nutrientes(detalle: ConsumoDetalle, db: AsyncSession, explicitos: dict) -> None:
    """Rellena las calorías y macros de ``detalle``.

    Los valores que vienen explícitos (escritos a mano o estimados) mandan. Si no vienen y
    la línea es un producto con tabla, se calculan con ella; si no se puede, quedan vacíos.
    """
    calculados: dict[str, Decimal | None] | None = None
    if detalle.id_producto is not None and any(explicitos.get(c) is None for c in NUTRIENTES):
        tabla = await tabla_vigente(db, detalle.id_producto)
        if tabla is not None:
            producto = await db.get(Producto, detalle.id_producto)
            calculados = nutrientes_de_tabla(
                Decimal(detalle.cantidad_consumida), detalle.unidad_consumida, tabla, producto
            )
    for campo in NUTRIENTES:
        valor = explicitos.get(campo)
        if valor is None and calculados is not None:
            valor = calculados[campo]
        setattr(detalle, campo, valor)
