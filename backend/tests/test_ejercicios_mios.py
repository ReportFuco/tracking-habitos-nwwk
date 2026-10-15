from uuid import uuid4

import pytest
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models import Ejercicios
from app.routes.entrenamientos.ejercicios import obtener_ejercicios_usados
from app.routes.entrenamientos.fuerza import activar_entrenamiento
from app.routes.entrenamientos.series_fuerza import agregar_serie_fuerza
from app.schemas.entrenamientos import EntrenoFuerzaCreate, SerieFuerzaCreate
from tests.test_entrenamiento_fuerza_idempotencia import _crear_gimnasio, _crear_usuario


async def _dos_ejercicios(db) -> list[Ejercicios]:
    ejercicios = (await db.execute(select(Ejercicios).limit(2))).scalars().all()
    if len(ejercicios) < 2:
        pytest.skip("requiere catalogo de ejercicios sembrado -- correr alembic upgrade head")
    return list(ejercicios)


async def _serie(db, user, id_ejercicio: int, peso: float, reps: int, calentamiento=False):
    await agregar_serie_fuerza(
        data=SerieFuerzaCreate(
            id_ejercicio=id_ejercicio,
            cantidad_peso=peso,
            repeticiones=reps,
            es_calentamiento=calentamiento,
        ),
        user=user,
        db=db,
    )


@pytest.mark.asyncio(loop_scope="session")
async def test_mios_cuenta_series_y_toma_la_ultima_serie_efectiva():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]
            _, user = await _crear_usuario(db, seed)
            gimnasio = await _crear_gimnasio(db, seed)
            press, remo = await _dos_ejercicios(db)

            await activar_entrenamiento(
                data=EntrenoFuerzaCreate(id_gimnasio=gimnasio.id_gimnasio), user=user, db=db
            )
            await _serie(db, user, press.id_ejercicio, 60, 10)
            await _serie(db, user, press.id_ejercicio, 70, 8)
            # Un calentamiento posterior no debe pisar la carga sugerida.
            await _serie(db, user, press.id_ejercicio, 20, 15, calentamiento=True)
            await _serie(db, user, remo.id_ejercicio, 20, 12, calentamiento=True)

            usos = {uso.id_ejercicio: uso for uso in await obtener_ejercicios_usados(db=db, user=user)}

            assert set(usos) == {press.id_ejercicio, remo.id_ejercicio}
            assert usos[press.id_ejercicio].series == 3
            assert usos[press.id_ejercicio].ultimo_peso == 70
            assert usos[press.id_ejercicio].ultimas_repeticiones == 8
            # Solo calentamientos: no hay carga que sugerir.
            assert usos[remo.id_ejercicio].ultimo_peso is None
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_mios_no_mezcla_usuarios():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]
            _, user = await _crear_usuario(db, seed)
            _, otro = await _crear_usuario(db, uuid4().hex[:8])
            gimnasio = await _crear_gimnasio(db, seed)
            press, _ = await _dos_ejercicios(db)

            await activar_entrenamiento(
                data=EntrenoFuerzaCreate(id_gimnasio=gimnasio.id_gimnasio), user=user, db=db
            )
            await _serie(db, user, press.id_ejercicio, 60, 10)

            assert await obtener_ejercicios_usados(db=db, user=otro) == []
        finally:
            await trans.rollback()
