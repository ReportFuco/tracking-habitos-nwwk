from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from ._tipos import Numero
from .consumo_detalle import ConsumoDetalleItem, ConsumoDetalleResponse

# Los mismos que TIPOS_COMIDA del frontend, que valida la respuesta contra esa lista: un
# valor fuera de ella invalidaria el listado completo de comidas en la app.
TipoComida = Literal["desayuno", "colacion", "almuerzo", "once", "cena", "snack"]


class ConsumoCreate(BaseModel):
    fecha_consumo: datetime
    tipo_comida: TipoComida
    observacion: Optional[str] = Field(default=None, max_length=250)
    # Lo que se comió, en el mismo request: así una comida nunca queda a medias si se
    # corta la conexión entre crear la comida y agregarle los alimentos.
    detalles: list[ConsumoDetalleItem] = Field(default_factory=list, max_length=50)

    model_config = ConfigDict(title="Crear consumo")


class ConsumoPatch(BaseModel):
    fecha_consumo: Optional[datetime] = None
    tipo_comida: Optional[TipoComida] = None
    observacion: Optional[str] = None

    model_config = ConfigDict(title="Editar consumo")


class ConsumoResponse(BaseModel):
    id_consumo: int
    id_usuario: int
    fecha_consumo: datetime
    tipo_comida: str
    observacion: Optional[str]
    created_at: datetime
    detalles: list[ConsumoDetalleResponse] = []
    total_calorias: Optional[Numero] = None
    total_proteinas: Optional[Numero] = None
    total_carbohidratos: Optional[Numero] = None
    total_grasas: Optional[Numero] = None

    model_config = ConfigDict(from_attributes=True, title="Respuesta consumo")
