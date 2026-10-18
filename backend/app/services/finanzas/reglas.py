"""Reglas de categoría: un patrón en la descripción decide la categoría del movimiento.

Se aplican al registrar un gasto sin categoría o como «Otros» (el Atajo de Wallet manda
«Otros» con el nombre del comercio), a las filas de cartola sin categoría y, a pedido, a
movimientos ya registrados (:func:`aplicar_reglas`, primero en modo vista previa).
"""
import unicodedata
from collections.abc import Iterable
from datetime import datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import CategoriaFinanza, CuentaUsuario, Movimiento, ReglaCategoria, Usuario
from app.schemas.finanzas import (
    AplicarReglasRequest,
    AplicarReglasResponse,
    CambioReglas,
    ReglaCategoriaCreate,
    ReglaCategoriaResponse,
)
from app.services.errores import Conflicto, NoEncontrado
from app.services.finanzas.categorias import obtener_categoria


NOMBRE_OTROS = "otros"
MAX_EJEMPLOS = 3


def normalizar_texto(texto: str) -> str:
    """Minúsculas, sin tildes y con espacios simples, para comparar glosas."""
    sin_tildes = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return " ".join(sin_tildes.lower().split())


def elegir_categoria(reglas: Iterable[tuple[str, int]], *textos: str | None) -> int | None:
    """Categoría de la regla cuyo patrón aparece en algún texto; gana el más largo."""
    normalizados = [normalizar_texto(texto) for texto in textos if texto]
    if not normalizados:
        return None
    mejor: tuple[int, int] | None = None
    for patron, id_categoria in reglas:
        clave = normalizar_texto(patron)
        if any(clave in texto for texto in normalizados) and (mejor is None or len(clave) > mejor[0]):
            mejor = (len(clave), id_categoria)
    return mejor[1] if mejor else None


async def reglas_activas(db: AsyncSession, usuario: Usuario) -> list[tuple[str, int]]:
    filas = await db.execute(
        select(ReglaCategoria.patron, ReglaCategoria.id_categoria)
        .join(CategoriaFinanza, CategoriaFinanza.id_categoria == ReglaCategoria.id_categoria)
        .where(ReglaCategoria.id_usuario == usuario.id_usuario, CategoriaFinanza.activo.is_(True))
    )
    return [(patron, id_categoria) for patron, id_categoria in filas.all()]


async def categoria_otros(db: AsyncSession) -> int | None:
    """La categoría por defecto «Otros»: destino de lo que ninguna regla reconoce."""
    return await db.scalar(
        select(CategoriaFinanza.id_categoria).where(
            CategoriaFinanza.id_usuario.is_(None),
            func.lower(CategoriaFinanza.nombre) == NOMBRE_OTROS,
        )
    )


async def categoria_automatica(db: AsyncSession, usuario: Usuario, *textos: str | None) -> int | None:
    return elegir_categoria(await reglas_activas(db, usuario), *textos)


def _respuesta(regla: ReglaCategoria) -> ReglaCategoriaResponse:
    return ReglaCategoriaResponse(
        id_regla=regla.id_regla,
        patron=regla.patron,
        id_categoria=regla.id_categoria,
        categoria=regla.categoria.nombre,
        created_at=regla.created_at,
    )


async def listar_reglas(db: AsyncSession, usuario: Usuario) -> list[ReglaCategoriaResponse]:
    reglas = (
        await db.scalars(
            select(ReglaCategoria)
            .where(ReglaCategoria.id_usuario == usuario.id_usuario)
            .options(selectinload(ReglaCategoria.categoria))
            .join(CategoriaFinanza, CategoriaFinanza.id_categoria == ReglaCategoria.id_categoria)
            .order_by(func.lower(CategoriaFinanza.nombre), func.lower(ReglaCategoria.patron))
        )
    ).all()
    return [_respuesta(regla) for regla in reglas]


async def guardar_reglas(
    db: AsyncSession,
    usuario: Usuario,
    items: list[ReglaCategoriaCreate],
) -> list[ReglaCategoriaResponse]:
    """Crea las reglas; si el patrón ya existe (sin distinguir mayúsculas), le cambia la
    categoría. Devuelve las reglas guardadas."""
    existentes = {
        regla.patron.lower(): regla
        for regla in (
            await db.scalars(select(ReglaCategoria).where(ReglaCategoria.id_usuario == usuario.id_usuario))
        ).all()
    }
    guardadas: list[ReglaCategoria] = []
    validadas: set[int] = set()
    for item in items:
        if item.id_categoria not in validadas:
            categoria = await obtener_categoria(db, usuario, item.id_categoria)
            if not categoria.activo:
                raise Conflicto(f"La categoría «{categoria.nombre}» está archivada.")
            validadas.add(item.id_categoria)
        regla = existentes.get(item.patron.lower())
        if regla is None:
            regla = ReglaCategoria(id_usuario=usuario.id_usuario, patron=item.patron, id_categoria=item.id_categoria)
            db.add(regla)
            existentes[item.patron.lower()] = regla
        else:
            regla.patron = item.patron
            regla.id_categoria = item.id_categoria
        guardadas.append(regla)
    await db.flush()
    for regla in guardadas:
        await db.refresh(regla, attribute_names=["categoria"])
    return [_respuesta(regla) for regla in guardadas]


