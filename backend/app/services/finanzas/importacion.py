"""Carga masiva de movimientos desde una cartola bancaria (solo por MCP).

El modelo conectado lee el Excel del banco, lo normaliza a ``FilaImportacion`` y asigna
categorías; aquí se valida, se concilia con lo registrado a mano y se inserta todo o nada.

- **Ya importada**: cada fila tiene una clave determinista (UUID5 de usuario, cuenta,
  fecha contable, tipo, monto y glosa original, más su número de aparición: dos pasajes
  idénticos el mismo día son dos filas). Se guarda en ``clave_cartola`` del movimiento
  que la representa, así que subir cartolas que se solapan no repite filas.
- **Posible duplicado**: un movimiento de la misma cuenta, tipo y monto, aún sin
  conciliar (sin fecha contable), registrado entre ``VENTANA_ANTES`` días después y
  ``VENTANA_DESPUES`` días antes de la fecha contable de la fila. Al importar, el
  movimiento existente se concilia (toma la fecha contable y la glosa) en vez de crear
  otro, salvo que el usuario confirme que son distintos.
- **Transferencias**: una fila con ``id_cuenta_contraparte`` se vincula con su espejo en
  la otra cuenta, o se le crea uno.

Con ``saldo`` en todas las filas se valida la cadena de saldos de la cartola y, al
importar, se compara el saldo final del banco con el de Ritmo.
"""
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CuentaUsuario, Importacion, Movimiento, Usuario
from app.models.finanzas import EnumTipoMovimiento
from app.schemas.finanzas import (
    CadenaSaldo,
    ControlSaldo,
    FilaImportacion,
    FilaPrevisualizada,
    ImportacionesLista,
    ImportacionResumen,
    MovimientoCoincidente,
    MovimientoPendiente,
    PrevisualizacionImportacion,
    ResultadoImportacion,
)
from app.services.errores import DatosInvalidos, ErrorDominio, NoEncontrado
from app.services.finanzas import cuentas, deudas, movimientos, transferencias


CHILE_TZ = ZoneInfo("America/Santiago")
# Fijo: cambiarlo haría que las cartolas ya subidas dejen de reconocerse como importadas.
NAMESPACE_IMPORTACION = uuid.UUID("5b0f1a52-9c1e-4c55-8f0e-7d2a3c6e9a41")
# Lo hecho después de las 14:00 o en día inhábil el banco lo registra el día hábil
# siguiente: un fin de semana largo lo corre hasta 4 días. Un día antes cubre un registro
# manual tardío.
VENTANA_ANTES = timedelta(days=1)
VENTANA_DESPUES = timedelta(days=4)
HORA_CORTE_BANCO = 14
MAX_ERRORES_EN_MENSAJE = 10
MAX_PENDIENTES = 50


@dataclass
class _Fila:
    indice: int
    datos: FilaImportacion
    fecha: datetime
    fecha_contable: date
    clave: uuid.UUID
    estado: str = "nueva"
    detalle: str | None = None
    manual: Movimiento | None = None

    @property
    def descripcion(self) -> str:
        return self.datos.descripcion or self.datos.descripcion_original

    @property
    def con_signo(self) -> int:
        return self.datos.monto if self.datos.tipo_movimiento == EnumTipoMovimiento.INGRESO else -self.datos.monto


def _fecha_chile(fila: FilaImportacion) -> datetime:
    fecha = fila.fecha_hora
    if fecha.tzinfo is not None:
        fecha = fecha.astimezone(CHILE_TZ).replace(tzinfo=None)
    return fecha


def _fecha_contable_esperada(movimiento: Movimiento) -> date:
    """Día en que el banco registraría el movimiento: el mismo día hábil si fue antes de
    las 14:00 y, si no o si fue fin de semana, el día hábil siguiente. No considera
    feriados: solo ordena candidatos, la ventana de calce los cubre igual."""
    dia = movimiento.created_at.date()
    if movimiento.hora_conocida and movimiento.created_at.hour >= HORA_CORTE_BANCO and dia.weekday() < 5:
        dia += timedelta(days=1)
    while dia.weekday() >= 5:
        dia += timedelta(days=1)
    return dia


