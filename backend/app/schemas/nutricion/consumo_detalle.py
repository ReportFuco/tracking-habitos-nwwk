from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ._tipos import Numero


class ConsumoDetalleItem(BaseModel):
    """Una línea de lo que se comió: un producto del catálogo o un alimento libre.

    - Producto: ``id_producto`` + cantidad y unidad; las calorías se calculan con su tabla
      nutricional (si se mandan, mandan las enviadas).
    - Alimento libre: ``nombre_alimento`` + ``calorias`` obligatorias (los macros son
      opcionales). ``estimado=true`` cuando son aproximadas, por ejemplo desde una foto.
    """

    id_producto: Optional[int] = None
    nombre_alimento: Optional[str] = Field(default=None, max_length=160)
    cantidad_consumida: Decimal = Field(gt=0)
    unidad_consumida: str = Field(min_length=1, max_length=30)
    calorias: Optional[Decimal] = Field(default=None, ge=0)
    proteinas: Optional[Decimal] = Field(default=None, ge=0)
    carbohidratos: Optional[Decimal] = Field(default=None, ge=0)
    grasas: Optional[Decimal] = Field(default=None, ge=0)
    estimado: bool = False

    @model_validator(mode="after")
    def _producto_o_alimento(self):
        if self.nombre_alimento is not None:
            self.nombre_alimento = self.nombre_alimento.strip() or None
        if (self.id_producto is None) == (self.nombre_alimento is None):
            raise ValueError("Indica un producto del catálogo o el nombre del alimento, no ambos")
        if self.id_producto is None and self.calorias is None:
            raise ValueError("Un alimento libre necesita sus calorías")
        return self

    model_config = ConfigDict(title="Linea de consumo")


class ConsumoDetalleCreate(ConsumoDetalleItem):
    id_consumo: int

    model_config = ConfigDict(title="Crear detalle de consumo")


class ConsumoDetallePatch(BaseModel):
    id_producto: Optional[int] = None
    nombre_alimento: Optional[str] = Field(default=None, max_length=160)
    cantidad_consumida: Optional[Decimal] = Field(default=None, gt=0)
    unidad_consumida: Optional[str] = Field(default=None, min_length=1, max_length=30)
    calorias: Optional[Decimal] = Field(default=None, ge=0)
    proteinas: Optional[Decimal] = Field(default=None, ge=0)
    carbohidratos: Optional[Decimal] = Field(default=None, ge=0)
    grasas: Optional[Decimal] = Field(default=None, ge=0)
    estimado: Optional[bool] = None

    model_config = ConfigDict(title="Editar detalle de consumo")


class ConsumoDetalleResponse(BaseModel):
    id_consumo_detalle: int
    id_consumo: int
    id_producto: Optional[int]
    nombre_alimento: Optional[str]
    nombre: str
    cantidad_consumida: Numero
    unidad_consumida: str
    calorias: Optional[Numero]
    proteinas: Optional[Numero]
    carbohidratos: Optional[Numero]
    grasas: Optional[Numero]
    estimado: bool

    model_config = ConfigDict(from_attributes=True, title="Respuesta detalle consumo")
