from app.schemas.finanzas import (
    MovimientoCreate,
    MovimientoListResponse,
    MovimientoResponse,
    MovimientoPatch
)
from datetime import datetime
from typing import Annotated
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Response,
    status
)
from app.models import (
    Compra,
    Movimiento,
    CategoriaFinanza,
    CuentaUsuario,
    Local,
    MovimientoCompra,
    Usuario
)
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from sqlalchemy import select, and_, desc, func, or_
from sqlalchemy.orm import selectinload
from app.auth.fastapi_users import current_user_or_api_key
from app.models.finanzas import EnumTipoMovimiento
from zoneinfo import ZoneInfo


router = APIRouter(prefix="/movimientos", tags=["Finanzas · Movimientos"])
CHILE_TZ = ZoneInfo("America/Santiago")


async def obtener_usuario_actual(user, db: AsyncSession) -> Usuario:
    usuario = await db.scalar(
        select(Usuario).where(Usuario.auth_user_id == user.id)
    )
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil de usuario no encontrado."
        )
    return usuario

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
):
    usuario = await obtener_usuario_actual(user, db)
    rango_inicio, rango_fin = _get_current_chile_month_range()

    filtros = filtros_listado_movimientos(
        year=year,
        month=month,
        tipo_movimiento=tipo_movimiento,
        id_categoria=id_categoria,
        id_cuenta=id_cuenta,
        q=q,
    )

    consulta = (
        select(Movimiento)
        .execution_options(populate_existing=True)
        .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
        .where(CuentaUsuario.id_usuario == usuario.id_usuario, *filtros)
    )
    if q:
        consulta = consulta.join(CategoriaFinanza, Movimiento.id_categoria == CategoriaFinanza.id_categoria)

    movimiento_usuario = (
        await db.execute(
            consulta
            .order_by(desc(Movimiento.created_at), desc(Movimiento.id_transaccion))
            .offset(offset)
            .limit(limit)
            .options(
                selectinload(Movimiento.cuenta),
                selectinload(Movimiento.categoria),
                selectinload(Movimiento.vinculos_compra)
                .selectinload(MovimientoCompra.compra)
                .selectinload(Compra.local)
                .selectinload(Local.cadena),
                selectinload(Movimiento.vinculos_compra)
                .selectinload(MovimientoCompra.compra)
                .selectinload(Compra.detalles),
            )
        )
    ).scalars().all()

    # Sin resultados es una lista vacia, no un error: con filtros es un caso normal.
    total_gasto_mensual = await db.scalar(
        select(func.coalesce(func.sum(Movimiento.monto), 0))
        .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
        .where(
            CuentaUsuario.id_usuario == usuario.id_usuario,
            Movimiento.tipo_movimiento == EnumTipoMovimiento.GASTO,
            Movimiento.created_at >= rango_inicio,
            Movimiento.created_at < rango_fin,
        )
    )

    return MovimientoListResponse(
        items=movimiento_usuario,
        offset=offset,
        limit=limit,
        total_gasto_mensual=float(total_gasto_mensual or 0),
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

    transaccion = (
        await db.scalar(
            select(Movimiento)
            .execution_options(populate_existing=True)
            .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
            .where(
                and_(
                    Movimiento.id_transaccion == id_movimiento,
                    CuentaUsuario.id_usuario == usuario.id_usuario
                )
            )
            .options(
                selectinload(Movimiento.categoria),
                selectinload(Movimiento.cuenta),
                selectinload(Movimiento.vinculos_compra)
                .selectinload(MovimientoCompra.compra)
                .selectinload(Compra.local)
                .selectinload(Local.cadena),
                selectinload(Movimiento.vinculos_compra)
                .selectinload(MovimientoCompra.compra)
                .selectinload(Compra.detalles),
            )
        )
    )

    if not transaccion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movimiento no encontrado."
        )

    return transaccion


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

    # La cola offline puede reenviar la misma solicitud si la respuesta se pierde. El
    # identificador del cliente convierte ese reintento en una lectura del movimiento ya
    # creado, evitando duplicar el gasto.
    if data.client_request_id is not None:
        movimiento_existente = await db.scalar(
            select(Movimiento)
            .where(Movimiento.client_request_id == data.client_request_id)
            .options(
                selectinload(Movimiento.categoria),
                selectinload(Movimiento.cuenta),
                selectinload(Movimiento.vinculos_compra)
                .selectinload(MovimientoCompra.compra)
                .selectinload(Compra.local)
                .selectinload(Local.cadena),
                selectinload(Movimiento.vinculos_compra)
                .selectinload(MovimientoCompra.compra)
                .selectinload(Compra.detalles),
            )
        )
        if movimiento_existente is not None:
            if movimiento_existente.cuenta.id_usuario != usuario.id_usuario:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="El identificador de la solicitud ya fue utilizado.",
                )
            return movimiento_existente

    categoria = (
        await db.scalar(
            select(CategoriaFinanza)
            .where(CategoriaFinanza.id_categoria == data.id_categoria)
        )
    )
    if not categoria:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Categoría no encontrada."
        )
    cuenta = (
        await db.scalar(
            select(CuentaUsuario)
            .where(
                CuentaUsuario.id_cuenta == data.id_cuenta,
                CuentaUsuario.activo.is_(True),
                CuentaUsuario.id_usuario == usuario.id_usuario
            )
        )
    )
    if not cuenta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuenta no encontrada."
        )
    
    movimiento = Movimiento(
        **data.model_dump(exclude_none=True)
    )

    db.add(movimiento)
    await db.flush()
    await db.refresh(
        movimiento,
        attribute_names=["categoria", "cuenta", "vinculos_compra"]
    )

    movimiento = await db.scalar(
        select(Movimiento)
        .execution_options(populate_existing=True)
        .where(Movimiento.id_transaccion == movimiento.id_transaccion)
        .options(
            selectinload(Movimiento.categoria),
            selectinload(Movimiento.cuenta),
            selectinload(Movimiento.vinculos_compra)
            .selectinload(MovimientoCompra.compra)
            .selectinload(Compra.local)
            .selectinload(Local.cadena),
            selectinload(Movimiento.vinculos_compra)
            .selectinload(MovimientoCompra.compra)
            .selectinload(Compra.detalles),
        )
    )

    return movimiento


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
    
    movimiento = await db.scalar(
        select(Movimiento)
        .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
        .where(
            Movimiento.id_transaccion == id_movimiento,
            CuentaUsuario.id_usuario == usuario.id_usuario
        )
    )

    if not movimiento:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movimiento no encontrado."
        )

    update_data = data.model_dump(exclude_unset=True)

    if "id_categoria" in update_data:
        categoria = await db.scalar(
            select(CategoriaFinanza).where(
                CategoriaFinanza.id_categoria == update_data["id_categoria"]
            )
        )
        if not categoria:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Categoría no encontrada."
            )

    if "id_cuenta" in update_data:
        cuenta = await db.scalar(
            select(CuentaUsuario).where(
                CuentaUsuario.id_cuenta == update_data["id_cuenta"],
                CuentaUsuario.activo.is_(True),
                CuentaUsuario.id_usuario == usuario.id_usuario
            )
        )
        if not cuenta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cuenta no encontrada."
            )

    aplicar_patch_movimiento(movimiento, update_data)

    await db.commit()

    await db.refresh(
        movimiento,
        attribute_names=["categoria", "cuenta", "vinculos_compra"]
    )

    movimiento = await db.scalar(
        select(Movimiento)
        .execution_options(populate_existing=True)
        .where(Movimiento.id_transaccion == id_movimiento)
        .options(
            selectinload(Movimiento.categoria),
            selectinload(Movimiento.cuenta),
            selectinload(Movimiento.vinculos_compra)
            .selectinload(MovimientoCompra.compra)
            .selectinload(Compra.local)
            .selectinload(Local.cadena),
            selectinload(Movimiento.vinculos_compra)
            .selectinload(MovimientoCompra.compra)
            .selectinload(Compra.detalles),
        )
    )

    return movimiento


