"""AUD-003: el PATCH de movimientos no puede romper las invariantes del alta."""
import pytest
from pydantic import ValidationError

from app.models.finanzas import EnumTipoGasto, EnumTipoMovimiento, Movimiento
from app.routes.finanzas.movimientos import aplicar_patch_movimiento
from app.schemas.finanzas import MovimientoPatch


@pytest.mark.parametrize("monto", [0, -100])
def test_patch_rechaza_monto_no_positivo(monto):
    with pytest.raises(ValidationError):
        MovimientoPatch(monto=monto)


@pytest.mark.parametrize(
    "campo", ["monto", "tipo_movimiento", "tipo_gasto", "id_categoria", "id_cuenta"]
)
def test_patch_rechaza_null_explicito(campo):
    with pytest.raises(ValidationError):
        MovimientoPatch(**{campo: None})


def test_patch_parcial_sigue_permitido():
    patch = MovimientoPatch(monto=2500)

    assert patch.model_dump(exclude_unset=True) == {"monto": 2500}


def gasto_presencial() -> Movimiento:
    return Movimiento(
        id_categoria=1,
        id_cuenta=1,
        tipo_movimiento=EnumTipoMovimiento.GASTO,
        tipo_gasto=EnumTipoGasto.VARIABLE,
        monto=5000,
        en_lugar_compra=True,
        latitud=-33.45,
        longitud=-70.66,
        precision_ubicacion=10.0,
    )


def test_gasto_presencial_convertido_en_ingreso_pierde_ubicacion():
    movimiento = gasto_presencial()

    aplicar_patch_movimiento(movimiento, {"tipo_movimiento": EnumTipoMovimiento.INGRESO})

    assert movimiento.tipo_movimiento == EnumTipoMovimiento.INGRESO
    assert movimiento.en_lugar_compra is False
    assert (movimiento.latitud, movimiento.longitud, movimiento.precision_ubicacion) == (
        None,
        None,
        None,
    )


def test_gasto_presencial_editado_conserva_ubicacion():
    movimiento = gasto_presencial()

    aplicar_patch_movimiento(movimiento, {"monto": 7000})

    assert movimiento.monto == 7000
    assert movimiento.en_lugar_compra is True
    assert movimiento.latitud == -33.45
