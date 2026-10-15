from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.db.session import AsyncSessionLocal
from app.routes.entrenamientos.fuerza import activar_entrenamiento, finalizar_sesion_fuerza
from app.schemas.entrenamientos import EntrenoFuerzaCierre, EntrenoFuerzaCreate
from tests.test_entrenamiento_fuerza_idempotencia import _crear_gimnasio, _crear_usuario


async def _abrir(db, user, gimnasio, inicio_at=None):
    return await activar_entrenamiento(
        data=EntrenoFuerzaCreate(id_gimnasio=gimnasio.id_gimnasio, inicio_at=inicio_at),
        user=user,
        db=db,
    )


@pytest.mark.asyncio(loop_scope="session")
async def test_entreno_encolado_conserva_sus_horas_reales():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]
            _, user = await _crear_usuario(db, seed)
            gimnasio = await _crear_gimnasio(db, seed)
            inicio = datetime.now(timezone.utc) - timedelta(hours=3)
            fin = inicio + timedelta(minutes=75)

            abierto = await _abrir(db, user, gimnasio, inicio)
            cerrado = await finalizar_sesion_fuerza(
                data=EntrenoFuerzaCierre(client_request_id=uuid4(), fin_at=fin),
                user=user,
                db=db,
            )

            assert abierto.inicio_at == inicio
            assert cerrado.fin_at == fin
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_hora_futura_se_acota_y_el_cierre_no_precede_al_inicio():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]
            _, user = await _crear_usuario(db, seed)
            gimnasio = await _crear_gimnasio(db, seed)
            antes = datetime.now(timezone.utc)

            # Reloj del telefono adelantado una hora.
            abierto = await _abrir(db, user, gimnasio, antes + timedelta(hours=1))
            assert abierto.inicio_at <= datetime.now(timezone.utc)

            cerrado = await finalizar_sesion_fuerza(
                data=EntrenoFuerzaCierre(
                    client_request_id=uuid4(), fin_at=abierto.inicio_at - timedelta(hours=2)
                ),
                user=user,
                db=db,
            )
            assert cerrado.fin_at == abierto.inicio_at
        finally:
            await trans.rollback()


@pytest.mark.asyncio(loop_scope="session")
async def test_hora_demasiado_antigua_se_acota_a_siete_dias():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]
            _, user = await _crear_usuario(db, seed)
            gimnasio = await _crear_gimnasio(db, seed)

            abierto = await _abrir(
                db, user, gimnasio, datetime.now(timezone.utc) - timedelta(days=40)
            )

            assert datetime.now(timezone.utc) - abierto.inicio_at <= timedelta(days=7, minutes=1)
        finally:
            await trans.rollback()
