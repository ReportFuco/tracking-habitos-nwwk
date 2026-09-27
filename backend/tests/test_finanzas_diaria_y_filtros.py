"""Gasto diario, filtros del listado y PATCH ampliado de movimientos (sin DB)."""
from datetime import date, datetime
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.models.finanzas import EnumTipoMovimiento
from app.routes.finanzas.analitica import agrupar_por_dia
from app.routes.finanzas.movimientos import filtros_listado_movimientos, rango_mes
from app.schemas.finanzas import MovimientoPatch


def mov(dia: int, monto: int, tipo=EnumTipoMovimiento.GASTO, mes: int = 9):
    return SimpleNamespace(created_at=datetime(2026, mes, dia, 12, 0), monto=monto, tipo_movimiento=tipo)


def test_agrupa_por_dia_y_calcula_promedio_sobre_dias_transcurridos():
    movimientos = [mov(1, 1000), mov(1, 500), mov(3, 9000), mov(3, 850000, EnumTipoMovimiento.INGRESO)]

    resultado = agrupar_por_dia(movimientos, 2026, 9, hoy=date(2026, 9, 4))

    assert resultado.dias_mes == 30
    assert len(resultado.items) == 30
    assert resultado.dias_transcurridos == 4
    assert resultado.items[0].gasto_total == 1500
    assert resultado.items[0].cantidad_movimientos == 2
    assert resultado.items[2].ingreso_total == 850000
    assert resultado.gasto_total == 10500
    assert resultado.promedio_gasto_diario == pytest.approx(10500 / 4)
    assert resultado.dia_mayor_gasto.dia == 3
    assert resultado.items[4].es_futuro is True
    assert resultado.items[3].es_futuro is False


def test_mes_pasado_cuenta_todos_los_dias_y_mes_futuro_ninguno():
    pasado = agrupar_por_dia([mov(10, 3000, mes=2)], 2026, 2, hoy=date(2026, 9, 26))
    futuro = agrupar_por_dia([], 2026, 12, hoy=date(2026, 9, 26))

    assert pasado.dias_mes == 28
    assert pasado.dias_transcurridos == 28
    assert not any(item.es_futuro for item in pasado.items)
    assert futuro.dias_transcurridos == 0
    assert futuro.promedio_gasto_diario is None
    assert futuro.dia_mayor_gasto is None


def test_rango_mes_cruza_el_anio():
    assert rango_mes(2026, 12) == (datetime(2026, 12, 1), datetime(2027, 1, 1))
    assert rango_mes(2026, 2) == (datetime(2026, 2, 1), datetime(2026, 3, 1))


def test_filtros_se_agregan_solo_si_vienen():
    sin_filtros = filtros_listado_movimientos(
        year=None, month=None, tipo_movimiento=None, id_categoria=None, id_cuenta=None, q=None
    )
    todos = filtros_listado_movimientos(
        year=2026, month=9, tipo_movimiento=EnumTipoMovimiento.GASTO, id_categoria=3, id_cuenta=1, q="farmacia"
    )

    assert sin_filtros == []
    # mes = 2 condiciones (desde/hasta) + tipo + categoria + cuenta + texto
    assert len(todos) == 6


def test_patch_permite_editar_nota_y_fecha():
    patch = MovimientoPatch(descripcion="Farmacia", created_at="2026-09-20T10:00:00")

    assert patch.model_dump(exclude_unset=True) == {
        "descripcion": "Farmacia",
        "created_at": datetime(2026, 9, 20, 10, 0),
    }


def test_patch_null_en_descripcion_la_borra_pero_no_en_fecha():
    assert MovimientoPatch(descripcion=None).model_dump(exclude_unset=True) == {"descripcion": None}
    with pytest.raises(ValidationError):
        MovimientoPatch(created_at=None)
