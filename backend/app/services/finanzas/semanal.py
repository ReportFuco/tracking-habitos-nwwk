"""Gasto semanal: el "gasto del día a día" de lunes a domingo, metas y alertas.

Cuenta los gastos de la semana (calendario de Chile, por fecha de operación) menos:

- transferencias entre cuentas propias (no son gasto en ninguna analítica),
- abonos a deudas (``id_deuda``): son compromisos, no gasto del día a día,
- categorías excluidas por el usuario (``PreferenciaCategoria.excluida``) o, sin
  configuración, las de :func:`excluida_por_defecto` (pago de deudas y de la tarjeta).

La meta diaria no se guarda: ``disponible_hoy`` reparte lo que queda de la meta entre los
días que faltan, así un día caro baja el tope de los siguientes.
"""
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CategoriaFinanza, CuentaUsuario, MetaGasto, Movimiento, PreferenciaCategoria, Usuario
from app.models.finanzas import EnumTipoMovimiento
from app.schemas.finanzas import (
    AlertaSemana,
    CategoriaMeta,
    CategoriaSemana,
    GastoDiaSemana,
    MetasGastoResponse,
    MetasGastoUpdate,
    ResumenSemanalResponse,
    SemanaTendencia,
    TendenciaSemanalResponse,
)
from app.services.errores import NoEncontrado
from app.services.finanzas.categorias import condicion_visible
from app.services.finanzas.reglas import normalizar_texto


CHILE_TZ = ZoneInfo("America/Santiago")
DIAS_SEMANA = 7
# Porcentaje de la meta (o del presupuesto) desde el que se avisa.
UMBRAL_AVISO_PCT = 80
# "Vas gastando más que la semana pasada": desde este alza y con al menos este monto.
UMBRAL_RITMO_PCT = 25
UMBRAL_RITMO_MONTO = 5000
SEMANAS_SUGERENCIA = 4

_EXCLUIDAS_POR_DEFECTO = {
    "pago de deudas",
    "pago tarjeta de credito",
    "pago de tarjeta de credito",
    "transferencias",
}


def hoy_chile() -> date:
    return datetime.now(CHILE_TZ).date()


def lunes_de(dia: date) -> date:
    return dia - timedelta(days=dia.weekday())


def excluida_por_defecto(nombre: str) -> bool:
    """Categorías que, sin configuración del usuario, no cuentan en el gasto semanal."""
    return normalizar_texto(nombre) in _EXCLUIDAS_POR_DEFECTO


def formato_clp(monto: float) -> str:
    signo = "−" if monto < 0 else ""
    return f"{signo}${abs(round(monto)):,}".replace(",", ".")


def _dias(n: int) -> str:
    return "1 día" if n == 1 else f"{n} días"


@dataclass
class ConfigGasto:
    meta_semanal: int | None = None
    excluidas: set[int] = field(default_factory=set)
    presupuestos: dict[int, int] = field(default_factory=dict)
    nombres: dict[int, str] = field(default_factory=dict)
    ocultas: set[int] = field(default_factory=set)


@dataclass
class Gasto:
    fecha: date
    monto: int
    id_categoria: int
    abona_deuda: bool = False


def _cuenta(gasto: Gasto, config: ConfigGasto) -> bool:
    return not gasto.abona_deuda and gasto.id_categoria not in config.excluidas


async def cargar_config(db: AsyncSession, usuario: Usuario) -> ConfigGasto:
    meta = await db.get(MetaGasto, usuario.id_usuario)
    filas = {
        fila.id_categoria: fila
        for fila in (
            await db.scalars(
                select(PreferenciaCategoria).where(PreferenciaCategoria.id_usuario == usuario.id_usuario)
            )
        ).all()
    }
    categorias = (
        await db.execute(
            select(CategoriaFinanza.id_categoria, CategoriaFinanza.nombre).where(condicion_visible(usuario))
        )
    ).all()

    config = ConfigGasto(meta_semanal=meta.meta_semanal if meta else None)
    for id_categoria, nombre in categorias:
        config.nombres[id_categoria] = nombre
        fila = filas.get(id_categoria)
        if fila is not None:
            if fila.excluida:
                config.excluidas.add(id_categoria)
            if fila.presupuesto_semanal:
                config.presupuestos[id_categoria] = fila.presupuesto_semanal
            if fila.oculta:
                config.ocultas.add(id_categoria)
        elif excluida_por_defecto(nombre):
            config.excluidas.add(id_categoria)
    return config


