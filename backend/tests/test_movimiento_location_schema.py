from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.models.finanzas import EnumTipoGasto, EnumTipoMovimiento
from app.schemas.finanzas import MovimientoCreate


def movimiento_base(**overrides):
    data = {
        "client_request_id": uuid4(),
        "id_categoria": 1,
        "id_cuenta": 1,
        "tipo_movimiento": EnumTipoMovimiento.GASTO,
        "tipo_gasto": EnumTipoGasto.VARIABLE,
        "monto": 5000,
    }
    data.update(overrides)
    return data


def test_movimiento_presencial_requiere_ubicacion_completa():
    with pytest.raises(ValidationError):
        MovimientoCreate(**movimiento_base(en_lugar_compra=True))

    movimiento = MovimientoCreate(
        **movimiento_base(
            en_lugar_compra=True,
            latitud=-33.456,
            longitud=-70.648,
            precision_ubicacion=12.5,
        )
    )

    assert movimiento.en_lugar_compra is True
    assert movimiento.precision_ubicacion == 12.5


def test_pago_no_presencial_no_acepta_coordenadas():
    with pytest.raises(ValidationError):
        MovimientoCreate(
            **movimiento_base(
                en_lugar_compra=False,
                latitud=-33.456,
                longitud=-70.648,
                precision_ubicacion=12.5,
            )
        )


def test_ubicacion_de_compra_no_aplica_a_ingresos():
    with pytest.raises(ValidationError):
        MovimientoCreate(
            **movimiento_base(
                tipo_movimiento=EnumTipoMovimiento.INGRESO,
                en_lugar_compra=True,
                latitud=-33.456,
                longitud=-70.648,
                precision_ubicacion=12.5,
            )
        )
