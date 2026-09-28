from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CategoriaFinanza
from app.schemas.finanzas import CategoriaCreate, CategoriaPatch
from app.services.errores import Conflicto, NoEncontrado


async def listar_categorias(db: AsyncSession) -> list[CategoriaFinanza]:
    return (await db.execute(select(CategoriaFinanza))).scalars().all()


async def obtener_categoria(db: AsyncSession, id_categoria: int) -> CategoriaFinanza:
    categoria = await db.scalar(
        select(CategoriaFinanza).where(CategoriaFinanza.id_categoria == id_categoria)
    )
    if not categoria:
        raise NoEncontrado("Categoría no encontrada")
    return categoria


async def crear_categoria(db: AsyncSession, data: CategoriaCreate) -> CategoriaFinanza:
    existente = await db.scalar(
        select(CategoriaFinanza).where(CategoriaFinanza.nombre == data.nombre)
    )
    if existente:
        raise Conflicto("Categoría ya existe")

    categoria = CategoriaFinanza(nombre=data.nombre)
    db.add(categoria)
    await db.flush()
    return categoria


async def actualizar_categoria(
    db: AsyncSession,
    id_categoria: int,
    data: CategoriaPatch,
) -> CategoriaFinanza:
    categoria = await obtener_categoria(db, id_categoria)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(categoria, field, value)

    await db.refresh(categoria)
    return categoria


async def eliminar_categoria(db: AsyncSession, id_categoria: int) -> None:
    categoria = await obtener_categoria(db, id_categoria)
    await db.delete(categoria)