def _clave_base(usuario: Usuario, id_cuenta: int, fila: FilaImportacion, fecha_contable: date) -> str:
    glosa = " ".join(fila.descripcion_original.lower().split())
    return "|".join((
        str(usuario.id_usuario),
        str(id_cuenta),
        fecha_contable.isoformat(),
        fila.tipo_movimiento.value,
        str(fila.monto),
        glosa,
    ))


async def _validar_una_vez(cache: dict, clave, validacion) -> str | None:
    """Corre ``validacion`` una vez por ``clave``; devuelve el mensaje de error o None."""
    if clave not in cache:
        try:
            await validacion()
            cache[clave] = None
        except ErrorDominio as exc:
            cache[clave] = exc.mensaje
    return cache[clave]


async def _analizar(
    db: AsyncSession,
    usuario: Usuario,
    id_cuenta: int,
    filas: list[FilaImportacion],
    confirmar_duplicados: set[int] = frozenset(),
) -> list[_Fila]:
    await movimientos.validar_cuenta_activa(db, usuario, id_cuenta)

    analisis: list[_Fila] = []
    ocurrencias: dict[str, int] = defaultdict(int)
    for indice, datos in enumerate(filas):
        fecha = _fecha_chile(datos)
        fecha_contable = datos.fecha_contable or fecha.date()
        base = _clave_base(usuario, id_cuenta, datos, fecha_contable)
        ocurrencias[base] += 1
        clave = uuid.uuid5(NAMESPACE_IMPORTACION, f"{base}|{ocurrencias[base]}")
        analisis.append(_Fila(indice=indice, datos=datos, fecha=fecha, fecha_contable=fecha_contable, clave=clave))

    # --- Ya importadas o conciliadas ----------------------------------------------------
    existentes = set(
        (
            await db.execute(
                select(Movimiento.clave_cartola).where(
                    Movimiento.clave_cartola.in_([fila.clave for fila in analisis])
                )
            )
        ).scalars()
    )
    for fila in analisis:
        if fila.clave in existentes:
            fila.estado = "ya_importada"

    # --- Categorías y cuentas de las transferencias -------------------------------------
    errores: dict = {}
    for fila in analisis:
        if fila.estado != "nueva":
            continue
        datos = fila.datos
        if datos.id_cuenta_contraparte is not None:
            error = await _validar_una_vez(
                errores,
                ("cuenta", datos.id_cuenta_contraparte),
                lambda: transferencias.validar_cuentas(db, usuario, id_cuenta, datos.id_cuenta_contraparte),
            )
        else:
            error = await _validar_una_vez(
                errores,
                ("categoria", datos.id_categoria),
                lambda: movimientos.validar_categoria(db, usuario, datos.id_categoria),
            )
        if error:
            fila.estado = "invalida"
            fila.detalle = error

    # --- Calce con lo registrado y aún sin conciliar --------------------------------------
    candidatas = [fila for fila in analisis if fila.estado == "nueva"]
    if candidatas:
        desde = min(fila.fecha_contable for fila in candidatas) - VENTANA_DESPUES
        hasta = max(fila.fecha_contable for fila in candidatas) + VENTANA_ANTES + timedelta(days=1)
        manuales = (
            await db.execute(
                select(Movimiento).where(
                    Movimiento.id_cuenta == id_cuenta,
                    Movimiento.fecha_contable.is_(None),
                    Movimiento.created_at >= datetime.combine(desde, datetime.min.time()),
                    Movimiento.created_at < datetime.combine(hasta, datetime.min.time()),
                )
            )
        ).scalars().all()
        por_monto: dict[tuple, list[Movimiento]] = defaultdict(list)
        for manual in manuales:
            por_monto[(manual.tipo_movimiento, manual.monto)].append(manual)

        # Asignación 1 a 1 global: primero los pares más cercanos al día en que el banco
        # habría registrado el manual. Ir fila por fila dejaría que una fila anterior se
        # quede con un manual que calza mejor con otra posterior (compras repetidas).
        pares = []
        for fila in candidatas:
            for manual in por_monto[(fila.datos.tipo_movimiento, fila.datos.monto)]:
                atraso = fila.fecha_contable - manual.created_at.date()
                if not -VENTANA_ANTES <= atraso <= VENTANA_DESPUES:
                    continue
                desvio = abs((fila.fecha_contable - _fecha_contable_esperada(manual)).days)
                pares.append(((atraso < timedelta(0), desvio, fila.indice, manual.id_transaccion), fila, manual))
        filas_usadas: set[int] = set()
        manuales_usados: set[int] = set()
        for _, fila, manual in sorted(pares, key=lambda par: par[0]):
            if fila.indice in filas_usadas or manual.id_transaccion in manuales_usados:
                continue
            filas_usadas.add(fila.indice)
            manuales_usados.add(manual.id_transaccion)
            fila.manual = manual
            if fila.indice not in confirmar_duplicados:
                fila.estado = "posible_duplicado"
                fila.detalle = f"Calza con el movimiento #{manual.id_transaccion}: se conciliará con él."

    # --- Abonos a deudas: acumulados en orden de fecha --------------------------------
    comprometido: dict[int, int] = defaultdict(int)
    for fila in sorted(analisis, key=lambda f: (f.fecha, f.indice)):
        id_deuda = fila.datos.id_deuda
        if fila.estado != "nueva" or id_deuda is None:
            continue
        try:
            await deudas.validar_abono(
                db,
                usuario,
                id_deuda,
                tipo_movimiento=fila.datos.tipo_movimiento,
                monto=fila.datos.monto,
                ya_comprometido=comprometido[id_deuda],
            )
            comprometido[id_deuda] += fila.datos.monto
        except ErrorDominio as exc:
            fila.estado = "invalida"
            fila.detalle = exc.mensaje

    return analisis


