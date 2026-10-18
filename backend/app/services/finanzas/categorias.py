"""Categorías de movimientos: las por defecto (compartidas) y las propias de cada usuario.

Un usuario ve las por defecto más las suyas. Solo un superusuario crea o modifica las por
defecto; cada usuario administra únicamente las suyas.
"""
from datetime import datetime, timedelta

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CategoriaFinanza, CuentaUsuario, Movimiento, PreferenciaCategoria, Usuario
from app.schemas.finanzas import CategoriaCreate, CategoriaPatch, MoverMovimientosResponse
from app.services.errores import Conflicto, DatosInvalidos, NoEncontrado, SinPermiso


def condicion_visible(usuario: Usuario):
    return or_(
        CategoriaFinanza.id_usuario.is_(None),
        CategoriaFinanza.id_usuario == usuario.id_usuario,
    )


DIAS_USO_RECIENTE = 90


async def listar_categorias(
    db: AsyncSession,
    usuario: Usuario,
    *,
    incluir_archivadas: bool = False,
    incluir_ocultas: bool = False,
) -> list[CategoriaFinanza]:
    """Primero las más usadas en los últimos 90 días; a igual uso, por defecto antes que
    propias y por nombre. Cada una trae ``oculta`` y ``usos_recientes`` (atributos de la
    instancia, no columnas) para CategoriaResponse."""
    consulta = select(CategoriaFinanza).where(condicion_visible(usuario))
    if not incluir_archivadas:
        consulta = consulta.where(CategoriaFinanza.activo.is_(True))
    consulta = consulta.order_by(
        CategoriaFinanza.id_usuario.is_not(None),
        func.lower(CategoriaFinanza.nombre),
    )
    lista = (await db.execute(consulta)).scalars().all()

    ocultas = set(
        (
            await db.scalars(
                select(PreferenciaCategoria.id_categoria).where(
                    PreferenciaCategoria.id_usuario == usuario.id_usuario,
                    PreferenciaCategoria.oculta.is_(True),
                )
            )
        ).all()
    )
    desde = datetime.now() - timedelta(days=DIAS_USO_RECIENTE)
    usos = dict(
        (
            await db.execute(
                select(Movimiento.id_categoria, func.count(Movimiento.id_transaccion))
                .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
                .where(CuentaUsuario.id_usuario == usuario.id_usuario, Movimiento.created_at >= desde)
                .group_by(Movimiento.id_categoria)
            )
        ).all()
    )
    for categoria in lista:
        categoria.oculta = categoria.id_categoria in ocultas
        categoria.usos_recientes = usos.get(categoria.id_categoria, 0)
    if not incluir_ocultas:
        lista = [categoria for categoria in lista if not categoria.oculta]
    # sorted es estable: a igual uso se mantiene el orden de la consulta.
    return sorted(lista, key=lambda categoria: -categoria.usos_recientes)


async def ocultar_categoria(
    db: AsyncSession,
    usuario: Usuario,
    id_categoria: int,
    oculta: bool,
) -> CategoriaFinanza:
    """Oculta (o vuelve a mostrar) una categoría solo para este usuario. Sirve también
    para las por defecto, que son compartidas y no puede archivar."""
    categoria = await obtener_categoria(db, usuario, id_categoria)
    preferencia = await db.get(PreferenciaCategoria, (usuario.id_usuario, id_categoria))
    if preferencia is None:
        # Import diferido: semanal importa este módulo.
        from app.services.finanzas.semanal import excluida_por_defecto

        preferencia = PreferenciaCategoria(
            id_usuario=usuario.id_usuario,
            id_categoria=id_categoria,
            excluida=excluida_por_defecto(categoria.nombre),
        )
        db.add(preferencia)
    preferencia.oculta = oculta
    preferencia.updated_at = datetime.now()
    await db.flush()
    categoria.oculta = oculta
    return categoria


async def obtener_categoria(db: AsyncSession, usuario: Usuario, id_categoria: int) -> CategoriaFinanza:
    """Categoría visible para el usuario. La de otro usuario se reporta como inexistente."""
    categoria = await db.scalar(
        select(CategoriaFinanza).where(
            CategoriaFinanza.id_categoria == id_categoria,
            condicion_visible(usuario),
        )
    )
    if not categoria:
        raise NoEncontrado("Categoría no encontrada.")
    return categoria