def rango_mes(year: int, month: int) -> tuple[datetime, datetime]:
    """Inicio y fin (naive, calendario de Chile) de un mes. created_at es naive."""
    inicio = datetime(year, month, 1)
    fin = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)
    return inicio, fin


def filtros_listado_movimientos(
    *,
    year: int | None,
    month: int | None,
    tipo_movimiento: EnumTipoMovimiento | None,
    id_categoria: int | None,
    id_cuenta: int | None,
    q: str | None,
) -> list:
    """Condiciones WHERE del listado. Un mes sin año usa el año actual de Chile."""
    filtros = []
    if month is not None:
        anio = year or datetime.now(CHILE_TZ).year
        inicio, fin = rango_mes(anio, month)
        filtros += [Movimiento.created_at >= inicio, Movimiento.created_at < fin]
    elif year is not None:
        filtros += [
            Movimiento.created_at >= datetime(year, 1, 1),
            Movimiento.created_at < datetime(year + 1, 1, 1),
        ]
    if tipo_movimiento is not None:
        filtros.append(Movimiento.tipo_movimiento == tipo_movimiento)
    if id_categoria is not None:
        filtros.append(Movimiento.id_categoria == id_categoria)
    if id_cuenta is not None:
        filtros.append(Movimiento.id_cuenta == id_cuenta)
    if q:
        patron = f"%{q.strip()}%"
        filtros.append(or_(Movimiento.descripcion.ilike(patron), CategoriaFinanza.nombre.ilike(patron)))
    return filtros


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

    movimiento = await db.scalar(
        select(Movimiento)
        .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
        .where(
            Movimiento.id_transaccion == id_movimiento,
            CuentaUsuario.id_usuario == usuario.id_usuario,
        )
        .options(selectinload(Movimiento.vinculos_compra))
    )
    if not movimiento:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movimiento no encontrado.")

    # Los vinculos con compras se borran en cascada; las compras quedan intactas.
    await db.delete(movimiento)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def aplicar_patch_movimiento(movimiento: Movimiento, update_data: dict) -> None:
    """Aplica un PATCH validado manteniendo las invariantes del modelo.

    La ubicación del lugar de compra solo existe en gastos
    (``ck_movimiento_ubicacion_solo_gasto``). Si un gasto presencial pasa a ser
    ingreso, la ubicación deja de tener sentido y se descarta; como el PATCH no permite
    editar la ubicación, rechazarlo impediría corregir el tipo del movimiento.
    """
    for field, value in update_data.items():
        setattr(movimiento, field, value)

    if movimiento.tipo_movimiento != EnumTipoMovimiento.GASTO and movimiento.en_lugar_compra:
        movimiento.en_lugar_compra = False
        movimiento.latitud = None
        movimiento.longitud = None
        movimiento.precision_ubicacion = None


def _get_current_chile_month_range() -> tuple[datetime, datetime]:
    now_chile = datetime.now(CHILE_TZ)
    month_start = now_chile.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    if month_start.month == 12:
        next_month = month_start.replace(year=month_start.year + 1, month=1)
    else:
        next_month = month_start.replace(month=month_start.month + 1)

    # La columna created_at usa DateTime sin timezone; por eso comparamos con
    # valores naive construidos desde el calendario de Chile.
    return month_start.replace(tzinfo=None), next_month.replace(tzinfo=None)