def _cadena_saldo(filas: list[_Fila]) -> CadenaSaldo | None:
    """Revisa que cada saldo de la cartola sea el anterior más el monto con signo."""
    if not filas or any(fila.datos.saldo is None for fila in filas):
        return None
    descendente = filas[0].fecha_contable > filas[-1].fecha_contable
    cronologicas = filas[::-1] if descendente else filas
    quiebres = [
        actual.indice
        for anterior, actual in zip(cronologicas, cronologicas[1:])
        if anterior.datos.saldo + actual.con_signo != actual.datos.saldo
    ]
    ultima = cronologicas[-1]
    return CadenaSaldo(
        cuadra=not quiebres,
        quiebres=quiebres,
        orden="descendente" if descendente else "ascendente",
        al=ultima.fecha_contable,
        saldo_final=ultima.datos.saldo,
    )


def _totales(filas: list[_Fila]) -> tuple[int, int]:
    nuevas = [fila for fila in filas if fila.estado == "nueva" and fila.datos.id_cuenta_contraparte is None]
    gastos = sum(f.datos.monto for f in nuevas if f.datos.tipo_movimiento == EnumTipoMovimiento.GASTO)
    ingresos = sum(f.datos.monto for f in nuevas if f.datos.tipo_movimiento == EnumTipoMovimiento.INGRESO)
    return gastos, ingresos


def _contar(filas: list[_Fila], estado: str) -> int:
    return sum(1 for fila in filas if fila.estado == estado)


