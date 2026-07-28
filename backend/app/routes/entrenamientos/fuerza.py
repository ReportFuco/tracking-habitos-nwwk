from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.fastapi_users import current_user_or_api_key
from app.db.session import get_db
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime
from app.schemas.entrenamientos import (
    EntrenoFuerzaResponse, 
    EntrenoFuerzaCreate, 
    EntrenoFuerzaSerieResponse
)
from app.models import (
    EntrenamientoFuerza, 
    Entrenamiento,
    Usuario,
    Gimnasio,
    EnumTipoEntrenamiento as TipoEntreno,
    EnumEstadoEntrenamiento as EstadoEntreno,
    SerieFuerza,
    Ejercicios,
    SubcategoriaMusculo,
)


router = APIRouter(prefix="/fuerza", tags=["Entrenamientos · Fuerza"])


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
    summary="Obtener entrenamientos de fuerza del Usuario",
    description="Obtiene las sesiones de fuerza realizadas por el usuario",
    response_model=list[EntrenoFuerzaResponse],
    status_code=status.HTTP_200_OK
)
async def obtener_entrenamientos_usuario(
    db: AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key)
):
    usuario = await obtener_usuario_actual(user, db)
    
    entreno_fuerza = (
        await db.execute(
                select(EntrenamientoFuerza)
                .join(Entrenamiento)
                .where(Entrenamiento.id_usuario == usuario.id_usuario)
                .options(selectinload(EntrenamientoFuerza.gimnasio))
        )
    ).scalars().all()

    return entreno_fuerza


@router.get(
    path="/activo",
    summary="Ver entrenamiento activo",
    response_model=EntrenoFuerzaSerieResponse,
    description="Devuelve el Entrenamiento activo, mostrando las series realizadas e información relevante",
    status_code=status.HTTP_200_OK
)
async def obtener_entrenamiento_activo(
    user = Depends(current_user_or_api_key), 
    db:AsyncSession = Depends(get_db)
):
    usuario = await obtener_usuario_actual(user, db)
    
    entreno_activo = (
        await db.execute(
            select(EntrenamientoFuerza)
            .join(Entrenamiento)
            .where(
                Entrenamiento.id_usuario == usuario.id_usuario,
                EntrenamientoFuerza.estado == EstadoEntreno.ACTIVO
            )
            .options(
                selectinload(EntrenamientoFuerza.gimnasio),
                selectinload(EntrenamientoFuerza.series)
                    .selectinload(SerieFuerza.ejercicio)
                    .selectinload(Ejercicios.subcategoria_musculo)
                    .selectinload(SubcategoriaMusculo.musculo)
            )
        )
    ).scalar_one_or_none()

    if not entreno_activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Usuario sin sessiones activas."
        )

    return entreno_activo

@router.get(
    path="/{id_entrenamiento_fuerza}",
    summary="Obtener detalle del entrenamiento de Fuerza",
    response_model=EntrenoFuerzaSerieResponse,
    description="Se obtiene el detalle del entrenamiento en especifico, retornando los detalles generales como series, lugar de entreno entre otros",
    status_code=status.HTTP_200_OK
)
async def obtener_detalle_entreno_fuerza(
    id_entrenamiento_fuerza:int,
    db: AsyncSession = Depends(get_db),
    user = Depends(current_user_or_api_key)
):
    usuario = await obtener_usuario_actual(user, db)

    query_entreno_fuerza = (
        await db.execute(
            select(EntrenamientoFuerza)
            .join(Entrenamiento)
            .where(
                EntrenamientoFuerza.id_entrenamiento_fuerza == id_entrenamiento_fuerza,
                Entrenamiento.id_usuario == usuario.id_usuario
            )
            .options(
                selectinload(EntrenamientoFuerza.gimnasio),
                selectinload(EntrenamientoFuerza.series)
                    .selectinload(SerieFuerza.ejercicio)
                    .selectinload(Ejercicios.subcategoria_musculo)
                    .selectinload(SubcategoriaMusculo.musculo)
            )
        )
    ).scalar_one_or_none()

    if not query_entreno_fuerza:
        raise HTTPException(
            status_code=404,
            detail="Entrenamiento no encontrado"
        )

    return query_entreno_fuerza


@router.post(
    path="/",
    response_model=EntrenoFuerzaResponse,
    summary="Iniciar entrenamiento de Fuerza",
    description="Inicia una sesión de entrenamiento para poder ingresar las series de entrenamientos",
    status_code=201
)
async def activar_entrenamiento(
    data:EntrenoFuerzaCreate,
    user = Depends(current_user_or_api_key),
    db: AsyncSession = Depends(get_db)
):
    usuario = await obtener_usuario_actual(user, db)
    
    existe = (
        await db.execute(
            select(EntrenamientoFuerza)
            .join(Entrenamiento)
            .where(
                Entrenamiento.id_usuario == usuario.id_usuario,
                EntrenamientoFuerza.estado == EstadoEntreno.ACTIVO
            )
        )
    ).scalar_one_or_none()

    if existe:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un entrenamiento de fuerza activo"
        )

    gimnasio = await db.scalar(
        select(Gimnasio).where(
            Gimnasio.id_gimnasio == data.id_gimnasio,
            Gimnasio.activo.is_(True)
        )
    )
    if not gimnasio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gimnasio no encontrado o inactivo."
        )

    entreno = Entrenamiento(
        id_usuario=usuario.id_usuario,
        tipo_entrenamiento=TipoEntreno.FUERZA,
        observacion=data.observacion
    )
    db.add(entreno)
    await db.flush()

    entreno_fuerza = EntrenamientoFuerza(
        id_entrenamiento=entreno.id_entrenamiento,
        id_gimnasio=data.id_gimnasio
    )

    db.add(entreno_fuerza)
    await db.flush()

    entreno_fuerza = (
        await db.execute(
            select(EntrenamientoFuerza)
            .where(
                EntrenamientoFuerza.id_entrenamiento_fuerza
                == entreno_fuerza.id_entrenamiento_fuerza
            )
            .options(selectinload(EntrenamientoFuerza.gimnasio))
        )
    ).scalar_one()

    return entreno_fuerza


@router.patch(
    path="/activo/cerrar",
    response_model=EntrenoFuerzaResponse
)
async def finalizar_sesion_fuerza(
    user = Depends(current_user_or_api_key),
    db:AsyncSession=Depends(get_db)
):
    usuario = await obtener_usuario_actual(user, db)
    
    entreno_activo = (
        await db.execute(
            select(EntrenamientoFuerza)
            .where(
                EntrenamientoFuerza.entrenamiento.has(
                    Entrenamiento.id_usuario == usuario.id_usuario
                ),
                EntrenamientoFuerza.estado == EstadoEntreno.ACTIVO
            ).options(
                selectinload(EntrenamientoFuerza.gimnasio)
            )

        )
    ).scalar_one_or_none()

    if not entreno_activo:
        raise HTTPException(
            status_code=404, 
            detail="No tienes sesiones activas."
        )

    entreno_activo.estado = EstadoEntreno.CERRADO
    entreno_activo.fin_at = datetime.now()

    await db.flush()
    await db.refresh(entreno_activo)

    return EntrenoFuerzaResponse.model_validate(entreno_activo)
