"""Reglas de categoría: qué patrón gana."""
from app.services.finanzas.reglas import elegir_categoria, normalizar_texto


SUPER, COMIDA, TRANSPORTE = 1, 2, 3
REGLAS = [("tottus", SUPER), ("uber", TRANSPORTE), ("UBER EATS", COMIDA), ("bipqr", TRANSPORTE)]


def test_normaliza_mayusculas_tildes_y_espacios():
    assert normalizar_texto("  Almacén   DON José ") == "almacen don jose"


def test_gana_el_patron_mas_largo():
    assert elegir_categoria(REGLAS, "PAYU UBER EATS SANTIAGO CHL") == COMIDA
    assert elegir_categoria(REGLAS, "PAYU UBER TRIP SANTIAGO CHL") == TRANSPORTE


def test_busca_en_cualquiera_de_los_textos():
    assert elegir_categoria(REGLAS, None, "TOTTUS HUECHURABA SANTIAGO CHL") == SUPER
    assert elegir_categoria(REGLAS, "Pago RECARGA BIPQR CL") == TRANSPORTE


def test_sin_calce_ni_texto_no_elige():
    assert elegir_categoria(REGLAS, "JUMBO COSTANERA") is None
    assert elegir_categoria(REGLAS, None, "") is None
    assert elegir_categoria([], "TOTTUS") is None
