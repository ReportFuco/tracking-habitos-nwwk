"""Comidas del usuario: registrar con sus alimentos, resumen del día y tendencia.

Lo usan la API REST (rutas de consumo) y el servidor MCP, para que una comida anotada
desde Claude quede igual que una anotada en la app.
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Consumo, ConsumoDetalle, MetaNutricional, TablaNutricional, Usuario
from app.schemas.nutricion import ConsumoCreate, ConsumoResponse
from app.schemas.nutricion.resumen import AlimentoCatalogo, DiaNutricion, MetaDia
from app.services.catalogo.productos import buscar_productos
from app.services.errores import NoEncontrado
from app.services.nutricion.calculo import NUTRIENTES, calcular_nutrientes, obtener_producto

CON_DETALLES = selectinload(Consumo.detalles).selectinload(ConsumoDetalle.producto)


async def obtener_comida(db: AsyncSession, id_usuario: int, id_consumo: int) -> Consumo:
    consumo = await db.scalar(
        select(Consumo)
        .where(Consumo.id_consumo == id_consumo, Consumo.id_usuario == id_usuario)
        .options(CON_DETALLES)
        .execution_options(populate_existing=True)
    )
    if not consumo:
        raise NoEncontrado("Comida no encontrada")
    return consumo


async def crear_comida(db: AsyncSession, id_usuario: int, data: ConsumoCreate) -> Consumo:
    consumo = Consumo(id_usuario=id_usuario, **data.model_dump(exclude={"detalles"}))
    db.add(consumo)
    await db.flush()
    for item in data.detalles:
        if item.id_producto is not None:
            await obtener_producto(db, item.id_producto)
        valores = item.model_dump()
        explicitos = {campo: valores.pop(campo) for campo in NUTRIENTES}
        detalle = ConsumoDetalle(id_consumo=consumo.id_consumo, **valores)
        await calcular_nutrientes(detalle, db, explicitos)
        db.add(detalle)
    await db.flush()
    return await obtener_comida(db, id_usuario, consumo.id_consumo)


async def eliminar_comida(db: AsyncSession, id_usuario: int, id_consumo: int) -> None:
    await db.delete(await obtener_comida(db, id_usuario, id_consumo))
    await db.flush()


async def comidas_entre(db: AsyncSession, id_usuario: int, desde: date, hasta: date) -> list[Consumo]:
    """Comidas de ``desde`` a ``hasta`` inclusive (fecha_consumo es hora local de Chile)."""
    resultado = await db.execute(
        select(Consumo)
        .where(
            Consumo.id_usuario == id_usuario,
            Consumo.fecha_consumo >= datetime.combine(desde, time.min),
            Consumo.fecha_consumo < datetime.combine(hasta + timedelta(days=1), time.min),
        )
        .options(CON_DETALLES)
        .order_by(Consumo.fecha_consumo)
    )
    return list(resultado.scalars().all())


async def metas_entre(db: AsyncSession, id_usuario: int, desde: date, hasta: date) -> list[MetaNutricional]:
    resultado = await db.execute(
        select(MetaNutricional)
        .where(
            MetaNutricional.id_usuario == id_usuario,
            MetaNutricional.fecha_inicio <= hasta,
            (MetaNutricional.fecha_fin.is_(None)) | (MetaNutricional.fecha_fin >= desde),
        )
        # La más reciente primero: si dos metas se pisan, manda la última creada.
        .order_by(MetaNutricional.fecha_inicio.desc(), MetaNutricional.id_meta.desc())
    )
    return list(resultado.scalars().all())


def _meta_del_dia(metas: list[MetaNutricional], dia: date) -> MetaDia | None:
    for meta in metas:
        if meta.fecha_inicio <= dia and (meta.fecha_fin is None or dia <= meta.fecha_fin):
            return MetaDia.model_validate(meta, from_attributes=True)
    return None


def _resumir(dia: date, comidas: list[Consumo], meta: MetaDia | None, *, con_comidas: bool) -> DiaNutricion:
    totales = {campo: Decimal("0") for campo in NUTRIENTES}
    sin_calorias = 0
    for comida in comidas:
        for detalle in comida.detalles:
            if detalle.calorias is None:
                sin_calorias += 1
            for campo in NUTRIENTES:
                totales[campo] += getattr(detalle, campo) or Decimal("0")
    return DiaNutricion(
        fecha=dia,
        cantidad_comidas=len(comidas),
        lineas_sin_calorias=sin_calorias,
        meta=meta,
        calorias_restantes=(
            Decimal(meta.calorias_objetivo) - totales["calorias"]
            if meta is not None and meta.calorias_objetivo is not None
            else None
        ),
        comidas=[ConsumoResponse.model_validate(c) for c in comidas] if con_comidas else [],
        **totales,
    )


async def resumen_dia(db: AsyncSession, id_usuario: int, dia: date) -> DiaNutricion:
    comidas = await comidas_entre(db, id_usuario, dia, dia)
    metas = await metas_entre(db, id_usuario, dia, dia)
    return _resumir(dia, comidas, _meta_del_dia(metas, dia), con_comidas=True)


async def tendencia(db: AsyncSession, id_usuario: int, hasta: date, dias: int) -> list[DiaNutricion]:
    desde = hasta - timedelta(days=dias - 1)
    comidas = await comidas_entre(db, id_usuario, desde, hasta)
    metas = await metas_entre(db, id_usuario, desde, hasta)
    por_dia: dict[date, list[Consumo]] = {}
    for comida in comidas:
        por_dia.setdefault(comida.fecha_consumo.date(), []).append(comida)
    return [
        _resumir(d, por_dia.get(d, []), _meta_del_dia(metas, d), con_comidas=False)
        for d in (desde + timedelta(days=i) for i in range(dias))
    ]


async def buscar_alimentos(db: AsyncSession, usuario: Usuario, texto: str, limite: int) -> list[AlimentoCatalogo]:
    """Productos del catálogo visibles para el usuario, con su tabla nutricional vigente.

    Los que tienen tabla van primero: con ellos las calorías se calculan solas al anotar.
    """
    productos = await buscar_productos(db, usuario, q=texto, limit=limite)
    if not productos:
        return []
    ids = [p.id_producto for p in productos]
    tablas = (
        await db.execute(
            select(TablaNutricional)
            .where(TablaNutricional.id_producto.in_(ids))
            .order_by(TablaNutricional.id_producto, TablaNutricional.id_tabla.desc())
            .distinct(TablaNutricional.id_producto)
        )
    ).scalars().all()
    por_producto = {t.id_producto: t for t in tablas}
    alimentos = []
    for producto in productos:
        tabla = por_producto.get(producto.id_producto)
        alimentos.append(
            AlimentoCatalogo(
                id_producto=producto.id_producto,
                nombre=producto.nombre_producto,
                marca=producto.nombre_marca,
                codigo_barra=producto.codigo_barra,
                contenido_neto=producto.contenido_neto,
                unidad_contenido=producto.unidad_contenido,
                porcion_cantidad=tabla.porcion_cantidad if tabla else None,
                porcion_unidad=tabla.porcion_unidad if tabla else None,
                calorias_por_porcion=tabla.calorias if tabla else None,
                tiene_tabla=tabla is not None and tabla.calorias is not None,
            )
        )
    # sorted es estable: dentro de cada grupo se mantiene el orden por relevancia.
    return sorted(alimentos, key=lambda a: not a.tiene_tabla)