async def eliminar_regla(db: AsyncSession, usuario: Usuario, id_regla: int) -> None:
    regla = await db.scalar(
        select(ReglaCategoria).where(
            ReglaCategoria.id_regla == id_regla, ReglaCategoria.id_usuario == usuario.id_usuario
        )
    )
    if regla is None:
        raise NoEncontrado("Regla no encontrada.")
    await db.delete(regla)
    await db.flush()


async def aplicar_reglas(
    db: AsyncSession,
    usuario: Usuario,
    data: AplicarReglasRequest,
) -> AplicarReglasResponse:
    """Recategoriza movimientos ya registrados según las reglas.

    Omite transferencias entre cuentas propias y abonos a deudas: su categoría la define
    la transferencia o la deuda, no el comercio. Con ``confirmar=false`` no cambia nada.
    """
    reglas = await reglas_activas(db, usuario)
    consulta = (
        select(Movimiento)
        .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
        .where(
            CuentaUsuario.id_usuario == usuario.id_usuario,
            Movimiento.id_transferencia.is_(None),
            Movimiento.id_deuda.is_(None),
        )
    )
    if data.desde:
        consulta = consulta.where(Movimiento.created_at >= datetime.combine(data.desde, time.min))
    if data.hasta:
        consulta = consulta.where(
            Movimiento.created_at < datetime.combine(data.hasta + timedelta(days=1), time.min)
        )
    if data.solo_desde_categorias:
        consulta = consulta.where(Movimiento.id_categoria.in_(data.solo_desde_categorias))
    movimientos = (await db.scalars(consulta)).all() if reglas else []

    grupos: dict[tuple[int, int], CambioReglas] = {}
    for movimiento in movimientos:
        nueva = elegir_categoria(reglas, movimiento.descripcion, movimiento.descripcion_original)
        if nueva is None or nueva == movimiento.id_categoria:
            continue
        grupo = grupos.setdefault(
            (movimiento.id_categoria, nueva),
            CambioReglas(
                id_categoria_anterior=movimiento.id_categoria,
                categoria_anterior="",
                id_categoria_nueva=nueva,
                categoria_nueva="",
                cantidad=0,
                monto_total=0,
            ),
        )
        grupo.cantidad += 1
        grupo.monto_total += movimiento.monto
        ejemplo = movimiento.descripcion or movimiento.descripcion_original
        if ejemplo and len(grupo.ejemplos) < MAX_EJEMPLOS and ejemplo not in grupo.ejemplos:
            grupo.ejemplos.append(ejemplo)
        if data.confirmar:
            movimiento.id_categoria = nueva

    if grupos:
        ids = {id_categoria for clave in grupos for id_categoria in clave}
        nombres = dict(
            (
                await db.execute(
                    select(CategoriaFinanza.id_categoria, CategoriaFinanza.nombre).where(
                        CategoriaFinanza.id_categoria.in_(ids)
                    )
                )
            ).all()
        )
        for grupo in grupos.values():
            grupo.categoria_anterior = nombres.get(grupo.id_categoria_anterior, "")
            grupo.categoria_nueva = nombres.get(grupo.id_categoria_nueva, "")
    if data.confirmar:
        await db.flush()

    cambios = sorted(grupos.values(), key=lambda grupo: -grupo.cantidad)
    return AplicarReglasResponse(
        aplicado=data.confirmar,
        revisados=len(movimientos),
        cambiados=sum(grupo.cantidad for grupo in cambios),
        cambios=cambios,
    )


async def resolver_categoria(
    db: AsyncSession,
    usuario: Usuario,
    id_categoria: int | None,
    *textos: str | None,
) -> int | None:
    """Categoría final de un movimiento nuevo: la regla si viene sin categoría o como
    «Otros»; si no, la enviada; sin ninguna, «Otros»."""
    id_otros = await categoria_otros(db)
    if id_categoria is not None and id_categoria != id_otros:
        return id_categoria
    return await categoria_automatica(db, usuario, *textos) or id_categoria or id_otros

