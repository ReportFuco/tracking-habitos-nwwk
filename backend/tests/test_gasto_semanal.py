"""Gasto semanal: qué cuenta, tope diario, comparación a la misma altura y alertas."""
from datetime import date, datetime

from app.notifications.metas import alerta_resumen, alertas_a_enviar
from app.services.finanzas.semanal import (
    ConfigGasto,
    Gasto,
    armar_resumen,
    excluida_por_defecto,
    formato_clp,
    lunes_de,
)


LUNES = date(2026, 10, 12)
COMIDA, TRANSPORTE, TARJETA = 1, 2, 3


def config(**kwargs) -> ConfigGasto:
    base = ConfigGasto(
        nombres={COMIDA: "Alimentación", TRANSPORTE: "Transporte", TARJETA: "Pago tarjeta de crédito"},
        excluidas={TARJETA},
    )
    for clave, valor in kwargs.items():
        setattr(base, clave, valor)
    return base


def gasto(dia: int, monto: int, categoria: int = COMIDA, **kwargs) -> Gasto:
    """``dia`` relativo al lunes de la semana (negativo = semana anterior)."""
    return Gasto(fecha=date.fromordinal(LUNES.toordinal() + dia), monto=monto, id_categoria=categoria, **kwargs)


def test_lunes_de_y_categorias_excluidas_por_defecto():
    assert lunes_de(date(2026, 10, 18)) == LUNES
    assert lunes_de(LUNES) == LUNES
    assert excluida_por_defecto("Pago tarjeta de crédito")
    assert excluida_por_defecto("  pago DE deudas ")
    assert not excluida_por_defecto("Alimentación")
    assert formato_clp(160000) == "$160.000"
    assert formato_clp(-2500) == "−$2.500"


def test_no_cuentan_deudas_ni_categorias_excluidas():
    gastos = [
        gasto(0, 10000),
        gasto(1, 300000, abona_deuda=True),
        gasto(1, 120000, TARJETA),
        gasto(2, 5000, TRANSPORTE),
    ]
    resumen = armar_resumen(gastos, config(), LUNES, hoy=date(2026, 10, 14))

    assert resumen.gasto_semana == 15000
    assert resumen.gasto_excluido == 420000
    assert [dia.gasto_total for dia in resumen.dias] == [10000, 0, 5000, 0, 0, 0, 0]
    assert [dia.es_futuro for dia in resumen.dias] == [False] * 3 + [True] * 4
    assert resumen.dias_transcurridos == 3
    assert resumen.promedio_diario == 5000
    assert resumen.proyeccion_semana == 35000
    assert {c.id_categoria for c in resumen.categorias} == {COMIDA, TRANSPORTE}


def test_tope_diario_reparte_lo_que_queda_entre_los_dias_que_faltan():
    # Meta 70.000; el lunes y martes se gastaron 30.000; hoy miércoles 4.000.
    gastos = [gasto(0, 20000), gasto(1, 10000), gasto(2, 4000)]
    resumen = armar_resumen(gastos, config(meta_semanal=70000), LUNES, hoy=date(2026, 10, 14))

    # Quedaban 40.000 al empezar el miércoles para 5 días: 8.000 diarios.
    assert resumen.disponible_hoy == 8000
    assert resumen.gasto_hoy == 4000
    assert resumen.restante == 36000
    assert round(resumen.porcentaje_meta) == 49
    assert resumen.alertas == []


def test_compara_con_la_semana_anterior_a_la_misma_altura():
    gastos = [
        gasto(-7, 10000),  # lunes anterior
        gasto(-6, 10000),  # martes anterior
        gasto(-2, 50000),  # sábado anterior: aún no comparable un martes
        gasto(0, 15000),
        gasto(1, 15000),
    ]
    resumen = armar_resumen(gastos, config(), LUNES, hoy=date(2026, 10, 13))

    assert resumen.gasto_semana_anterior == 70000
    assert resumen.gasto_semana_anterior_misma_altura == 20000
    assert resumen.variacion_misma_altura == 10000
    assert resumen.variacion_misma_altura_pct == 50
    alerta = resumen.alertas[0]
    assert (alerta.clave, alerta.nivel) == ("2026-10-12:ritmo", "info")


