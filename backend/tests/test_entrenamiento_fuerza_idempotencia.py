from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models import Ejercicios, EntrenamientoFuerza, Gimnasio, SerieFuerza, User, Usuario
from app.routes.entrenamientos.fuerza import activar_entrenamiento, finalizar_sesion_fuerza
from app.routes.entrenamientos.series_fuerza import agregar_serie_fuerza
from app.schemas.entrenamientos import EntrenoFuerzaCierre, EntrenoFuerzaCreate, SerieFuerzaCreate


async def _crear_usuario(db, seed: str):
    auth = User(
        email=f"fuerza_{seed}@mail.com",
        hashed_password="x",
        is_active=True,
        is_superuser=False,
        is_verified=False,
    )
    db.add(auth)
    await db.flush()

    perfil = Usuario(
        auth_user_id=auth.id,
        username=f"fuerza_{seed}",
        nombre="Fuerza",
        apellido="Test",
        telefono=f"569{seed[:8]}",
        email=auth.email,
    )
    db.add(perfil)
    await db.flush()

    return perfil, SimpleNamespace(id=auth.id)


async def _crear_gimnasio(db, seed: str) -> Gimnasio:
    gimnasio = Gimnasio(
        nombre_gimnasio=f"Gimnasio {seed}",
        latitud=-33.4,
        longitud=-70.6,
        activo=True,
    )
    db.add(gimnasio)
    await db.flush()
    return gimnasio


async def _obtener_ejercicio(db) -> Ejercicios:
    ejercicio = await db.scalar(select(Ejercicios).limit(1))
    if ejercicio is None:
        pytest.skip("requiere catalogo de ejercicios sembrado -- correr alembic upgrade head")
    return ejercicio


@pytest.mark.asyncio(loop_scope="session")
async def test_abrir_entrenamiento_misma_clave_no_duplica():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]
            _, user = await _crear_usuario(db, seed)
            gimnasio = await _crear_gimnasio(db, seed)
            clave = uuid4()

            primero = await activar_entrenamiento(
                data=EntrenoFuerzaCreate(id_gimnasio=gimnasio.id_gimnasio, client_request_id=clave),
                user=user,
                db=db,
            )
            segundo = await activar_entrenamiento(
                data=EntrenoFuerzaCreate(id_gimnasio=gimnasio.id_gimnasio, client_request_id=clave),
                user=user,
                db=db,
            )

            assert primero.id_entrenamiento_fuerza == segundo.id_entrenamiento_fuerza

            filas = (
                await db.execute(
                    select(EntrenamientoFuerza).where(
                        EntrenamientoFuerza.client_request_id == clave
                    )
                )
            ).scalars().all()
            assert len(filas) == 1
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_abrir_con_clave_distinta_sigue_dando_409_si_hay_uno_activo():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]
            _, user = await _crear_usuario(db, seed)
            gimnasio = await _crear_gimnasio(db, seed)

            await activar_entrenamiento(
                data=EntrenoFuerzaCreate(id_gimnasio=gimnasio.id_gimnasio, client_request_id=uuid4()),
                user=user,
                db=db,
            )

            with pytest.raises(HTTPException) as exc:
                await activar_entrenamiento(
                    data=EntrenoFuerzaCreate(
                        id_gimnasio=gimnasio.id_gimnasio, client_request_id=uuid4()
                    ),
                    user=user,
                    db=db,
                )
            assert exc.value.status_code == 409
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_cerrar_dos_veces_misma_clave_no_falla():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]
            _, user = await _crear_usuario(db, seed)
            gimnasio = await _crear_gimnasio(db, seed)

            await activar_entrenamiento(
                data=EntrenoFuerzaCreate(id_gimnasio=gimnasio.id_gimnasio),
                user=user,
                db=db,
            )

            clave_cierre = uuid4()
            primero = await finalizar_sesion_fuerza(
                data=EntrenoFuerzaCierre(client_request_id=clave_cierre),
                user=user,
                db=db,
            )
            segundo = await finalizar_sesion_fuerza(
                data=EntrenoFuerzaCierre(client_request_id=clave_cierre),
                user=user,
                db=db,
            )

            assert primero.id_entrenamiento_fuerza == segundo.id_entrenamiento_fuerza
            assert primero.fin_at == segundo.fin_at
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_cerrar_con_clave_nueva_sin_activo_da_404():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]
            _, user = await _crear_usuario(db, seed)

            with pytest.raises(HTTPException) as exc:
                await finalizar_sesion_fuerza(
                    data=EntrenoFuerzaCierre(client_request_id=uuid4()),
                    user=user,
                    db=db,
                )
            assert exc.value.status_code == 404
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_agregar_serie_misma_clave_no_duplica():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]
            _, user = await _crear_usuario(db, seed)
            gimnasio = await _crear_gimnasio(db, seed)
            ejercicio = await _obtener_ejercicio(db)

            await activar_entrenamiento(
                data=EntrenoFuerzaCreate(id_gimnasio=gimnasio.id_gimnasio),
                user=user,
                db=db,
            )

            clave = uuid4()
            payload = SerieFuerzaCreate(
                id_ejercicio=ejercicio.id_ejercicio,
                es_calentamiento=False,
                cantidad_peso=40,
                repeticiones=10,
                client_request_id=clave,
            )

            primera = await agregar_serie_fuerza(data=payload, user=user, db=db)
            segunda = await agregar_serie_fuerza(data=payload, user=user, db=db)

            assert primera.id_fuerza_detalle == segunda.id_fuerza_detalle

            filas = (
                await db.execute(
                    select(SerieFuerza).where(SerieFuerza.client_request_id == clave)
                )
            ).scalars().all()
            assert len(filas) == 1
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_agregar_series_claves_distintas_crea_dos_filas_en_orden():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]
            _, user = await _crear_usuario(db, seed)
            gimnasio = await _crear_gimnasio(db, seed)
            ejercicio = await _obtener_ejercicio(db)

            await activar_entrenamiento(
                data=EntrenoFuerzaCreate(id_gimnasio=gimnasio.id_gimnasio),
                user=user,
                db=db,
            )

            primera = await agregar_serie_fuerza(
                data=SerieFuerzaCreate(
                    id_ejercicio=ejercicio.id_ejercicio,
                    es_calentamiento=False,
                    cantidad_peso=40,
                    repeticiones=10,
                    client_request_id=uuid4(),
                ),
                user=user,
                db=db,
            )
            segunda = await agregar_serie_fuerza(
                data=SerieFuerzaCreate(
                    id_ejercicio=ejercicio.id_ejercicio,
                    es_calentamiento=False,
                    cantidad_peso=45,
                    repeticiones=8,
                    client_request_id=uuid4(),
                ),
                user=user,
                db=db,
            )

            assert primera.id_fuerza_detalle != segunda.id_fuerza_detalle
            assert primera.id_fuerza_detalle < segunda.id_fuerza_detalle
        finally:
            await trans.rollback()
