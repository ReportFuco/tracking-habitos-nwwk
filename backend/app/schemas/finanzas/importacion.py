"""Carga masiva de movimientos desde una cartola bancaria (solo por MCP).

El formato normalizado es una fila por movimiento de la cartola. Quien llama (el modelo
conectado por MCP) lee el Excel del banco, lo convierte a estas filas y asigna categoría;
el servidor valida, detecta duplicados e inserta.
"""
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.finanzas import EnumTipoGasto, EnumTipoMovimiento


MAX_FILAS_IMPORTACION = 500


def _limpiar_texto(valor: str | None) -> str | None:
    if valor is None:
        return None
    return " ".join(valor.split()) or None


class FilaImportacion(BaseModel):
    fecha: date | datetime = Field(
        ...,
        examples=["2026-09-14"],
        description="Fecha de la operación (no la contable), en calendario de Chile. Con o sin hora.",
    )
    descripcion_original: str = Field(
        ...,
        min_length=1,
        max_length=250,
        examples=["COMPRA NAC JUMBO LAS CONDES"],
        description=(
            "Glosa tal cual aparece en la cartola, sin editar. Identifica la fila para no "
            "importarla dos veces si se sube otra cartola que la incluya."
        ),
    )
    descripcion: Optional[str] = Field(
        None,
        max_length=250,
        examples=["Jumbo Las Condes"],
        description="Descripción legible que se guarda. Si se omite, se usa la original.",
    )
    monto: int = Field(..., gt=0, examples=[45990], description="CLP, entero y positivo.")
    tipo_movimiento: EnumTipoMovimiento = Field(
        ...,
        description="'gasto' para cargos/débitos; 'ingreso' para abonos/créditos.",
    )
    id_categoria: int = Field(..., ge=1, description="Ver listar_categorias.")
    tipo_gasto: EnumTipoGasto = Field(
        EnumTipoGasto.VARIABLE,
        description="'fijo' para cargos recurrentes (arriendo, planes, suscripciones).",
    )
    id_deuda: Optional[int] = Field(None, ge=1, description="Si la fila abona una deuda (ver listar_deudas).")

    _descripcion_original = field_validator("descripcion_original")(_limpiar_texto)
    _descripcion = field_validator("descripcion")(_limpiar_texto)

    @property
    def fecha_hora(self) -> datetime:
        if isinstance(self.fecha, datetime):
            return self.fecha
        return datetime(self.fecha.year, self.fecha.month, self.fecha.day)

    model_config = ConfigDict(title="Fila de cartola normalizada")


EstadoFila = Literal["nueva", "ya_importada", "posible_duplicado", "invalida"]


class FilaPrevisualizada(BaseModel):
    indice: int = Field(description="Posición de la fila en la lista enviada (desde 0).")
    fecha: datetime
    descripcion: str
    monto: int
    tipo_movimiento: str
    estado: EstadoFila = Field(
        description=(
            "'nueva' se importará; 'ya_importada' ya se subió en otra importación y se omite; "
            "'posible_duplicado' se parece a un movimiento registrado a mano (ver coincidencias) "
            "y se omite salvo que se confirme; 'invalida' impide importar (ver detalle)."
        ),
    )
    detalle: Optional[str] = None
    coincidencias: list[int] = Field(
        default_factory=list,
        description="id_movimiento de los movimientos existentes que se parecen a esta fila.",
    )


class PrevisualizacionImportacion(BaseModel):
    id_cuenta: int
    total_filas: int
    nuevas: int
    ya_importadas: int
    posibles_duplicados: int
    invalidas: int
    total_gastos: int = Field(description="Suma de los gastos que se importarían (nuevas).")
    total_ingresos: int = Field(description="Suma de los ingresos que se importarían (nuevas).")
    filas: list[FilaPrevisualizada] = Field(
        description="Solo las filas que no son 'nueva', para no repetir lo enviado.",
    )


class ResultadoImportacion(BaseModel):
    id_importacion: Optional[int] = Field(
        None,
        description="Para deshacerla con deshacer_importacion. Null si no se creó ningún movimiento.",
    )
    creados: int
    omitidos_ya_importados: int
    omitidos_posibles_duplicados: int
    total_gastos: int
    total_ingresos: int


class ImportacionResumen(BaseModel):
    id_importacion: int
    nombre: Optional[str] = None
    id_cuenta: int
    cuenta: Optional[str] = None
    cantidad: int = Field(description="Movimientos creados al importar.")
    vigentes: int = Field(description="Movimientos de esta importación que siguen existiendo.")
    fecha_desde: Optional[datetime] = None
    fecha_hasta: Optional[datetime] = None
    created_at: datetime


class ImportacionesLista(BaseModel):
    items: list[ImportacionResumen]
