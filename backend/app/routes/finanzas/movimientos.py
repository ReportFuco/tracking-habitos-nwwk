from app.schemas.finanzas import (
    MovimientoCreate,
    MovimientoItemCreate,
    MovimientoItemPatch,
    MovimientoListResponse,
    MovimientoResponse,
    MovimientoPatch
)
from typing import Annotated
from fastapi import (
    APIRouter,
    Depends,
    Query,
    Response,
    status
)
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.auth.fastapi_users import current_user_or_api_key
from app.models.finanzas import EnumTipoMovimiento
from app.routes.finanzas._http import errores_http, obtener_usuario_actual
from app.services.finanzas import items as servicio_items
from app.services.finanzas import movimientos as servicio
# Reexportados: los tests unitarios los importan desde este modulo.
from app.services.finanzas.movimientos import (  # noqa: F401
    aplicar_patch_movimiento,
    filtros_listado_movimientos,
    rango_mes,
)


router = APIRouter(prefix="/movimientos", tags=["Finanzas · Movimientos"])


@router.get(
    "/",
    summary="Obtener todos los movimientos del usuario.",
    description="Obtiene el movimiento en especifico",
    status_code=status.HTTP_200_OK,
    response_model=MovimientoListResponse
)
async def obtener_movimiento(
    offset: int = Query(
        default=0,
        ge=0,
        description="Cantidad de registros a omitir desde el inicio del resultado."
    ),
    limit: int = Query(
        default=20,
        ge=1,
        le=100,
        description="Cantidad maxima de movimientos a devolver."
    ),
    user = Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db),
    # Annotated deja None como default real (la funcion tambien se llama directo en tests).
    year: Annotated[int | None, Query(ge=2000, le=2100, description="Año del periodo.")] = None,
    month: Annotated[int | None, Query(ge=1, le=12, description="Mes del periodo, calendario de Chile.")] = None,
    tipo_movimiento: Annotated[EnumTipoMovimiento | None, Query()] = None,
    id_categoria: Annotated[int | None, Query(ge=1)] = None,
    id_cuenta: Annotated[int | None, Query(ge=1)] = None,
    q: Annotated[
        str | None,
        Query(min_length=1, max_length=100, description="Busca en la descripcion y en el nombre de la categoria."),
    ] = None,
    id_deuda: Annotated[int | None, Query(ge=1, description="Solo los abonos de esta deuda.")] = None,
):
    usuario = await obtener_usuario_actual(user, db)

    items = await servicio.listar_movimientos(
        db,
        usuario,
        offset=offset,
        limit=limit,
        year=year,
        month=month,
        tipo_movimiento=tipo_movimiento,
        id_categoria=id_categoria,
        id_cuenta=id_cuenta,
        q=q,
        id_deuda=id_deuda,
    )

    return MovimientoListResponse(
        items=items,
        offset=offset,
        limit=limit,
        total_gasto_mensual=await servicio.gasto_mes_actual(db, usuario),
    )


@router.get(
    path="/{id_movimiento}",
    summary="Obtener transacción",
    description="Obtiene la información de la transacción realizada.",
    status_code=status.HTTP_200_OK,
    response_model=MovimientoResponse
)
async def obtener_movimientos(
    id_movimiento: int,
    db: AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key)
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        return await servicio.obtener_movimiento(db, usuario, id_movimiento)


@router.post(
    path="/",
    summary="crear movimiento",
    status_code=status.HTTP_201_CREATED,
    response_model=MovimientoResponse

)
async def crear_movimiento(
    data:MovimientoCreate,
    db:AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key)
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        return await servicio.crear_movimiento(db, usuario, data)


@router.patch(
    path="/{id_movimiento}",
    summary="Modificar movimiento",
    response_model=MovimientoResponse,
    status_code=status.HTTP_200_OK
)
async def editar_movimiento(
    id_movimiento: int,
    data: MovimientoPatch,
    db: AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key)
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        return await servicio.editar_movimiento(db, usuario, id_movimiento, data)


@router.delete(
    "/{id_movimiento}",
    summary="Eliminar movimiento",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
async def eliminar_movimiento(
    id_movimiento: int,
    db: AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key),
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        await servicio.eliminar_movimiento(db, usuario, id_movimiento)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{id_movimiento}/items",
    summary="Agregar producto a un gasto",
    description=(
        "Detalla un producto comprado en el gasto. El detalle puede ser parcial: no hace "
        "falta cubrir todo el monto. Devuelve el movimiento completo."
    ),
    status_code=status.HTTP_201_CREATED,
    response_model=MovimientoResponse,
)
async def agregar_item(
    id_movimiento: int,
    data: MovimientoItemCreate,
    db: AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key),
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        return await servicio_items.agregar_item(db, usuario, id_movimiento, data)


@router.patch(
    "/{id_movimiento}/items/{id_item}",
    summary="Editar producto de un gasto",
    response_model=MovimientoResponse,
    status_code=status.HTTP_200_OK,
)
async def editar_item(
    id_movimiento: int,
    id_item: int,
    data: MovimientoItemPatch,
    db: AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key),
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        return await servicio_items.editar_item(db, usuario, id_movimiento, id_item, data)


@router.delete(
    "/{id_movimiento}/items/{id_item}",
    summary="Quitar producto de un gasto",
    response_model=MovimientoResponse,
    status_code=status.HTTP_200_OK,
)
async def eliminar_item(
    id_movimiento: int,
    id_item: int,
    db: AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key),
):
    usuario = await obtener_usuario_actual(user, db)
    with errores_http():
        return await servicio_items.eliminar_item(db, usuario, id_movimiento, id_item)
