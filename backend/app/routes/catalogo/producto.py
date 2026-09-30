from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_superuser, current_user_or_api_key
from app.db import get_db
from app.models import Usuario
from app.routes.finanzas._http import errores_http, obtener_usuario_actual
from app.routes.utils import es_superusuario
from app.schemas.catalogo import ProductoCreate, ProductoFusionar, ProductoPatch, ProductoResponse
from app.services.catalogo import productos as servicio

router = APIRouter(prefix="/producto", tags=["Catalogo · Producto"])


async def _perfil_opcional(user, db: AsyncSession) -> Usuario | None:
    """El superusuario puede no tener perfil; un usuario normal siempre lo necesita."""
    if es_superusuario(user):
        return await db.scalar(select(Usuario).where(Usuario.auth_user_id == user.id))
    return await obtener_usuario_actual(user, db)


@router.get(
    "/",
    response_model=list[ProductoResponse],
    status_code=status.HTTP_200_OK,
    summary="Buscar productos",
    description=(
        "Catálogo aprobado más las propuestas del propio usuario (pendientes o rechazadas). "
        "q busca en nombre, marca y código de barra."
    ),
)
async def obtener_productos(
    db: AsyncSession = Depends(get_db),
    user=Depends(current_user_or_api_key),
    q: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    incluir_inactivos: Annotated[bool, Query(description="Solo superusuarios.")] = False,
):
    usuario = await _perfil_opcional(user, db)
    return await servicio.buscar_productos(
        db,
        usuario,
        q=q,
        limit=limit,
        incluir_inactivos=incluir_inactivos and es_superusuario(user),
    )


@router.get(
    "/frecuentes",
    response_model=list[ProductoResponse],
    status_code=status.HTTP_200_OK,
    summary="Productos que más compra el usuario",
)
async def obtener_productos_frecuentes(
    db: AsyncSession = Depends(get_db),
    user=Depends(current_user_or_api_key),
    limit: Annotated[int, Query(ge=1, le=50)] = 12,
):
    usuario = await obtener_usuario_actual(user, db)
    return await servicio.productos_frecuentes(db, usuario, limit)


@router.get(
    "/revision",
    response_model=list[ProductoResponse],
    status_code=status.HTTP_200_OK,
    summary="Cola de revisión de productos propuestos por usuarios",
)
async def obtener_productos_en_revision(
    db: AsyncSession = Depends(get_db),
    user=Depends(current_superuser),
    estado: Literal["pendiente", "rechazado"] = "pendiente",
):
    return await servicio.listar_para_revision(db, estado)


@router.get("/{id_producto}", response_model=ProductoResponse, status_code=status.HTTP_200_OK)
async def obtener_producto(id_producto: int, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await _perfil_opcional(user, db)
    with errores_http():
        return await servicio.obtener_producto(db, usuario, id_producto, es_admin=es_superusuario(user))


@router.post(
    "/",
    response_model=ProductoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear producto",
    description=(
        "Un superusuario lo crea aprobado. Un usuario lo crea pendiente: lo puede usar de "
        "inmediato en sus gastos, pero el resto no lo ve hasta que se apruebe."
    ),
)
async def crear_producto(data: ProductoCreate, db: AsyncSession = Depends(get_db), user=Depends(current_user_or_api_key)):
    usuario = await _perfil_opcional(user, db)
    with errores_http():
        return await servicio.crear_producto(db, usuario, data, es_admin=es_superusuario(user))


@router.patch("/{id_producto}", response_model=ProductoResponse, status_code=status.HTTP_200_OK)
async def editar_producto(
    id_producto: int,
    data: ProductoPatch,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_user_or_api_key),
):
    usuario = await _perfil_opcional(user, db)
    with errores_http():
        return await servicio.editar_producto(db, usuario, id_producto, data, es_admin=es_superusuario(user))


@router.post("/{id_producto}/aprobar", response_model=ProductoResponse, status_code=status.HTTP_200_OK)
async def aprobar_producto(id_producto: int, db: AsyncSession = Depends(get_db), user=Depends(current_superuser)):
    with errores_http():
        return await servicio.aprobar_producto(db, id_producto)


@router.post("/{id_producto}/rechazar", response_model=ProductoResponse, status_code=status.HTTP_200_OK)
async def rechazar_producto(id_producto: int, db: AsyncSession = Depends(get_db), user=Depends(current_superuser)):
    with errores_http():
        return await servicio.rechazar_producto(db, id_producto)


@router.post(
    "/{id_producto}/fusionar",
    response_model=ProductoResponse,
    status_code=status.HTTP_200_OK,
    summary="Fusionar un duplicado con un producto aprobado",
    description="Los gastos, consumos y tablas del duplicado pasan al destino y el duplicado se elimina.",
)
async def fusionar_producto(
    id_producto: int,
    data: ProductoFusionar,
    db: AsyncSession = Depends(get_db),
    user=Depends(current_superuser),
):
    with errores_http():
        return await servicio.fusionar_producto(db, id_producto, data.id_producto_destino)


@router.delete("/{id_producto}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def eliminar_producto(id_producto: int, db: AsyncSession = Depends(get_db), user=Depends(current_superuser)):
    with errores_http():
        await servicio.desactivar_producto(db, id_producto)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
