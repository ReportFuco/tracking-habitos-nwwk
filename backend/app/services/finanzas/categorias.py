"""Categorías de movimientos: las por defecto (compartidas) y las propias de cada usuario.

Un usuario ve las por defecto más las suyas. Solo un superusuario crea o modifica las por
defecto; cada usuario administra únicamente las suyas.
"""
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CategoriaFinanza, Movimiento, Usuario
from app.schemas.finanzas import CategoriaCreate, CategoriaPatch
from app.services.errores import Conflicto, NoEncontrado, SinPermiso


def condicion_visible(usuario: Usuario):
    return or_(
        CategoriaFinanza.id_usuario.is_(None),
        CategoriaFinanza.id_usuario == usuario.id_usuario,
    )


async def listar_categorias(
    db: AsyncSession,
    usuario: Usuario,
    *,
    incluir_archivadas: bool = False,
) -> list[CategoriaFinanza]:
    """Por defecto primero y después las propias, cada grupo por nombre."""
    consulta = select(CategoriaFinanza).where(condicion_visible(usuario))
    if not incluir_archivadas:
        consulta = consulta.where(CategoriaFinanza.activo.is_(True))
    consulta = consulta.order_by(
        CategoriaFinanza.id_usuario.is_not(None),
        func.lower(CategoriaFinanza.nombre),
    )
    return (await db.execute(consulta)).scalars().all()


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