async def previsualizar(
    db: AsyncSession,
    usuario: Usuario,
    id_cuenta: int,
    filas: list[FilaImportacion],
) -> PrevisualizacionImportacion:
    """Qué pasaría al importar, sin escribir nada."""
    analisis = await _analizar(db, usuario, id_cuenta, filas)
    gastos, ingresos = _totales(analisis)
    return PrevisualizacionImportacion(
        id_cuenta=id_cuenta,
        total_filas=len(analisis),
        nuevas=_contar(analisis, "nueva"),
        ya_importadas=_contar(analisis, "ya_importada"),
        posibles_duplicados=_contar(analisis, "posible_duplicado"),
        invalidas=_contar(analisis, "invalida"),
        total_gastos=gastos,
        total_ingresos=ingresos,
        cadena_saldo=_cadena_saldo(analisis),
        filas=[
            FilaPrevisualizada(
                indice=fila.indice,
                fecha=fila.fecha,
                fecha_contable=fila.fecha_contable,
                descripcion=fila.descripcion,
                monto=fila.datos.monto,
                tipo_movimiento=fila.datos.tipo_movimiento.value,
                estado=fila.estado,
                detalle=fila.detalle,
                manual=(
                    MovimientoCoincidente(
                        id_movimiento=fila.manual.id_transaccion,
                        fecha=fila.manual.created_at,
                        descripcion=fila.manual.descripcion,
                        monto=fila.manual.monto,
                    )
                    if fila.manual is not None
                    else None
                ),
            )
            for fila in analisis
            if fila.estado != "nueva"
        ],
    )


def _nuevo_movimiento(fila: _Fila, id_cuenta: int, id_importacion: int, id_categoria: int) -> Movimiento:
    # Una cartola puede traer filas con fecha contable futura: la operación no puede ser
    # posterior a hoy.
    hoy = datetime.now(CHILE_TZ).date()
    fecha, hora_conocida = fila.fecha, isinstance(fila.datos.fecha, datetime)
    if fecha.date() > hoy:
        fecha, hora_conocida = datetime.combine(hoy, datetime.min.time()), False
    return Movimiento(
        clave_cartola=fila.clave,
        id_importacion=id_importacion,
        id_cuenta=id_cuenta,
        id_categoria=id_categoria,
        id_deuda=fila.datos.id_deuda,
        id_transferencia=uuid.uuid4() if fila.datos.id_cuenta_contraparte else None,
        tipo_movimiento=fila.datos.tipo_movimiento,
        tipo_gasto=fila.datos.tipo_gasto,
        monto=fila.datos.monto,
        descripcion=fila.descripcion,
        descripcion_original=fila.datos.descripcion_original,
        fecha_contable=fila.fecha_contable,
        hora_conocida=hora_conocida,
        en_lugar_compra=False,
        created_at=fecha,
    )


def _conciliar(fila: _Fila, id_importacion: int, id_categoria_transferencias: int | None) -> None:
    """El movimiento registrado a mano pasa a representar la fila: conserva su fecha (la
    real de la operación) y toma la fecha contable y la glosa de la cartola."""
    manual = fila.manual
    manual.fecha_contable = fila.fecha_contable
    manual.descripcion_original = fila.datos.descripcion_original
    manual.clave_cartola = fila.clave
    manual.id_importacion_conciliacion = id_importacion
    if fila.datos.id_cuenta_contraparte and manual.id_transferencia is None:
        manual.id_transferencia = uuid.uuid4()
        manual.id_categoria = id_categoria_transferencias


async def _pendientes(
    db: AsyncSession, id_cuenta: int, desde: date, hasta: date
) -> tuple[int, list[MovimientoPendiente]]:
    condiciones = (
        Movimiento.id_cuenta == id_cuenta,
        Movimiento.fecha_contable.is_(None),
        Movimiento.created_at >= datetime.combine(desde, datetime.min.time()),
        Movimiento.created_at < datetime.combine(hasta + timedelta(days=1), datetime.min.time()),
    )
    total = await db.scalar(select(func.count(Movimiento.id_transaccion)).where(*condiciones))
    lista = (
        await db.execute(
            select(Movimiento)
            .where(*condiciones)
            .order_by(Movimiento.created_at, Movimiento.id_transaccion)
            .limit(MAX_PENDIENTES)
        )
    ).scalars().all()
    return total, [
        MovimientoPendiente(
            id_movimiento=movimiento.id_transaccion,
            fecha=movimiento.created_at,
            descripcion=movimiento.descripcion,
            monto=movimiento.monto,
            tipo_movimiento=movimiento.tipo_movimiento.value,
        )
        for movimiento in lista
    ]


