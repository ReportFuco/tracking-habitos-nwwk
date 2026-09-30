from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.auth.fastapi_users import current_user_or_api_key
from app.routes.finanzas._http import errores_http, obtener_usuario_actual
from app.routes.utils import es_superusuario
from app.schemas.finanzas import (
    CategoriaResponse,
    CategoriaCreate,
    CategoriaPatch
)
from app.services.finanzas import categorias as servicio


router = APIRouter(prefix="/categoria", tags=["Finanzas · Categorías"])

@router.get(
    "/",
    response_model=list[CategoriaResponse],
    summary="Obtener las categorías del usuario",
    description=(
        "Categorías por defecto más las propias del usuario. Las archivadas solo se "
        "incluyen con incluir_archivadas=true."
    ),
    status_code=status.HTTP_200_OK
)
async def obtener_categorias(
    db:AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key),
    incluir_archivadas: Annotated[bool, Query()] = False,
):
    usuario = await obtener_usuario_actual(user, db)
    return await servicio.listar_categorias(db, usuario, incluir_archivadas=incluir_archivadas)


@router.get(
    "/{id_categoria}",
    response_model=CategoriaResponse,
    summary="Obtener categoría por ID",
    description="Obtiene una categoría por defecto o propia del usuario",
    status_code=status.HTTP_200_OK
)
async def obtener_categoria(
    id_categoria: int,
    db: AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key)
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        return await servicio.obtener_categoria(db, usuario, id_categoria)


@router.post(
    "/",
    response_model=CategoriaResponse,
    summary="Crear categoría",
    description=(
        "Crea una categoría propia del usuario. Con por_defecto=true (solo superusuarios) "
        "crea una categoría por defecto, visible para todos."
    ),
    status_code=status.HTTP_201_CREATED
)
async def crear_categoria(
    data: CategoriaCreate,
    db: AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key)
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        return await servicio.crear_categoria(db, usuario, data, es_admin=es_superusuario(user))


@router.patch(
    "/{id_categoria}",
    response_model=CategoriaResponse,
    summary="Actualizar categoría",
    description="Renombra o desarchiva una categoría propia (o por defecto, si eres superusuario)"
)
async def actualizar_categoria(
    id_categoria:int,
    data:CategoriaPatch,
    db:AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key)
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        return await servicio.actualizar_categoria(
            db, usuario, id_categoria, data, es_admin=es_superusuario(user)
        )


@router.delete(
    "/{id_categoria}",
    summary="Eliminar categoría",
    description=(
        "Elimina la categoría si nunca se usó. Si tiene movimientos queda archivada: "
        "los movimientos la conservan pero ya no se ofrece al registrar."
    ),
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def eliminar_categoria(
    id_categoria:int,
    db:AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key)
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        await servicio.eliminar_categoria(db, usuario, id_categoria, es_admin=es_superusuario(user))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
