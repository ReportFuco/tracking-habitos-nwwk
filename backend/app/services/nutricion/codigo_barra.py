"""Producto y tabla nutricional a partir del código de barras.

Primero el catálogo propio (lo que ya está curado y tiene id_producto). Si no está, Open
Food Facts: base abierta con buena cobertura de productos chilenos, que no pide clave
pero sí un User-Agent que identifique a la app.
"""

import re
from decimal import Decimal, InvalidOperation

import httpx
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import settings
from app.models import Producto, TablaNutricional, Usuario
from app.schemas.nutricion.codigo_barra import CodigoBarraResponse
from app.services.catalogo.productos import condicion_visible
from app.services.errores import DatosInvalidos, ErrorDominio, NoEncontrado
from app.services.nutricion.calculo import normalizar_unidad, tabla_vigente

OFF_URL = "https://world.openfoodfacts.org/api/v2/product/{codigo}.json"
OFF_CAMPOS = "product_name,product_name_es,generic_name_es,brands,product_quantity,product_quantity_unit,quantity,nutriments"
OFF_TIMEOUT = httpx.Timeout(6.0, connect=3.0)
USER_AGENT = f"Ritmo/{settings.VERSION_API} (app de habitos)"

_SOLO_DIGITOS = re.compile(r"\D")


class ServicioNoDisponible(ErrorDominio):
    """Open Food Facts no respondió: es transitorio, no que el producto no exista."""


def normalizar_codigo(codigo: str) -> str:
    limpio = _SOLO_DIGITOS.sub("", codigo or "")
    # EAN-8, UPC-A (12), EAN-13 y GTIN-14.
    if not 8 <= len(limpio) <= 14:
        raise DatosInvalidos("El código de barras debe tener entre 8 y 14 dígitos.")
    return limpio


def _decimal(valor) -> Decimal | None:
    if valor is None or valor == "":
        return None
    try:
        numero = Decimal(str(valor))
    except (InvalidOperation, ValueError):
        return None
    return numero.quantize(Decimal("0.01")) if numero >= 0 else None


def desde_open_food_facts(codigo: str, payload: dict) -> CodigoBarraResponse | None:
    """Convierte la respuesta de Open Food Facts; None si no trae el producto o sus kcal."""
    if payload.get("status") != 1:
        return None
    producto = payload.get("product") or {}
    nutr = producto.get("nutriments") or {}
    calorias = _decimal(nutr.get("energy-kcal_100g"))
    if calorias is None and nutr.get("energy_100g") is not None:
        # Solo vino en kJ.
        kj = _decimal(nutr.get("energy_100g"))
        calorias = (kj / Decimal("4.184")).quantize(Decimal("0.01")) if kj is not None else None
    nombre = (
        producto.get("product_name_es") or producto.get("product_name") or producto.get("generic_name_es") or ""
    ).strip()
    if not nombre or calorias is None:
        return None

    unidad_contenido = normalizar_unidad(producto.get("product_quantity_unit")) or None
    # Open Food Facts informa por 100 g, o por 100 ml en los líquidos.
    porcion_unidad = "ml" if unidad_contenido in ("ml", "l") else "g"
    marcas = (producto.get("brands") or "").split(",")
    return CodigoBarraResponse(
        origen="openfoodfacts",
        codigo=codigo,
        id_producto=None,
        nombre=nombre[:160],
        marca=marcas[0].strip() or None,
        porcion_cantidad=Decimal("100"),
        porcion_unidad=porcion_unidad,
        contenido_neto=_decimal(producto.get("product_quantity")),
        unidad_contenido=unidad_contenido,
        calorias=calorias,
        proteinas=_decimal(nutr.get("proteins_100g")),
        carbohidratos=_decimal(nutr.get("carbohydrates_100g")),
        grasas=_decimal(nutr.get("fat_100g")),
        fuente_nutricional="openfoodfacts",
    )


async def consultar_open_food_facts(codigo: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=OFF_TIMEOUT, headers={"User-Agent": USER_AGENT}) as cliente:
            respuesta = await cliente.get(OFF_URL.format(codigo=codigo), params={"fields": OFF_CAMPOS})
    except httpx.HTTPError as exc:
        logger.warning("Open Food Facts no respondio para {}: {}", codigo, exc)
        raise ServicioNoDisponible("No pudimos consultar la base de alimentos. Intenta de nuevo.") from exc
    if respuesta.status_code == 404:
        return None
    if respuesta.status_code >= 400:
        logger.warning("Open Food Facts respondio {} para {}", respuesta.status_code, codigo)
        raise ServicioNoDisponible("No pudimos consultar la base de alimentos. Intenta de nuevo.")
    return respuesta.json()


def extras_open_food_facts(payload: dict) -> dict[str, Decimal | None]:
    """Azúcares y fibra en g, y sodio en mg (como en las etiquetas chilenas) por 100 g/ml.
    Open Food Facts informa el sodio en gramos."""
    nutr = (payload.get("product") or {}).get("nutriments") or {}
    sodio_g = _decimal(nutr.get("sodium_100g"))
    return {
        "azucares": _decimal(nutr.get("sugars_100g")),
        "fibra": _decimal(nutr.get("fiber_100g")),
        "sodio": (sodio_g * 1000).quantize(Decimal("0.01")) if sodio_g is not None else None,
    }