def test_semana_pasada_cuenta_completa_y_sin_alertas():
    gastos = [gasto(0, 90000), gasto(-7, 10000), gasto(-1, 10000)]
    resumen = armar_resumen(gastos, config(meta_semanal=50000), LUNES, hoy=date(2026, 10, 25))

    assert not resumen.es_semana_actual
    assert resumen.dias_transcurridos == 7
    assert resumen.gasto_semana_anterior_misma_altura == 20000
    assert resumen.disponible_hoy is None
    assert resumen.gasto_hoy is None
    assert resumen.alertas == []


def test_alertas_de_meta_semanal_y_presupuesto():
    cfg = config(meta_semanal=100000, presupuestos={COMIDA: 50000, TRANSPORTE: 20000})
    hoy = date(2026, 10, 16)  # viernes

    al_80 = armar_resumen([gasto(0, 45000), gasto(1, 40000, TRANSPORTE)], cfg, LUNES, hoy)
    claves = {alerta.clave: alerta for alerta in al_80.alertas}
    assert claves["2026-10-12:semana:80"].mensaje == "Te quedan $15.000 para 2 días."
    assert claves["2026-10-12:cat:1:80"].nivel == "aviso"
    assert claves["2026-10-12:cat:2:100"].nivel == "excedido"
    # La más grave primero.
    assert al_80.alertas[0].nivel == "excedido"

    pasada = armar_resumen([gasto(0, 110000)], cfg, LUNES, hoy)
    assert pasada.alertas[0].clave == "2026-10-12:semana:100"
    assert "$10.000 sobre la meta" in pasada.alertas[0].mensaje


def test_presupuesto_sin_gasto_aparece_en_categorias():
    cfg = config(presupuestos={TRANSPORTE: 20000})
    resumen = armar_resumen([gasto(0, 5000)], cfg, LUNES, hoy=date(2026, 10, 12))
    transporte = next(c for c in resumen.categorias if c.id_categoria == TRANSPORTE)
    assert transporte.total == 0
    assert transporte.porcentaje_presupuesto == 0


def test_alerta_de_tope_diario_solo_si_la_semana_sigue_bajo_la_meta():
    cfg = config(meta_semanal=70000)
    hoy = date(2026, 10, 13)  # martes: tope 10.000 diarios desde el lunes

    resumen = armar_resumen([gasto(0, 10000), gasto(1, 25000)], cfg, LUNES, hoy)
    dia = next(alerta for alerta in resumen.alertas if alerta.clave == "2026-10-13:dia")
    # Quedaron 35.000 para 5 días.
    assert dia.mensaje.endswith("desde mañana: $7.000 al día.")

    sobre_meta = armar_resumen([gasto(0, 10000), gasto(1, 65000)], cfg, LUNES, hoy)
    assert [alerta.clave for alerta in sobre_meta.alertas] == ["2026-10-12:semana:100"]


def test_push_omite_informativas_y_suma_el_resumen_del_domingo():
    cfg = config(meta_semanal=100000)
    gastos = [gasto(-7, 100000), gasto(0, 85000)]
    domingo = date(2026, 10, 18)
    resumen = armar_resumen(gastos, cfg, LUNES, domingo)

    antes = alertas_a_enviar(resumen, datetime(2026, 10, 18, 19, 59))
    assert [alerta.clave for alerta in antes] == ["2026-10-12:semana:80"]

    despues = alertas_a_enviar(resumen, datetime(2026, 10, 18, 20, 0))
    assert despues[-1].clave == "2026-10-12:resumen"
    assert despues[-1].titulo == "Tu semana: $85.000 de $100.000"
    assert despues[-1].mensaje == "Cumpliste la meta y te sobraron $15.000. 15% menos que la semana pasada."


def test_resumen_sin_meta_compara_con_la_semana_pasada():
    resumen = armar_resumen([gasto(-3, 50000), gasto(2, 60000)], config(), LUNES, date(2026, 10, 18))
    alerta = alerta_resumen(resumen)
    assert alerta.titulo == "Tu semana: $60.000"
    assert alerta.mensaje == "20% más que la semana pasada."