async def _gastos_rango(db: AsyncSession, usuario: Usuario, desde: date, hasta: date) -> list[Gasto]:
    """Gastos de [desde, hasta), sin transferencias. created_at es naive en hora de Chile."""
    filas = await db.execute(
        select(Movimiento.created_at, Movimiento.monto, Movimiento.id_categoria, Movimiento.id_deuda)
        .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
        .where(
            CuentaUsuario.id_usuario == usuario.id_usuario,
            Movimiento.tipo_movimiento == EnumTipoMovimiento.GASTO,
            Movimiento.id_transferencia.is_(None),
            Movimiento.created_at >= datetime.combine(desde, time.min),
            Movimiento.created_at < datetime.combine(hasta, time.min),
        )
    )
    return [
        Gasto(fecha=creado.date(), monto=monto, id_categoria=id_categoria, abona_deuda=id_deuda is not None)
        for creado, monto, id_categoria, id_deuda in filas.all()
    ]


async def _primer_movimiento(db: AsyncSession, usuario: Usuario) -> date | None:
    primero = await db.scalar(
        select(func.min(Movimiento.created_at))
        .join(CuentaUsuario, Movimiento.id_cuenta == CuentaUsuario.id_cuenta)
        .where(CuentaUsuario.id_usuario == usuario.id_usuario)
    )
    return primero.date() if primero else None


def armar_resumen(gastos: list[Gasto], config: ConfigGasto, lunes: date, hoy: date) -> ResumenSemanalResponse:
    """Resumen de la semana que empieza en ``lunes``. Puro: ``gastos`` debe cubrir esa
    semana y la anterior."""
    domingo = lunes + timedelta(days=DIAS_SEMANA - 1)
    lunes_anterior = lunes - timedelta(days=DIAS_SEMANA)
    es_actual = lunes <= hoy <= domingo
    if es_actual:
        transcurridos = (hoy - lunes).days + 1
    elif hoy > domingo:
        transcurridos = DIAS_SEMANA
    else:
        transcurridos = 0

    por_dia = [0] * DIAS_SEMANA
    por_categoria: dict[int, int] = {}
    por_categoria_anterior: dict[int, int] = {}
    excluido = 0
    anterior = 0
    anterior_misma_altura = 0
    for gasto in gastos:
        if lunes <= gasto.fecha <= domingo:
            if not _cuenta(gasto, config):
                excluido += gasto.monto
                continue
            por_dia[(gasto.fecha - lunes).days] += gasto.monto
            por_categoria[gasto.id_categoria] = por_categoria.get(gasto.id_categoria, 0) + gasto.monto
        elif lunes_anterior <= gasto.fecha < lunes and _cuenta(gasto, config):
            anterior += gasto.monto
            if (gasto.fecha - lunes_anterior).days < transcurridos:
                anterior_misma_altura += gasto.monto
            por_categoria_anterior[gasto.id_categoria] = (
                por_categoria_anterior.get(gasto.id_categoria, 0) + gasto.monto
            )

    gasto_semana = sum(por_dia)
    meta = config.meta_semanal
    gasto_hoy = por_dia[transcurridos - 1] if es_actual else None
    disponible_hoy = None
    if es_actual and meta:
        gastado_antes = gasto_semana - (gasto_hoy or 0)
        dias_restantes = DIAS_SEMANA - transcurridos + 1
        disponible_hoy = max(0, meta - gastado_antes) // dias_restantes

    variacion = gasto_semana - anterior_misma_altura
    categorias = [
        CategoriaSemana(
            id_categoria=id_categoria,
            categoria=config.nombres.get(id_categoria, "Sin categoría"),
            total=por_categoria.get(id_categoria, 0),
            total_semana_anterior=por_categoria_anterior.get(id_categoria, 0),
            presupuesto_semanal=config.presupuestos.get(id_categoria),
            porcentaje_presupuesto=(
                por_categoria.get(id_categoria, 0) / config.presupuestos[id_categoria] * 100
                if id_categoria in config.presupuestos
                else None
            ),
        )
        for id_categoria in set(por_categoria) | set(config.presupuestos)
    ]
    categorias.sort(key=lambda item: (-item.total, -(item.presupuesto_semanal or 0), item.categoria))

    resumen = ResumenSemanalResponse(
        semana_inicio=lunes,
        semana_fin=domingo,
        es_semana_actual=es_actual,
        dias_transcurridos=transcurridos,
        gasto_semana=gasto_semana,
        gasto_hoy=gasto_hoy,
        promedio_diario=gasto_semana / transcurridos if transcurridos else None,
        proyeccion_semana=gasto_semana / transcurridos * DIAS_SEMANA if es_actual else None,
        meta_semanal=meta,
        restante=meta - gasto_semana if meta else None,
        porcentaje_meta=gasto_semana / meta * 100 if meta else None,
        disponible_hoy=disponible_hoy,
        gasto_semana_anterior=anterior,
        gasto_semana_anterior_misma_altura=anterior_misma_altura,
        variacion_misma_altura=variacion,
        variacion_misma_altura_pct=(
            variacion / anterior_misma_altura * 100 if anterior_misma_altura else None
        ),
        gasto_excluido=excluido,
        dias=[
            GastoDiaSemana(
                fecha=lunes + timedelta(days=indice),
                gasto_total=monto,
                es_futuro=lunes + timedelta(days=indice) > hoy,
            )
            for indice, monto in enumerate(por_dia)
        ],
        categorias=categorias,
        alertas=[],
    )
    if es_actual:
        resumen.alertas = alertas_semana(resumen, hoy)
    return resumen


