"""Cálculo de calorías por línea de consumo (sin base de datos)."""
from decimal import Decimal
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.schemas.nutricion import ConsumoDetalleItem
from app.services.nutricion import factor_porcion, normalizar_unidad, nutrientes_de_tabla


def tabla(cantidad="100", unidad="g", calorias="250", proteinas="10", carbohidratos="30", grasas=None):
    return SimpleNamespace(
        porcion_cantidad=Decimal(cantidad) if cantidad else None,
        porcion_unidad=unidad,
        calorias=Decimal(calorias) if calorias else None,
        proteinas=Decimal(proteinas) if proteinas else None,
        carbohidratos=Decimal(carbohidratos) if carbohidratos else None,
        grasas=Decimal(grasas) if grasas else None,
    )


def producto(contenido=None, unidad=None):
    return SimpleNamespace(contenido_neto=Decimal(contenido) if contenido else None, unidad_contenido=unidad)


def test_unidades_equivalentes():
    assert normalizar_unidad(" Gr. ") == "g"
    assert normalizar_unidad("cc") == "ml"
    assert normalizar_unidad("Porciones") == "porcion"


def test_gramos_contra_tabla_por_100g():
    assert factor_porcion(Decimal("150"), "g", tabla(), None) == Decimal("1.5")
    assert factor_porcion(Decimal("0.25"), "kg", tabla(), None) == Decimal("2.5")


def test_porciones_se_toman_tal_cual():
    assert factor_porcion(Decimal("2"), "porcion", tabla(cantidad=None), None) == Decimal("2")


def test_unidad_usa_contenido_neto_del_producto():
    # Un yogur de 125 g contra una tabla por 100 g.
    assert factor_porcion(Decimal("1"), "unidad", tabla(), producto("125", "g")) == Decimal("1.25")
    # Una botella de 1 L contra una tabla por 200 ml.
    assert factor_porcion(Decimal("1"), "unidad", tabla("200", "ml"), producto("1", "l")) == Decimal("5")


def test_unidades_incompatibles_no_inventan_calorias():
    assert factor_porcion(Decimal("1"), "taza", tabla(), producto("125", "g")) is None
    assert factor_porcion(Decimal("1"), "unidad", tabla(), None) is None



def test_gramos_y_mililitros_se_toman_como_equivalentes():
    # Open Food Facts informa muchas bebidas por 100 g: 500 ml de una de 10 kcal/100 g.
    assert factor_porcion(Decimal("500"), "ml", tabla(), None) == Decimal("5")
    assert factor_porcion(Decimal("1"), "unidad", tabla("100", "g"), producto("1", "l")) == Decimal("10")


def test_nutrientes_escalan_y_respetan_vacios():
    resultado = nutrientes_de_tabla(Decimal("150"), "g", tabla(), None)
    assert resultado == {
        "calorias": Decimal("375.00"),
        "proteinas": Decimal("15.00"),
        "carbohidratos": Decimal("45.00"),
        "grasas": None,
    }


def test_linea_es_producto_o_alimento_libre():
    ConsumoDetalleItem(id_producto=1, cantidad_consumida=1, unidad_consumida="unidad")
    ConsumoDetalleItem(nombre_alimento="Pastel de choclo", cantidad_consumida=1, unidad_consumida="porcion", calorias=650)
    with pytest.raises(ValidationError):
        ConsumoDetalleItem(cantidad_consumida=1, unidad_consumida="g")
    with pytest.raises(ValidationError):
        ConsumoDetalleItem(id_producto=1, nombre_alimento="x", cantidad_consumida=1, unidad_consumida="g")
    with pytest.raises(ValidationError):
        # Un alimento libre sin calorías no suma nada al contador.
        ConsumoDetalleItem(nombre_alimento="Pan", cantidad_consumida=1, unidad_consumida="unidad")
    with pytest.raises(ValidationError):
        ConsumoDetalleItem(nombre_alimento="  ", cantidad_consumida=1, unidad_consumida="unidad", calorias=10)


# --- Código de barras ---------------------------------------------------------------

from app.services.errores import DatosInvalidos  # noqa: E402
from app.services.nutricion.codigo_barra import desde_open_food_facts, normalizar_codigo  # noqa: E402


def test_codigo_se_limpia_y_valida_largo():
    assert normalizar_codigo(" 7802-8007 16579 ") == "7802800716579"
    with pytest.raises(DatosInvalidos):
        normalizar_codigo("123")


def test_open_food_facts_liquido_por_100_ml():
    r = desde_open_food_facts("5449000000996", {
        "status": 1,
        "product": {
            "product_name": "Coca-Cola Original", "brands": "Coca-Cola, Otra",
            "product_quantity": "330", "product_quantity_unit": "ml",
            "nutriments": {"energy-kcal_100g": 44, "carbohydrates_100g": 10.9, "proteins_100g": 0},
        },
    })
    assert r.origen == "openfoodfacts" and r.marca == "Coca-Cola"
    assert (r.porcion_cantidad, r.porcion_unidad, r.contenido_neto) == (Decimal("100"), "ml", Decimal("330.00"))
    assert r.calorias == Decimal("44.00") and r.grasas is None


def test_open_food_facts_prefiere_nombre_en_espanol_y_convierte_kj():
    r = desde_open_food_facts("7800000000001", {
        "status": 1,
        "product": {"product_name": "Crackers", "product_name_es": "Galletas", "nutriments": {"energy_100g": 2092}},
    })
    assert r.nombre == "Galletas" and r.porcion_unidad == "g" and r.calorias == Decimal("500.00")


def test_open_food_facts_sin_producto_o_sin_calorias():
    assert desde_open_food_facts("1", {"status": 0}) is None
    assert desde_open_food_facts("1", {"status": 1, "product": {"product_name": "X", "nutriments": {}}}) is None