async def importar(
    db: AsyncSession,
    usuario: Usuario,
    id_cuenta: int,
    filas: list[FilaImportacion],
    *,
    nombre: str | None = None,
    confirmar_duplicados: list[int] | None = None,
) -> ResultadoImportacion:
    """Crea los movimientos nuevos y concilia los registrados a mano en una sola
    transacción. Si alguna fila es inválida no se crea nada."""
    analisis = await _analizar(db, usuario, id_cuenta, filas, set(confirmar_duplicados or ()))

    invalidas = [fila for fila in analisis if fila.estado == "invalida"]
    if invalidas:
        detalle = "; ".join(f"fila {f.indice}: {f.detalle}" for f in invalidas[:MAX_ERRORES_EN_MENSAJE])
        if len(invalidas) > MAX_ERRORES_EN_MENSAJE:
            detalle += f"; y {len(invalidas) - MAX_ERRORES_EN_MENSAJE} más"
        raise DatosInvalidos(f"No se importó nada: {len(invalidas)} fila(s) inválida(s). {detalle}.")

    nuevas = [fila for fila in analisis if fila.estado == "nueva"]
    por_conciliar = [fila for fila in analisis if fila.estado == "posible_duplicado"]
    gastos, ingresos = _totales(analisis)
    id_importacion = None
    vinculadas = creadas = 0
    if nuevas or por_conciliar:
        importacion = Importacion(
            id_usuario=usuario.id_usuario,
            id_cuenta=id_cuenta,
            nombre=" ".join((nombre or "").split()) or None,
            cantidad=len(nuevas),
        )
        db.add(importacion)
        await db.flush()
        id_importacion = importacion.id_importacion

        hay_transferencias = any(fila.datos.id_cuenta_contraparte for fila in nuevas + por_conciliar)
        id_categoria_transferencias = (
            await transferencias.categoria_transferencias(db) if hay_transferencias else None
        )

        # Movimiento que representa cada fila: nuevo o el manual conciliado.
        representantes: list[tuple[_Fila, Movimiento]] = []
        for fila in nuevas:
            id_categoria = id_categoria_transferencias if fila.datos.id_cuenta_contraparte else fila.datos.id_categoria
            movimiento = _nuevo_movimiento(fila, id_cuenta, id_importacion, id_categoria)
            db.add(movimiento)
            representantes.append((fila, movimiento))
        for fila in por_conciliar:
            id_transferencia_previa = fila.manual.id_transferencia
            _conciliar(fila, id_importacion, id_categoria_transferencias)
            if id_transferencia_previa is None:
                representantes.append((fila, fila.manual))
        await db.flush()

        # Transferencias: el espejo en la otra cuenta ya existe o se crea.
        espejos_usados: set[int] = set()
        for fila, movimiento in representantes:
            id_contraparte = fila.datos.id_cuenta_contraparte
            if not id_contraparte:
                continue
            espejo = await transferencias.buscar_espejo(
                db,
                id_cuenta=id_contraparte,
                tipo_movimiento=transferencias.opuesto(movimiento.tipo_movimiento),
                monto=movimiento.monto,
                fecha=fila.fecha_contable,
                excluir=espejos_usados,
            )
            if espejo is not None:
                espejo.id_transferencia = movimiento.id_transferencia
                espejos_usados.add(espejo.id_transaccion)
                vinculadas += 1
            else:
                db.add(transferencias.crear_espejo(movimiento, id_contraparte, id_importacion=id_importacion))
                creadas += 1
        await db.flush()

    cadena = _cadena_saldo(analisis)
    control = None
    if cadena is not None:
        cuenta = await cuentas.obtener_cuenta(db, usuario, id_cuenta)
        saldo_ritmo = (await cuentas.saldos(db, [cuenta], al=cadena.al))[id_cuenta].saldo
        control = ControlSaldo(
            al=cadena.al,
            saldo_banco=cadena.saldo_final,
            saldo_ritmo=saldo_ritmo,
            diferencia=saldo_ritmo - cadena.saldo_final,
        )
    total_pendientes, pendientes = await _pendientes(
        db,
        id_cuenta,
        min(min(fila.fecha.date(), fila.fecha_contable) for fila in analisis),
        max(fila.fecha_contable for fila in analisis),
    )

    return ResultadoImportacion(
        id_importacion=id_importacion,
        creados=len(nuevas),
        conciliados=len(por_conciliar),
        omitidos_ya_importados=_contar(analisis, "ya_importada"),
        omitidos_posibles_duplicados=len(por_conciliar),
        transferencias_vinculadas=vinculadas,
        transferencias_creadas=creadas,
        total_gastos=gastos,
        total_ingresos=ingresos,
        cadena_saldo=cadena,
        control_saldo=control,
        total_pendientes=total_pendientes,
        pendientes=pendientes,
    )