def alertas_semana(resumen: ResumenSemanalResponse, hoy: date) -> list[AlertaSemana]:
    """Alertas de la semana en curso, de la más a la menos grave."""
    alertas: list[AlertaSemana] = []
    semana = resumen.semana_inicio.isoformat()
    dias_restantes = DIAS_SEMANA - resumen.dias_transcurridos
    meta = resumen.meta_semanal
    gasto = resumen.gasto_semana

    if meta:
        if gasto > meta:
            alertas.append(AlertaSemana(
                clave=f"{semana}:semana:100",
                nivel="excedido",
                titulo="Te pasaste de la meta semanal",
                mensaje=(
                    f"Llevas {formato_clp(gasto)} de {formato_clp(meta)}: "
                    f"{formato_clp(gasto - meta)} sobre la meta."
                ),
            ))
        elif gasto * 100 >= meta * UMBRAL_AVISO_PCT:
            restan = f"para {_dias(dias_restantes)}" if dias_restantes else "para hoy"
            alertas.append(AlertaSemana(
                clave=f"{semana}:semana:{UMBRAL_AVISO_PCT}",
                nivel="aviso",
                titulo=f"Vas en el {round(gasto / meta * 100)}% de la meta semanal",
                mensaje=f"Te quedan {formato_clp(meta - gasto)} {restan}.",
            ))

        # Con la semana ya pasada el tope del día no agrega nada.
        tope = resumen.disponible_hoy
        if gasto <= meta and tope and resumen.gasto_hoy and resumen.gasto_hoy > tope:
            mensaje = f"Hoy llevas {formato_clp(resumen.gasto_hoy)} y tu tope era {formato_clp(tope)}."
            if dias_restantes:
                manana = (meta - gasto) // dias_restantes
                mensaje += f" Para cumplir la semana, desde mañana: {formato_clp(manana)} al día."
            alertas.append(AlertaSemana(
                clave=f"{hoy.isoformat()}:dia",
                nivel="aviso",
                titulo="Hoy te pasaste del tope diario",
                mensaje=mensaje,
            ))

    for categoria in resumen.categorias:
        presupuesto = categoria.presupuesto_semanal
        if not presupuesto:
            continue
        if categoria.total > presupuesto:
            alertas.append(AlertaSemana(
                clave=f"{semana}:cat:{categoria.id_categoria}:100",
                nivel="excedido",
                titulo=f"{categoria.categoria}: presupuesto superado",
                mensaje=(
                    f"Llevas {formato_clp(categoria.total)} de {formato_clp(presupuesto)} "
                    "esta semana."
                ),
            ))
        elif categoria.total * 100 >= presupuesto * UMBRAL_AVISO_PCT:
            alertas.append(AlertaSemana(
                clave=f"{semana}:cat:{categoria.id_categoria}:{UMBRAL_AVISO_PCT}",
                nivel="aviso",
                titulo=f"{categoria.categoria}: {round(categoria.total / presupuesto * 100)}% del presupuesto",
                mensaje=f"Te quedan {formato_clp(presupuesto - categoria.total)} esta semana.",
            ))

    anterior = resumen.gasto_semana_anterior_misma_altura
    pct = resumen.variacion_misma_altura_pct
    if (
        resumen.dias_transcurridos >= 2
        and pct is not None
        and pct >= UMBRAL_RITMO_PCT
        and resumen.variacion_misma_altura >= UMBRAL_RITMO_MONTO
    ):
        alertas.append(AlertaSemana(
            clave=f"{semana}:ritmo",
            nivel="info",
            titulo="Vas gastando más que la semana pasada",
            mensaje=(
                f"{formato_clp(gasto)} contra {formato_clp(anterior)} a esta altura "
                f"(+{round(pct)}%)."
            ),
        ))

    orden = {"excedido": 0, "aviso": 1, "info": 2}
    alertas.sort(key=lambda alerta: orden[alerta.nivel])
    return alertas


