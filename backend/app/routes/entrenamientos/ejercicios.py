from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.fastapi_users import current_superuser, current_user_or_api_key
from app.db.session import get_db
from app.models import Ejercicios, Musculo, SerieFuerza, SubcategoriaMusculo
from app.routes.utils import normalize_search_text, normalize_sql_text
from app.schemas.entrenamientos import (
    EjercicioCreate,
    EjercicioPatch,
    EjercicioResponse,
    MusculoResponse,
)


router = APIRouter(prefix="/ejercicios", tags=["Entrenamientos · Ejercicios"])


async def _obtener_ejercicio(db: AsyncSession, id_ejercicio: int) -> Ejercicios:
    ejercicio = await db.scalar(
        select(Ejercicios)
        .where(Ejercicios.id_ejercicio == id_ejercicio)
        .options(
            selectinload(Ejercicios.subcategoria_musculo)
            .selectinload(SubcategoriaMusculo.musculo)
        )
    )
    if not ejercicio:
        raise HTTPException(status_code=404, detail="Ejercicio no encontrado")
    return ejercicio


async def _existe_nombre_duplicado(
    db: AsyncSession,
    nombre: str,
    id_ejercicio_excluido: int | None = None,
) -> bool:
    nombre_normalizado = normalize_search_text(nombre)
    stmt = select(Ejercicios).where(
        normalize_sql_text(Ejercicios.nombre) == nombre_normalizado
    )
    if id_ejercicio_excluido is not None:
        stmt = stmt.where(Ejercicios.id_ejercicio != id_ejercicio_excluido)
    return await db.scalar(stmt) is not None


async def _obtener_subcategoria_activa(
    db: AsyncSession,
    id_subcategoria_musculo: int,
) -> SubcategoriaMusculo:
    subcategoria = await db.scalar(
        select(SubcategoriaMusculo).where(
            SubcategoriaMusculo.id_subcategoria_musculo == id_subcategoria_musculo,
            SubcategoriaMusculo.activo.is_(True),
        )
    )
    if not subcategoria:
        raise HTTPException(status_code=404, detail="Subcategoría muscular no encontrada o inactiva")
    return subcategoria


@router.get(
    "/",
    response_model=list[EjercicioResponse],
    status_code=status.HTTP_200_OK,
)
async def obtener_ejercicios(
    q: Optional[str] = Query(
        default=None,
        min_length=1,
        description="Texto a buscar en el nombre del ejercicio, músculo o subcategoría",
    ),
    id_musculo: int | None = Query(
        default=None,
        description="Filtra por el grupo muscular principal del ejercicio",
    ),
    id_subcategoria_musculo: int | None = Query(
        default=None,
        description="Filtra por la subcategoría muscular del ejercicio",
    ),
    tipo: str | None = Query(
        default=None,
        description="Filtro legacy por código de músculo, por ejemplo pecho o bicep",
    ),
    db: AsyncSession = Depends(get_db),
    user=Depends(current_user_or_api_key),
):
    stmt = (
        select(Ejercicios)
        .join(Ejercicios.subcategoria_musculo)
        .join(SubcategoriaMusculo.musculo)
        .options(
            selectinload(Ejercicios.subcategoria_musculo)
            .selectinload(SubcategoriaMusculo.musculo)
        )
    )

    if id_musculo is not None:
        stmt = stmt.where(SubcategoriaMusculo.id_musculo == id_musculo)

    if id_subcategoria_musculo is not None:
        stmt = stmt.where(Ejercicios.id_subcategoria_musculo == id_subcategoria_musculo)

    if tipo is not None:
        stmt = stmt.where(Musculo.codigo == normalize_search_text(tipo))

    if q:
        termino = normalize_search_text(q)
        stmt = stmt.where(
            or_(
                normalize_sql_text(Ejercicios.nombre).ilike(f"%{termino}%"),
                normalize_sql_text(Musculo.nombre).ilike(f"%{termino}%"),
                normalize_sql_text(Musculo.codigo).ilike(f"%{termino}%"),
                normalize_sql_text(SubcategoriaMusculo.nombre).ilike(f"%{termino}%"),
                normalize_sql_text(SubcategoriaMusculo.codigo).ilike(f"%{termino}%"),
            )
        )

    stmt = stmt.order_by(Ejercicios.nombre.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get(
    "/musculos",
    response_model=list[MusculoResponse],
    status_code=status.HTTP_200_OK,
)
async def obtener_musculos(
    db: AsyncSession = Depends(get_db),
    user=Depends(current_user_or_api_key),
):
    result = await db.execute(
        select(Musculo)
        .where(Musculo.activo.is_(True))
        .options(selectinload(Musculo.subcategorias))
        .order_by(Musculo.id_musculo.asc())
    )
    return result.scalars().all()


@router.get(
    "/{id_ejercicio}",
    response_model=EjercicioResponse,
    status_code=status.HTTP_200_OK,
)
async def obtener_ejercicio(
    id_ejercicio: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_user_or_api_key),
):
    return await _obtener_ejercicio(db, id_ejercicio)


@router.post(
    "/",
    response_model=EjercicioResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_ejercicio(
    data: EjercicioCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_superuser),
):
    if await _existe_nombre_duplicado(db, data.nombre):
        raise HTTPException(status_code=409, detail="Ya existe un ejercicio con ese nombre")

    await _obtener_subcategoria_activa(db, data.id_subcategoria_musculo)

    ejercicio = Ejercicios(
        nombre=data.nombre.strip(),
        id_subcategoria_musculo=data.id_subcategoria_musculo,
        url_video=data.url_video,
    )
    db.add(ejercicio)
    await db.flush()
    return await _obtener_ejercicio(db, ejercicio.id_ejercicio)


@router.patch(
    "/{id_ejercicio}",
    response_model=EjercicioResponse,
    status_code=status.HTTP_200_OK,
)
async def editar_ejercicio(
    id_ejercicio: int,
    data: EjercicioPatch,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_superuser),
):
    ejercicio = await _obtener_ejercicio(db, id_ejercicio)
    cambios = data.model_dump(exclude_unset=True)

    if not cambios:
        raise HTTPException(status_code=400, detail="No se enviaron cambios")

    if "nombre" in cambios:
        nuevo_nombre = cambios["nombre"].strip()
        if await _existe_nombre_duplicado(db, nuevo_nombre, id_ejercicio):
            raise HTTPException(status_code=409, detail="Ya existe un ejercicio con ese nombre")
        cambios["nombre"] = nuevo_nombre

    if "id_subcategoria_musculo" in cambios:
        await _obtener_subcategoria_activa(db, cambios["id_subcategoria_musculo"])

    for field, value in cambios.items():
        setattr(ejercicio, field, value)

    await db.flush()
    return await _obtener_ejercicio(db, ejercicio.id_ejercicio)


@router.delete(
    "/{id_ejercicio}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def eliminar_ejercicio(
    id_ejercicio: int,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_superuser),
):
    ejercicio = await _obtener_ejercicio(db, id_ejercicio)

    serie_asociada = await db.scalar(
        select(SerieFuerza.id_fuerza_detalle).where(SerieFuerza.id_ejercicio == id_ejercicio)
    )
    if serie_asociada is not None:
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar un ejercicio que ya fue usado en series de fuerza",
        )

    await db.delete(ejercicio)