async def _validar_nombre_disponible(
    db: AsyncSession,
    nombre: str,
    *,
    id_usuario: int | None,
    excluir_id: int | None = None,
) -> None:
    """Una propia no puede repetir una por defecto ni otra propia; una por defecto no
    puede repetir otra por defecto. Sin distinguir mayúsculas."""
    grupos = [CategoriaFinanza.id_usuario.is_(None)]
    if id_usuario is not None:
        grupos.append(CategoriaFinanza.id_usuario == id_usuario)

    consulta = select(CategoriaFinanza).where(
        func.lower(CategoriaFinanza.nombre) == nombre.lower(),
        or_(*grupos),
    )
    if excluir_id is not None:
        consulta = consulta.where(CategoriaFinanza.id_categoria != excluir_id)

    existente = await db.scalar(consulta.limit(1))
    if existente:
        if existente.id_usuario is None and id_usuario is not None:
            raise Conflicto(f"Ya existe la categoría por defecto «{existente.nombre}».")
        if not existente.activo:
            raise Conflicto(f"Ya tienes la categoría «{existente.nombre}» archivada: desarchívala.")
        raise Conflicto(f"La categoría «{existente.nombre}» ya existe.")


def _validar_puede_modificar(categoria: CategoriaFinanza, usuario: Usuario, es_admin: bool) -> None:
    if categoria.id_usuario is None:
        if not es_admin:
            raise SinPermiso("Las categorías por defecto solo las modifica un administrador.")
    elif categoria.id_usuario != usuario.id_usuario:
        raise NoEncontrado("Categoría no encontrada.")


async def crear_categoria(
    db: AsyncSession,
    usuario: Usuario,
    data: CategoriaCreate,
    *,
    es_admin: bool = False,
) -> CategoriaFinanza:
    if data.por_defecto and not es_admin:
        raise SinPermiso("Solo un administrador puede crear categorías por defecto.")

    id_usuario = None if data.por_defecto else usuario.id_usuario
    await _validar_nombre_disponible(db, data.nombre, id_usuario=id_usuario)

    categoria = CategoriaFinanza(nombre=data.nombre, id_usuario=id_usuario)
    db.add(categoria)
    await db.flush()
    await db.refresh(categoria)
    return categoria


async def actualizar_categoria(
    db: AsyncSession,
    usuario: Usuario,
    id_categoria: int,
    data: CategoriaPatch,
    *,
    es_admin: bool = False,
) -> CategoriaFinanza:
    categoria = await obtener_categoria(db, usuario, id_categoria)
    _validar_puede_modificar(categoria, usuario, es_admin)

    cambios = data.model_dump(exclude_unset=True, exclude_none=True)
    if "nombre" in cambios and cambios["nombre"].lower() != categoria.nombre.lower():
        await _validar_nombre_disponible(
            db,
            cambios["nombre"],
            id_usuario=categoria.id_usuario,
            excluir_id=categoria.id_categoria,
        )

    for field, value in cambios.items():
        setattr(categoria, field, value)

    await db.flush()
    await db.refresh(categoria)
    return categoria


async def eliminar_categoria(
    db: AsyncSession,
    usuario: Usuario,
    id_categoria: int,
    *,
    es_admin: bool = False,
) -> bool:
    """Borra la categoría si nunca se usó; si tiene movimientos, la archiva.

    Devuelve True si quedó archivada en vez de borrada.
    """
    categoria = await obtener_categoria(db, usuario, id_categoria)
    _validar_puede_modificar(categoria, usuario, es_admin)

    en_uso = await db.scalar(
        select(Movimiento.id_transaccion)
        .where(Movimiento.id_categoria == categoria.id_categoria)
        .limit(1)
    )
    if en_uso is not None:
        categoria.activo = False
        await db.flush()
        return True

    await db.delete(categoria)
    await db.flush()
    return False


async def mover_movimientos(
    db: AsyncSession,
    usuario: Usuario,
    id_origen: int,
    id_destino: int,
    *,
    confirmar: bool = False,
) -> MoverMovimientosResponse:
    """Pasa todos los movimientos del usuario de una categoría a otra (para fusionar
    categorías antes de ocultar o archivar la de origen). Sin confirmar solo los cuenta.
    Los de otros usuarios en una categoría por defecto no se tocan."""
    if id_origen == id_destino:
        raise DatosInvalidos("La categoría de destino debe ser distinta.")
    await obtener_categoria(db, usuario, id_origen)
    destino = await obtener_categoria(db, usuario, id_destino)
    if not destino.activo:
        raise Conflicto(f"La categoría «{destino.nombre}» está archivada.")

    del_usuario = select(CuentaUsuario.id_cuenta).where(CuentaUsuario.id_usuario == usuario.id_usuario)
    filtro = (Movimiento.id_categoria == id_origen, Movimiento.id_cuenta.in_(del_usuario))
    cantidad, monto = (
        await db.execute(
            select(func.count(Movimiento.id_transaccion), func.coalesce(func.sum(Movimiento.monto), 0)).where(*filtro)
        )
    ).one()
    if confirmar and cantidad:
        await db.execute(
            update(Movimiento).where(*filtro).values(id_categoria=id_destino).execution_options(synchronize_session=False)
        )
    return MoverMovimientosResponse(
        aplicado=confirmar,
        id_categoria_origen=id_origen,
        id_categoria_destino=id_destino,
        cantidad=cantidad,
        monto_total=monto,
    )
