from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from ._tipos import Numero
from .consumo import ConsumoResponse


class MetaDia(BaseModel):
    """Meta nutricional vigente ese día (objetivos diarios)."""

    id_meta: int
    fecha_inicio: date
    fecha_fin: Optional[date]
    calorias_objetivo: Optional[int]
    proteinas_objetivo: Optional[int]
    carbohidratos_objetivo: Optional[int]
    grasas_objetivo: Optional[int]

    model_config = ConfigDict(from_attributes=True)


class DiaNutricion(BaseModel):
    fecha: date
    cantidad_comidas: int
    calorias: Numero
    proteinas: Numero
    carbohidratos: Numero
    grasas: Numero
    lineas_sin_calorias: int = Field(
        description="Alimentos anotados sin calorías conocidas (producto sin tabla): el total se queda corto."
    )
    meta: Optional[MetaDia]
    calorias_restantes: Optional[Numero] = Field(description="Meta menos lo consumido; negativo si se pasó.")
    comidas: list[ConsumoResponse] = Field(default_factory=list)


class TendenciaNutricion(BaseModel):
    dias: list[DiaNutricion]


class AlimentoCatalogo(BaseModel):
    id_producto: int
    nombre: str
    marca: Optional[str]
    codigo_barra: Optional[str]
    contenido_neto: Optional[Numero]
    unidad_contenido: Optional[str]
    porcion_cantidad: Optional[Numero]
    porcion_unidad: Optional[str]
    calorias_por_porcion: Optional[Numero]
    tiene_tabla: bool


class AlimentosBusqueda(BaseModel):
    alimentos: list[AlimentoCatalogo]