async def listar_importaciones(db: AsyncSession, usuario: Usuario, limit: int = 20) -> ImportacionesLista:
    filas = (
        await db.execute(
            select(
                Importacion,
                CuentaUsuario.nombre_cuenta,
                func.count(Movimiento.id_transaccion),
                func.min(Movimiento.created_at),
                func.max(Movimiento.created_at),
            )
            .join(CuentaUsuario, CuentaUsuario.id_cuenta == Importacion.id_cuenta)
            .outerjoin(
                Movimiento,
                (Movimiento.id_importacion == Importacion.id_importacion)
                & (Movimiento.id_cuenta == Importacion.id_cuenta),
            )
            .where(Importacion.id_usuario == usuario.id_usuario)
            .group_by(Importacion.id_importacion, CuentaUsuario.nombre_cuenta)
            .order_by(Importacion.created_at.desc(), Importacion.id_importacion.desc())
            .limit(limit)
        )
    ).all()
    return ImportacionesLista(
        items=[
            ImportacionResumen(
                id_importacion=importacion.id_importacion,
                nombre=importacion.nombre,
                id_cuenta=importacion.id_cuenta,
                cuenta=nombre_cuenta,
                cantidad=importacion.cantidad,
                vigentes=vigentes,
                fecha_desde=desde,
                fecha_hasta=hasta,
                created_at=importacion.created_at,
            )
            for importacion, nombre_cuenta, vigentes, desde, hasta in filas
        ]
    )


async def deshacer_importacion(db: AsyncSession, usuario: Usuario, id_importacion: int) -> tuple[int, int]:
    """Borra los movimientos que creó la importación (también los espejos de transferencias
    creados en otras cuentas) y revierte la conciliación de los registrados a mano.
    Devuelve (movimientos borrados, conciliaciones revertidas)."""
    importacion = await db.scalar(
        select(Importacion).where(
            Importacion.id_importacion == id_importacion,
            Importacion.id_usuario == usuario.id_usuario,
        )
    )
    if not importacion:
        raise NoEncontrado("Importación no encontrada.")

    ids_transferencia = set(
        (
            await db.execute(
                select(Movimiento.id_transferencia).where(
                    Movimiento.id_transferencia.is_not(None),
                    (Movimiento.id_importacion == id_importacion)
                    | (Movimiento.id_importacion_conciliacion == id_importacion),
                )
            )
        ).scalars()
    )
    revertidas = await db.execute(
        update(Movimiento)
        .where(Movimiento.id_importacion_conciliacion == id_importacion)
        .values(fecha_contable=None, descripcion_original=None, clave_cartola=None, id_importacion_conciliacion=None)
    )
    borrados = await db.execute(delete(Movimiento).where(Movimiento.id_importacion == id_importacion))
    await transferencias.desvincular_huerfanas(db, ids_transferencia)
    await db.delete(importacion)
    await db.flush()
    return borrados.rowcount, revertidas.rowcount
