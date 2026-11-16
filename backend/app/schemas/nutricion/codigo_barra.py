from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from ._tipos import Numero


class CodigoBarraResponse(BaseModel):
    """Lo que se sabe de un código de barras.

    ``origen='catalogo'``: es un producto de Ritmo (``id_producto``), y sus calorías se
    calculan con su tabla al anotarlo. ``origen='openfoodfacts'``: no está en el catálogo;
    se anota como alimento libre con las calorías calculadas desde estos valores, que son
    por ``porcion_cantidad`` ``porcion_unidad`` (100 g o 100 ml).
    """

    origen: Literal["catalogo", "openfoodfacts"]
    codigo: str
    id_producto: Optional[int]
    nombre: str
    marca: Optional[str]
    porcion_cantidad: Optional[Numero]
    porcion_unidad: Optional[str]
    contenido_neto: Optional[Numero]
    unidad_contenido: Optional[str]
    calorias: Optional[Numero]
    proteinas: Optional[Numero]
    carbohidratos: Optional[Numero]
    grasas: Optional[Numero]
    fuente_nutricional: Optional[Literal["tabla", "openfoodfacts"]] = Field(
        default=None,
        description=(
            "De dónde salen las calorías: la tabla del catálogo, Open Food Facts (también para "
            "un producto del catálogo que aún no tiene tabla) o None si no se conocen."
        ),
    )

    model_config = ConfigDict(title="Producto por codigo de barras")
