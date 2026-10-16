from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.db.session import AsyncSessionLocal
from app.routes.entrenamientos.fuerza import activar_entrenamiento
from app.routes.entrenamientos.series_fuerza import agregar_serie_fuerza, editar_serie_fuerza
from app.schemas.entrenamientos import (
    EntrenoFuerzaCreate,
    SerieFuerzaCreate,
    SerieFuerzaPatch,
    SerieFuerzaResponse,
)
from tests.test_entrenamiento_fuerza_idempotencia import (
    _crear_gimnasio,
    _crear_usuario,
    _obtener_ejercicio,
)


def test_negativas_por_defecto_en_cero():
    payload = SerieFuerzaCreate(id_ejercicio=1, es_calentamiento=False, cantidad_peso=80, repeticiones=4)

    assert payload.repeticiones_negativas == 0


@pytest.mark.parametrize("valor", [-1, 51])
def test_negativas_fuera_de_rango(valor):
    with pytest.raises(ValidationError):
        SerieFuerzaCreate(
            id_ejercicio=1,
            es_calentamiento=False,
            cantidad_peso=80,
            repeticiones=4,
            repeticiones_negativas=valor,
        )


@pytest.mark.asyncio(loop_scope="session")
async def test_crear_y_editar_negativas():
    async with AsyncSessionLocal() as db:
        trans = await db.begin()
        try:
            seed = uuid4().hex[:8]
            _, user = await _crear_usuario(db, seed)
            gimnasio = await _crear_gimnasio(db, seed)
            ejercicio = await _obtener_ejercicio(db)
            await activar_entrenamiento(
                data=EntrenoFuerzaCreate(id_gimnasio=gimnasio.id_gimnasio), user=user, db=db
            )

            serie = await agregar_serie_fuerza(
                data=SerieFuerzaCreate(
                    id_ejercicio=ejercicio.id_ejercicio,
                    es_calentamiento=False,
                    cantidad_peso=80,
                    repeticiones=4,
                    repeticiones_negativas=2,
                ),
                user=user,
                db=db,
            )
            respuesta = SerieFuerzaResponse.model_validate(serie)
            assert respuesta.repeticiones_negativas == 2
            assert respuesta.equipamiento_ejercicio == ejercicio.equipamiento

            # Un null explicito no borra el valor (la columna no admite NULL).
            serie = await editar_serie_fuerza(
                id_fuerza_detalle=serie.id_fuerza_detalle,
                data=SerieFuerzaPatch(repeticiones=5, repeticiones_negativas=None),
                user=user,
                db=db,
            )
            assert (serie.repeticiones, serie.repeticiones_negativas) == (5, 2)

            serie = await editar_serie_fuerza(
                id_fuerza_detalle=serie.id_fuerza_detalle,
                data=SerieFuerzaPatch(repeticiones_negativas=0),
                user=user,
                db=db,
            )
            assert serie.repeticiones_negativas == 0
        finally:
            await trans.rollback()
