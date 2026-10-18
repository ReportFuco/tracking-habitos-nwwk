"""Carga masiva de movimientos desde una cartola bancaria (solo por MCP).

El formato normalizado es una fila por movimiento de la cartola. Quien llama (el modelo
conectado por MCP) lee el Excel del banco, lo convierte a estas filas y asigna categoría;
el servidor valida, concilia con lo registrado a mano, inserta y compara el saldo.
"""
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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
        description=(
            "Fecha de la fila en la cartola, en calendario de Chile, con o sin hora. Si la "
            "cartola trae fecha de operación y fecha contable por separado, aquí va la de operación."
        ),
    )
    fecha_contable: Optional[date] = Field(
        None,
        examples=["2026-09-15"],
        description="Solo si la cartola la trae aparte de la de operación. Si se omite, es el día de fecha.",
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
    id_categoria: Optional[int] = Field(
        None,
        ge=1,
        description=(
            "Ver listar_categorias. Si se omite o es «Otros», la decide la regla de categoría "
            "que calce con la glosa (ver listar_reglas_categoria); sin regla queda en «Otros»."
        ),
    )
    tipo_gasto: EnumTipoGasto = Field(
        EnumTipoGasto.VARIABLE,
        description="'fijo' para cargos recurrentes (arriendo, planes, suscripciones).",
    )
    id_deuda: Optional[int] = Field(None, ge=1, description="Si la fila abona una deuda (ver listar_deudas).")
    id_cuenta_contraparte: Optional[int] = Field(
        None,
        ge=1,
        description=(
            "Si la fila es una transferencia entre cuentas propias (pago de tarjeta, traspaso): "
            "la otra cuenta (destino si es un cargo, origen si es un abono). No cuenta como gasto "
            "ni ingreso; se vincula con el movimiento espejo de esa cuenta o se crea."
        ),
    )
    saldo: Optional[int] = Field(
        None,
        examples=[362875],
        description=(
            "Columna Saldo de la cartola después de esta fila (puede ser negativo). Si todas las "
            "filas la traen, se valida la cadena y al importar se compara con el saldo de Ritmo."
        ),
    )

    _descripcion_original = field_validator("descripcion_original")(_limpiar_texto)
    _descripcion = field_validator("descripcion")(_limpiar_texto)

    @model_validator(mode="after")
    def validar_categoria(self):
        if self.id_cuenta_contraparte is not None and self.id_deuda is not None:
            raise ValueError("Una transferencia entre cuentas propias no abona una deuda.")
        return self

    @property
    def fecha_hora(self) -> datetime:
        if isinstance(self.fecha, datetime):
            return self.fecha
        return datetime(self.fecha.year, self.fecha.month, self.fecha.day)

    model_config = ConfigDict(title="Fila de cartola normalizada")


EstadoFila = Literal["nueva", "ya_importada", "posible_duplicado", "invalida"]


class MovimientoCoincidente(BaseModel):
    id_movimiento: int
    fecha: datetime
    descripcion: Optional[str] = None
    monto: int


class FilaPrevisualizada(BaseModel):
    indice: int = Field(description="Posición de la fila en la lista enviada (desde 0).")
    fecha: datetime
    fecha_contable: date
    descripcion: str
    monto: int
    tipo_movimiento: str
    estado: EstadoFila = Field(
        description=(
            "'nueva' se importará; 'ya_importada' ya se subió (o concilió) antes y se omite; "
            "'posible_duplicado' calza con un movimiento registrado a mano (ver manual): al "
            "importar se concilia con él en vez de crear otro, salvo que se confirme que es "
            "distinto; 'invalida' impide importar (ver detalle)."
        ),
    )
    detalle: Optional[str] = None
    manual: Optional[MovimientoCoincidente] = Field(
        None,
        description="Movimiento registrado a mano con el que calza la fila.",
    )


class CadenaSaldo(BaseModel):
    cuadra: bool = Field(description="True si cada saldo es el anterior más o menos el monto de la fila.")
    quiebres: list[int] = Field(
        default_factory=list,
        description="Índices de filas cuyo saldo no sigue al de la fila anterior (faltan o sobran filas).",
    )
    orden: Literal["ascendente", "descendente"] = Field(description="Orden cronológico de las filas enviadas.")
    al: date = Field(description="Fecha contable de la última fila en orden cronológico.")
    saldo_final: int = Field(description="Saldo del banco después de esa fila.")


class ControlSaldo(BaseModel):
    al: date
    saldo_banco: int = Field(description="Saldo de la cartola en su última fila (orden cronológico).")
    saldo_ritmo: int = Field(description="Saldo de la cuenta en Ritmo al cierre de ese día, ya importado.")
    diferencia: int = Field(description="saldo_ritmo - saldo_banco. 0 = cuadrada.")


class MovimientoPendiente(BaseModel):
    id_movimiento: int
    fecha: datetime
    descripcion: Optional[str] = None
    monto: int
    tipo_movimiento: str


class PrevisualizacionImportacion(BaseModel):
    id_cuenta: int
    total_filas: int
    nuevas: int
    ya_importadas: int
    posibles_duplicados: int
    invalidas: int
    total_gastos: int = Field(description="Suma de los gastos que se importarían (nuevas).")
    total_ingresos: int = Field(description="Suma de los ingresos que se importarían (nuevas).")
    cadena_saldo: Optional[CadenaSaldo] = Field(
        None,
        description="Solo si todas las filas traen saldo.",
    )
    filas: list[FilaPrevisualizada] = Field(
        description="Solo las filas que no son 'nueva', para no repetir lo enviado.",
    )


class ResultadoImportacion(BaseModel):
    id_importacion: Optional[int] = Field(
        None,
        description="Para deshacerla con deshacer_importacion. Null si no se creó ningún movimiento.",
    )
    creados: int
    conciliados: int = Field(description="Movimientos registrados a mano que calzaron con una fila y se conciliaron.")
    omitidos_ya_importados: int
    omitidos_posibles_duplicados: int = Field(
        description=(
            "Igual a conciliados: filas que no crearon movimiento porque calzaron con uno "
            "registrado a mano. Se mantiene para clientes con el esquema anterior."
        ),
    )
    transferencias_vinculadas: int = Field(
        description="Transferencias cuyo movimiento espejo ya existía en la otra cuenta.",
    )
    transferencias_creadas: int = Field(
        description="Transferencias cuyo movimiento espejo se creó en la otra cuenta (queda pendiente).",
    )
    total_gastos: int
    total_ingresos: int
    cadena_saldo: Optional[CadenaSaldo] = None
    control_saldo: Optional[ControlSaldo] = Field(
        None,
        description="Solo si todas las filas traen saldo. Requiere el saldo inicial de la cuenta (editar_cuenta).",
    )
    total_pendientes: int = Field(
        description=(
            "Movimientos de la cuenta en el rango de la cartola que siguen sin conciliar: "
            "registrados a mano sin fila que calce. Suelen explicar una diferencia de saldo."
        ),
    )
    pendientes: list[MovimientoPendiente] = Field(description="Los primeros 50 pendientes.")


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
