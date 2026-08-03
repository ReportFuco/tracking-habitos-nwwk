from fastapi import APIRouter, Depends, HTTPException, status
from app.db import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.entrenamiento import (
    SerieFuerza,
    EntrenamientoFuerza,
    Entrenamiento,
    EnumEstadoEntrenamiento as EstadoEntreno,
    Ejercicios,
    SubcategoriaMusculo,
)
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from app.schemas.entrenamientos import (
    SerieFuerzaCreate,
    SerieFuerzaPatch,
    SerieFuerzaResponse
)
from app.auth.fastapi_users import current_user_or_api_key
from app.models import Usuario


router = APIRouter(prefix="/series", tags=["Entrenamientos · Series Fuerza"])


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


async def obtener_serie_usuario_activa(
    id_fuerza_detalle: int,
    id_usuario: int,
    db: AsyncSession
) -> SerieFuerza | None:
    return await db.scalar(
        select(SerieFuerza)
        .join(EntrenamientoFuerza)
        .join(Entrenamiento)
        .where(
            SerieFuerza.id_fuerza_detalle == id_fuerza_detalle,
            Entrenamiento.id_usuario == id_usuario,
            EntrenamientoFuerza.estado == EstadoEntreno.ACTIVO
        )
        .options(
            selectinload(SerieFuerza.ejercicio)
            .selectinload(Ejercicios.subcategoria_musculo)
            .selectinload(SubcategoriaMusculo.musculo)
        )
    )


@router.post(
    path="/",
    response_model=SerieFuerzaResponse,
    status_code=status.HTTP_201_CREATED
)
async def agregar_serie_fuerza(
    data:SerieFuerzaCreate, 
    user = Depends(current_user_or_api_key),
    db:AsyncSession = Depends(get_db)
):
    usuario = await obtener_usuario_actual(user, db)
    # Se captura como valor plano: si el flush de abajo revierte, el objeto ORM queda
    # expirado y volver a tocarlo dispararia un lazy-load sincrono invalido en async.
    id_usuario = usuario.id_usuario

    serie_options = (
        selectinload(SerieFuerza.ejercicio)
        .selectinload(Ejercicios.subcategoria_musculo)
        .selectinload(SubcategoriaMusculo.musculo)
    )

    # La cola offline puede reenviar la misma solicitud si la respuesta se pierde. El
    # identificador del cliente convierte ese reintento en una lectura de la serie ya
    # creada, evitando duplicarla.
    if data.client_request_id is not None:
        serie_existente = await db.scalar(
            select(SerieFuerza)
            .join(EntrenamientoFuerza)
            .join(Entrenamiento)
            .where(SerieFuerza.client_request_id == data.client_request_id)
            .options(
                serie_options,
                selectinload(SerieFuerza.entrenamiento_fuerza)
                .selectinload(EntrenamientoFuerza.entrenamiento),
            )
        )
        if serie_existente is not None:
            if serie_existente.entrenamiento_fuerza.entrenamiento.id_usuario != id_usuario:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="El identificador de la solicitud ya fue utilizado.",
                )
            return serie_existente

    entreno_activo = (
        await db.execute(
            select(EntrenamientoFuerza)
            .join(Entrenamiento)
            .where(
                Entrenamiento.id_usuario == id_usuario,
                EntrenamientoFuerza.estado == EstadoEntreno.ACTIVO
            )
        )
    ).scalar_one_or_none()

    if not entreno_activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No tienes entrenamientos activos."
        )

    ejercicio = await db.scalar(
        select(Ejercicios).where(Ejercicios.id_ejercicio == data.id_ejercicio)
    )
    if not ejercicio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ejercicio no encontrado."
        )

    serie_fuerza = SerieFuerza(
        id_entrenamiento_fuerza=entreno_activo.id_entrenamiento_fuerza,
        id_ejercicio=data.id_ejercicio,
        es_calentamiento=data.es_calentamiento,
        cantidad_peso=data.cantidad_peso,
        repeticiones=data.repeticiones,
        client_request_id=data.client_request_id,
    )

    db.add(serie_fuerza)

    try:
        await db.flush()
    except IntegrityError:
        # Dos requests con la misma clave llegaron a la vez: la restriccion unica gano la
        # carrera, asi que se descarta este intento y se devuelve el que sí se guardo.
        await db.rollback()
        if data.client_request_id is None:
            raise
        serie_fuerza = await db.scalar(
            select(SerieFuerza)
            .where(SerieFuerza.client_request_id == data.client_request_id)
            .options(serie_options)
        )
        if serie_fuerza is None:
            raise
        return serie_fuerza

    serie_fuerza = await db.scalar(
        select(SerieFuerza)
        .where(SerieFuerza.id_fuerza_detalle == serie_fuerza.id_fuerza_detalle)
        .options(serie_options)
    )

    return serie_fuerza


@router.patch(
    path="/{id_fuerza_detalle}",
    response_model=SerieFuerzaResponse,
    status_code=status.HTTP_200_OK
)
async def editar_serie_fuerza(
    id_fuerza_detalle: int,
    data: SerieFuerzaPatch,
    user = Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db)
):
    usuario = await obtener_usuario_actual(user, db)

    serie_fuerza = await obtener_serie_usuario_activa(
        id_fuerza_detalle=id_fuerza_detalle,
        id_usuario=usuario.id_usuario,
        db=db
    )

    if not serie_fuerza:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Serie no encontrada o no pertenece a una sesión activa."
        )

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se enviaron campos para actualizar."
        )

    if "id_ejercicio" in update_data:
        ejercicio = await db.scalar(
            select(Ejercicios).where(Ejercicios.id_ejercicio == update_data["id_ejercicio"])
        )
        if not ejercicio:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ejercicio no encontrado."
            )

    for field, value in update_data.items():
        setattr(serie_fuerza, field, value)

    await db.flush()
    return await obtener_serie_usuario_activa(
        id_fuerza_detalle=id_fuerza_detalle,
        id_usuario=usuario.id_usuario,
        db=db,
    )


@router.delete(
    path="/{id_fuerza_detalle}",
    status_code=status.HTTP_204_NO_CONTENT
)
async def eliminar_serie_fuerza(
    id_fuerza_detalle: int,
    user = Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db)
):
    usuario = await obtener_usuario_actual(user, db)

    serie_fuerza = await obtener_serie_usuario_activa(
        id_fuerza_detalle=id_fuerza_detalle,
        id_usuario=usuario.id_usuario,
        db=db
    )

    if not serie_fuerza:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Serie no encontrada o no pertenece a una sesión activa."
        )

    await db.delete(serie_fuerza)