async def _producto_por_codigo(db: AsyncSession, usuario: Usuario, codigo: str) -> Producto | None:
    return await db.scalar(
        select(Producto)
        .where(Producto.codigo_barra == codigo, Producto.activo.is_(True), condicion_visible(usuario))
        .options(selectinload(Producto.marca))
        # Si hay uno aprobado y una propuesta pendiente con el mismo código, el aprobado.
        .order_by((Producto.estado == "aprobado").desc(), Producto.id_producto)
        .limit(1)
    )


async def guardar_tabla_desde_codigo(db: AsyncSession, usuario: Usuario, codigo: str) -> CodigoBarraResponse:
    """Guarda como tabla nutricional del producto la de Open Food Facts (solo administradores).

    Si el producto ya tiene una tabla con calorías no se toca: es idempotente y no pisa una
    tabla que alguien cargó a mano. Si al producto le falta el contenido neto, también se
    completa, para poder anotar "1 unidad".
    """
    codigo = normalizar_codigo(codigo)
    producto = await _producto_por_codigo(db, usuario, codigo)
    if producto is None:
        raise NoEncontrado("Ese código no está en el catálogo.")
    tabla = await tabla_vigente(db, producto.id_producto)
    if tabla is None or tabla.calorias is None:
        payload = await consultar_open_food_facts(codigo)
        datos = desde_open_food_facts(codigo, payload) if payload else None
        if datos is None:
            raise NoEncontrado("Open Food Facts no tiene las calorías de ese producto.")
        db.add(
            TablaNutricional(
                id_producto=producto.id_producto,
                porcion_cantidad=datos.porcion_cantidad,
                porcion_unidad=datos.porcion_unidad,
                calorias=datos.calorias,
                proteinas=datos.proteinas,
                carbohidratos=datos.carbohidratos,
                grasas=datos.grasas,
                **extras_open_food_facts(payload),
            )
        )
        if producto.contenido_neto is None and datos.contenido_neto is not None:
            producto.contenido_neto = datos.contenido_neto
            producto.unidad_contenido = datos.unidad_contenido
        await db.flush()
        logger.info("Tabla de Open Food Facts guardada para el producto {} ({})", producto.id_producto, codigo)
    return await buscar_por_codigo(db, usuario, codigo)


async def buscar_por_codigo(db: AsyncSession, usuario: Usuario, codigo: str) -> CodigoBarraResponse:
    codigo = normalizar_codigo(codigo)
    producto = await _producto_por_codigo(db, usuario, codigo)
    if producto is not None:
        tabla = await tabla_vigente(db, producto.id_producto)
        if tabla is not None and tabla.calorias is not None:
            return CodigoBarraResponse(
                origen="catalogo",
                codigo=codigo,
                id_producto=producto.id_producto,
                nombre=producto.nombre_producto,
                marca=producto.nombre_marca,
                porcion_cantidad=tabla.porcion_cantidad,
                porcion_unidad=tabla.porcion_unidad,
                contenido_neto=producto.contenido_neto,
                unidad_contenido=producto.unidad_contenido,
                calorias=tabla.calorias,
                proteinas=tabla.proteinas,
                carbohidratos=tabla.carbohidratos,
                grasas=tabla.grasas,
                fuente_nutricional="tabla",
            )
        # En el catálogo pero sin tabla: el producto se mantiene (nombre, contenido neto) y
        # las calorías se completan con Open Food Facts si las tiene.
        externo = await _open_food_facts_o_nada(codigo)
        return CodigoBarraResponse(
            origen="catalogo",
            codigo=codigo,
            id_producto=producto.id_producto,
            nombre=producto.nombre_producto,
            marca=producto.nombre_marca,
            porcion_cantidad=externo.porcion_cantidad if externo else None,
            porcion_unidad=externo.porcion_unidad if externo else None,
            contenido_neto=producto.contenido_neto or (externo.contenido_neto if externo else None),
            unidad_contenido=producto.unidad_contenido or (externo.unidad_contenido if externo else None),
            calorias=externo.calorias if externo else None,
            proteinas=externo.proteinas if externo else None,
            carbohidratos=externo.carbohidratos if externo else None,
            grasas=externo.grasas if externo else None,
            fuente_nutricional="openfoodfacts" if externo else None,
        )

    payload = await consultar_open_food_facts(codigo)
    resultado = desde_open_food_facts(codigo, payload) if payload else None
    if resultado is None:
        raise NoEncontrado("No encontramos ese código. Anótalo como otro alimento con sus calorías.")
    return resultado


async def _open_food_facts_o_nada(codigo: str) -> CodigoBarraResponse | None:
    """Para completar un producto que ya se encontró: si la consulta falla, se sigue sin calorías."""
    try:
        payload = await consultar_open_food_facts(codigo)
    except ServicioNoDisponible:
        return None
    return desde_open_food_facts(codigo, payload) if payload else None
