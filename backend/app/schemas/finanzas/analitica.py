from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.finanzas import EnumTipoMovimiento


class AnaliticaResumenResponse(BaseModel):
    year: int = Field(..., examples=[2026])
    month: int = Field(..., examples=[4])
    period_start: datetime = Field(..., examples=["2026-04-01T00:00:00"])
    period_end: datetime = Field(..., examples=["2026-05-01T00:00:00"])
    gasto_total: float = Field(..., examples=[245000])
    ingreso_total: float = Field(..., examples=[850000])
    balance_total: float = Field(..., examples=[605000])
    gasto_fijo_total: float = Field(..., examples=[120000])
    gasto_variable_total: float = Field(..., examples=[125000])
    cantidad_movimientos: int = Field(..., examples=[18])
    ticket_promedio_gasto: float = Field(..., examples=[17500])
    gasto_mayor: float = Field(..., examples=[49990])
    tasa_ahorro_pct: float | None = Field(
        None,
        examples=[71.18],
        description="Porcentaje de ahorro sobre ingresos del periodo. Null cuando no hay ingresos.",
    )
    variacion_gasto_vs_mes_anterior: float = Field(
        ...,
        examples=[-35000],
        description="Diferencia absoluta del gasto del periodo respecto al mes anterior.",
    )
    variacion_gasto_vs_mes_anterior_pct: float | None = Field(
        None,
        examples=[-12.5],
        description="Variación porcentual del gasto respecto al mes anterior. Null cuando el mes anterior fue 0.",
    )
    proyeccion_gasto_fin_mes: float | None = Field(
        None,
        examples=[312500],
        description="Solo se calcula para el mes actual en horario de Chile.",
    )

    model_config = ConfigDict(title="Resumen analitico finanzas")


class AnaliticaTendenciaMensualItem(BaseModel):
    year: int = Field(..., examples=[2026])
    month: int = Field(..., examples=[4])
    label: str = Field(..., examples=["2026-04"])
    gasto_total: float = Field(..., examples=[245000])
    ingreso_total: float = Field(..., examples=[850000])
    balance_total: float = Field(..., examples=[605000])
    cantidad_movimientos: int = Field(..., examples=[18])

    model_config = ConfigDict(title="Punto tendencia mensual finanzas")


class AnaliticaTendenciaMensualResponse(BaseModel):
    months: int = Field(..., examples=[6])
    items: list[AnaliticaTendenciaMensualItem] = Field(default_factory=list)

    model_config = ConfigDict(title="Tendencia mensual finanzas")


class AnaliticaDistribucionCategoriaItem(BaseModel):
    id_categoria: int = Field(..., examples=[1])
    categoria: str = Field(..., examples=["comida"])
    total: float = Field(..., examples=[125000])
    cantidad_movimientos: int = Field(..., examples=[9])
    porcentaje_del_total: float = Field(..., examples=[51.02])

    model_config = ConfigDict(title="Distribucion por categoria")


class AnaliticaDistribucionCategoriasResponse(BaseModel):
    year: int = Field(..., examples=[2026])
    month: int = Field(..., examples=[4])
    tipo_movimiento: EnumTipoMovimiento = Field(..., examples=[EnumTipoMovimiento.GASTO.value])
    total_periodo: float = Field(..., examples=[245000])
    items: list[AnaliticaDistribucionCategoriaItem] = Field(default_factory=list)

    model_config = ConfigDict(title="Distribucion categorias finanzas")


class AnaliticaDistribucionCuentaItem(BaseModel):
    id_cuenta: int = Field(..., examples=[1])
    nombre_cuenta: str = Field(..., examples=["Cuenta principal"])
    total: float = Field(..., examples=[125000])
    cantidad_movimientos: int = Field(..., examples=[9])
    porcentaje_del_total: float = Field(..., examples=[51.02])

    model_config = ConfigDict(title="Distribucion por cuenta")


class AnaliticaDistribucionCuentasResponse(BaseModel):
    year: int = Field(..., examples=[2026])
    month: int = Field(..., examples=[4])
    tipo_movimiento: EnumTipoMovimiento = Field(..., examples=[EnumTipoMovimiento.GASTO.value])
    total_periodo: float = Field(..., examples=[245000])
    items: list[AnaliticaDistribucionCuentaItem] = Field(default_factory=list)

    model_config = ConfigDict(title="Distribucion cuentas finanzas")