async def resumen_semanal(
    db: AsyncSession,
    usuario: Usuario,
    fecha: date | None = None,
    *,
    hoy: date | None = None,
) -> ResumenSemanalResponse:
    """Resumen de la semana (lunes a domingo) que contiene ``fecha``; sin ella, la actual."""
    hoy = hoy or hoy_chile()
    lunes = lunes_de(fecha or hoy)
    config = await cargar_config(db, usuario)
    gastos = await _gastos_rango(
        db, usuario, lunes - timedelta(days=DIAS_SEMANA), lunes + timedelta(days=DIAS_SEMANA)
    )
    return armar_resumen(gastos, config, lunes, hoy)


def _totales_por_semana(gastos: list[Gasto], config: ConfigGasto) -> dict[date, int]:
    totales: dict[date, int] = {}
    for gasto in gastos:
        if _cuenta(gasto, config):
            semana = lunes_de(gasto.fecha)
            totales[semana] = totales.get(semana, 0) + gasto.monto
    return totales


async def tendencia_semanal(
    db: AsyncSession,
    usuario: Usuario,
    semanas: int = 8,
    *,
    hoy: date | None = None,
) -> TendenciaSemanalResponse:
    """Gasto de las últimas N semanas, la actual incluida, contra la meta vigente.

    Omite las semanas anteriores al primer movimiento del usuario: sin datos aún, una
    semana en 0 se vería como ahorro.
    """
    hoy = hoy or hoy_chile()
    lunes_actual = lunes_de(hoy)
    desde = lunes_actual - timedelta(days=DIAS_SEMANA * (semanas - 1))
    primero = await _primer_movimiento(db, usuario)
    if primero is not None:
        desde = max(desde, lunes_de(primero))

    config = await cargar_config(db, usuario)
    gastos = await _gastos_rango(db, usuario, desde, lunes_actual + timedelta(days=DIAS_SEMANA))
    totales = _totales_por_semana(gastos, config)
    meta = config.meta_semanal

    items: list[SemanaTendencia] = []
    if primero is not None:
        lunes = desde
        while lunes <= lunes_actual:
            total = totales.get(lunes, 0)
            items.append(SemanaTendencia(
                semana_inicio=lunes,
                semana_fin=lunes + timedelta(days=DIAS_SEMANA - 1),
                gasto_total=total,
                meta_semanal=meta,
                diferencia_meta=meta - total if meta else None,
                es_semana_actual=lunes == lunes_actual,
            ))
            lunes += timedelta(days=DIAS_SEMANA)

    cerradas = [item for item in items if not item.es_semana_actual]
    return TendenciaSemanalResponse(
        semanas=semanas,
        meta_semanal=meta,
        promedio_semanas_completas=(
            sum(item.gasto_total for item in cerradas) / len(cerradas) if cerradas else None
        ),
        ahorro_vs_meta_acumulado=(
            sum(item.diferencia_meta or 0 for item in cerradas) if meta and cerradas else None
        ),
        semanas_cumplidas=sum(1 for item in cerradas if meta and item.gasto_total <= meta),
        items=items,
    )


def _redondear(monto: float, paso: int = 5000) -> int:
    return max(paso, round(monto / paso) * paso)


async def obtener_metas(db: AsyncSession, usuario: Usuario, *, hoy: date | None = None) -> MetasGastoResponse:
    """Meta semanal, configuración por categoría y promedios de las últimas 4 semanas
    cerradas para sugerir montos."""
    hoy = hoy or hoy_chile()
    lunes_actual = lunes_de(hoy)
    desde = lunes_actual - timedelta(days=DIAS_SEMANA * SEMANAS_SUGERENCIA)
    primero = await _primer_movimiento(db, usuario)
    if primero is not None:
        desde = max(desde, lunes_de(primero))
    semanas = max(0, (lunes_actual - desde).days // DIAS_SEMANA)

    config = await cargar_config(db, usuario)
    gastos = await _gastos_rango(db, usuario, desde, lunes_actual) if semanas else []

    # Promedio por categoría también de las excluidas, para que el usuario vea cuánto pesa
    # cada una antes de decidir si cuenta. Los abonos a deudas nunca cuentan: se omiten.
    por_categoria: dict[int, int] = {}
    for gasto in gastos:
        if not gasto.abona_deuda:
            por_categoria[gasto.id_categoria] = por_categoria.get(gasto.id_categoria, 0) + gasto.monto
    total_cuenta = sum(_totales_por_semana(gastos, config).values())

    categorias = (
        await db.scalars(
            select(CategoriaFinanza)
            .where(condicion_visible(usuario))
            .order_by(CategoriaFinanza.id_usuario.is_not(None), func.lower(CategoriaFinanza.nombre))
        )
    ).all()
    con_config = config.excluidas | set(config.presupuestos)
    return MetasGastoResponse(
        meta_semanal=config.meta_semanal,
        sugerencia_semanal=_redondear(total_cuenta / semanas) if semanas and total_cuenta else None,
        categorias=[
            CategoriaMeta(
                id_categoria=categoria.id_categoria,
                nombre=categoria.nombre,
                es_propia=categoria.es_propia,
                excluida=categoria.id_categoria in config.excluidas,
                presupuesto_semanal=config.presupuestos.get(categoria.id_categoria),
                promedio_semanal=por_categoria.get(categoria.id_categoria, 0) / semanas if semanas else 0,
            )
            for categoria in categorias
            # Archivadas y ocultas solo aparecen si todavía tienen gasto reciente (para
            # poder decidir si cuentan); las archivadas también si tienen algo configurado.
            if categoria.id_categoria in por_categoria
            or (
                categoria.id_categoria not in config.ocultas
                and (categoria.activo or categoria.id_categoria in con_config)
            )
        ],
    )


async def actualizar_metas(db: AsyncSession, usuario: Usuario, data: MetasGastoUpdate) -> MetasGastoResponse:
    if "meta_semanal" in data.model_fields_set:
        meta = await db.get(MetaGasto, usuario.id_usuario)
        if meta is None:
            meta = MetaGasto(id_usuario=usuario.id_usuario)
            db.add(meta)
        meta.meta_semanal = data.meta_semanal
        meta.updated_at = datetime.now()

    if data.categorias:
        ids = {item.id_categoria for item in data.categorias}
        visibles = {
            id_categoria: nombre
            for id_categoria, nombre in (
                await db.execute(
                    select(CategoriaFinanza.id_categoria, CategoriaFinanza.nombre).where(
                        CategoriaFinanza.id_categoria.in_(ids), condicion_visible(usuario)
                    )
                )
            ).all()
        }
        faltantes = ids - set(visibles)
        if faltantes:
            raise NoEncontrado(f"Categoría no encontrada: {min(faltantes)}.")

        for item in data.categorias:
            fila = await db.get(PreferenciaCategoria, (usuario.id_usuario, item.id_categoria))
            if fila is None:
                fila = PreferenciaCategoria(
                    id_usuario=usuario.id_usuario,
                    id_categoria=item.id_categoria,
                    # La fila nueva parte del valor por defecto para no cambiarlo sin querer.
                    excluida=excluida_por_defecto(visibles[item.id_categoria]),
                )
                db.add(fila)
            if item.excluida is not None:
                fila.excluida = item.excluida
            if "presupuesto_semanal" in item.model_fields_set:
                fila.presupuesto_semanal = item.presupuesto_semanal
            fila.updated_at = datetime.now()

    await db.flush()
    return await obtener_metas(db, usuario)
