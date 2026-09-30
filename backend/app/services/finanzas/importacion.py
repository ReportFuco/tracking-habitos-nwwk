"""Carga masiva de movimientos desde una cartola bancaria (solo por MCP).

El modelo conectado lee el Excel del banco, lo normaliza a ``FilaImportacion`` y asigna
categorías; aquí se valida, se detectan duplicados y se inserta todo o nada.

Dos filtros evitan duplicar plata:

- **Ya importada**: cada fila recibe un ``client_request_id`` determinista (UUID5 de
  usuario, cuenta, fecha, tipo, monto y glosa original). Subir otra cartola que se
  solape con una anterior no repite esas filas. Filas idénticas en la misma cartola (dos
  pasajes iguales el mismo día) se distinguen por su orden de aparición.
- **Posible duplicado**: movimientos registrados a mano en la misma cuenta, del mismo
  tipo y monto, a ``VENTANA_DUPLICADO`` días o menos. No se importan salvo que el
  usuario confirme que son distintos.
"""
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CuentaUsuario, Importacion, Movimiento, Usuario
from app.models.finanzas import EnumTipoMovimiento
from app.schemas.finanzas import (
    FilaImportacion,
    FilaPrevisualizada,
    ImportacionesLista,
    ImportacionResumen,
    PrevisualizacionImportacion,
    ResultadoImportacion,
)
from app.services.errores import DatosInvalidos, ErrorDominio, NoEncontrado
from app.services.finanzas import deudas, movimientos


CHILE_TZ = ZoneInfo("America/Santiago")
# Fijo: cambiarlo haría que las cartolas ya subidas dejen de reconocerse como importadas.
NAMESPACE_IMPORTACION = uuid.UUID("5b0f1a52-9c1e-4c55-8f0e-7d2a3c6e9a41")
# Una compra con tarjeta suele aparecer en la cartola uno o dos días después.
VENTANA_DUPLICADO = timedelta(days=3)
MAX_ERRORES_EN_MENSAJE = 10


@dataclass
class _Fila:
    indice: int
    datos: FilaImportacion
    fecha: datetime
    clave: uuid.UUID
    estado: str = "nueva"
    detalle: str | None = None
    coincidencias: list[int] = field(default_factory=list)

    @property
    def descripcion(self) -> str:
        return self.datos.descripcion or self.datos.descripcion_original


def _fecha_chile(fila: FilaImportacion) -> datetime:
    fecha = fila.fecha_hora
    if fecha.tzinfo is not None:
        fecha = fecha.astimezone(CHILE_TZ).replace(tzinfo=None)
    return fecha


def _clave_base(usuario: Usuario, id_cuenta: int, fila: FilaImportacion, fecha: datetime) -> str:
    glosa = " ".join(fila.descripcion_original.lower().split())
    return "|".join((
        str(usuario.id_usuario),
        str(id_cuenta),
        fecha.date().isoformat(),
        fila.tipo_movimiento.value,
        str(fila.monto),
        glosa,
    ))


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
        base = _clave_base(usuario, id_cuenta, datos, fecha)
        ocurrencias[base] += 1
        clave = uuid.uuid5(NAMESPACE_IMPORTACION, f"{base}|{ocurrencias[base]}")
        analisis.append(_Fila(indice=indice, datos=datos, fecha=fecha, clave=clave))

    # --- Ya importadas ----------------------------------------------------------------
    existentes = set(
        (
            await db.execute(
                select(Movimiento.client_request_id).where(
                    Movimiento.client_request_id.in_([fila.clave for fila in analisis])
                )
            )
        ).scalars()
    )
    for fila in analisis:
        if fila.clave in existentes:
            fila.estado = "ya_importada"

    # --- Categorías -------------------------------------------------------------------
    errores_categoria: dict[int, str | None] = {}
    for fila in analisis:
        id_categoria = fila.datos.id_categoria
        if id_categoria not in errores_categoria:
            try:
                await movimientos.validar_categoria(db, usuario, id_categoria)
                errores_categoria[id_categoria] = None
            except ErrorDominio as exc:
                errores_categoria[id_categoria] = exc.mensaje
        if fila.estado == "nueva" and errores_categoria[id_categoria]:
            fila.estado = "invalida"
            fila.detalle = errores_categoria[id_categoria]

    # --- Posibles duplicados de lo registrado a mano ----------------------------------
    candidatas = [fila for fila in analisis if fila.estado == "nueva"]
    if candidatas:
        desde = min(fila.fecha for fila in candidatas) - VENTANA_DUPLICADO
        hasta = max(fila.fecha for fila in candidatas) + VENTANA_DUPLICADO + timedelta(days=1)
        manuales = (
            await db.execute(
                select(
                    Movimiento.id_transaccion,
                    Movimiento.created_at,
                    Movimiento.tipo_movimiento,
                    Movimiento.monto,
                ).where(
                    Movimiento.id_cuenta == id_cuenta,
                    Movimiento.id_importacion.is_(None),
                    Movimiento.created_at >= desde,
                    Movimiento.created_at < hasta,
                )
            )
        ).all()
        por_monto: dict[tuple, list] = defaultdict(list)
        for manual in manuales:
            por_monto[(manual.tipo_movimiento, manual.monto)].append(manual)

        # Cada movimiento manual calza con una sola fila: la más cercana en fecha.
        usados: set[int] = set()
        for fila in sorted(candidatas, key=lambda f: (f.fecha, f.indice)):
            opciones = [
                (abs((manual.created_at.date() - fila.fecha.date()).days), manual.id_transaccion)
                for manual in por_monto[(fila.datos.tipo_movimiento, fila.datos.monto)]
                if manual.id_transaccion not in usados
                and abs(manual.created_at.date() - fila.fecha.date()) <= VENTANA_DUPLICADO
            ]
            if not opciones:
                continue
            _, id_manual = min(opciones)
            usados.add(id_manual)
            fila.coincidencias = [id_manual]
            if fila.indice not in confirmar_duplicados:
                fila.estado = "posible_duplicado"
                fila.detalle = f"Parecido al movimiento #{id_manual}, registrado a mano."

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


def _totales(filas: list[_Fila]) -> tuple[int, int]:
    nuevas = [fila for fila in filas if fila.estado == "nueva"]
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
        filas=[
            FilaPrevisualizada(
                indice=fila.indice,
                fecha=fila.fecha,
                descripcion=fila.descripcion,
                monto=fila.datos.monto,
                tipo_movimiento=fila.datos.tipo_movimiento.value,
                estado=fila.estado,
                detalle=fila.detalle,
                coincidencias=fila.coincidencias,
            )
            for fila in analisis
            if fila.estado != "nueva"
        ],
    )


async def importar(
    db: AsyncSession,
    usuario: Usuario,
    id_cuenta: int,
    filas: list[FilaImportacion],
    *,
    nombre: str | None = None,
    confirmar_duplicados: list[int] | None = None,
) -> ResultadoImportacion:
    """Crea los movimientos nuevos en una sola transacción. Si alguna fila es inválida no
    se crea nada. Las ya importadas y los posibles duplicados sin confirmar se omiten."""
    analisis = await _analizar(db, usuario, id_cuenta, filas, set(confirmar_duplicados or ()))

    invalidas = [fila for fila in analisis if fila.estado == "invalida"]
    if invalidas:
        detalle = "; ".join(f"fila {f.indice}: {f.detalle}" for f in invalidas[:MAX_ERRORES_EN_MENSAJE])
        if len(invalidas) > MAX_ERRORES_EN_MENSAJE:
            detalle += f"; y {len(invalidas) - MAX_ERRORES_EN_MENSAJE} más"
        raise DatosInvalidos(f"No se importó nada: {len(invalidas)} fila(s) inválida(s). {detalle}.")

    nuevas = [fila for fila in analisis if fila.estado == "nueva"]
    gastos, ingresos = _totales(analisis)
    id_importacion = None
    if nuevas:
        importacion = Importacion(
            id_usuario=usuario.id_usuario,
            id_cuenta=id_cuenta,
            nombre=" ".join((nombre or "").split()) or None,
            cantidad=len(nuevas),
        )
        db.add(importacion)
        await db.flush()
        id_importacion = importacion.id_importacion
        db.add_all([
            Movimiento(
                client_request_id=fila.clave,
                id_importacion=id_importacion,
                id_cuenta=id_cuenta,
                id_categoria=fila.datos.id_categoria,
                id_deuda=fila.datos.id_deuda,
                tipo_movimiento=fila.datos.tipo_movimiento,
                tipo_gasto=fila.datos.tipo_gasto,
                monto=fila.datos.monto,
                descripcion=fila.descripcion,
                en_lugar_compra=False,
                created_at=fila.fecha,
            )
            for fila in nuevas
        ])
        await db.flush()

    return ResultadoImportacion(
        id_importacion=id_importacion,
        creados=len(nuevas),
        omitidos_ya_importados=_contar(analisis, "ya_importada"),
        omitidos_posibles_duplicados=_contar(analisis, "posible_duplicado"),
        total_gastos=gastos,
        total_ingresos=ingresos,
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
            .outerjoin(Movimiento, Movimiento.id_importacion == Importacion.id_importacion)
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


async def deshacer_importacion(db: AsyncSession, usuario: Usuario, id_importacion: int) -> int:
    """Borra los movimientos que siguen existiendo de esa importación (con sus productos
    detallados) y la importación. Devuelve cuántos movimientos se borraron."""
    importacion = await db.scalar(
        select(Importacion).where(
            Importacion.id_importacion == id_importacion,
            Importacion.id_usuario == usuario.id_usuario,
        )
    )
    if not importacion:
        raise NoEncontrado("Importación no encontrada.")
    resultado = await db.execute(delete(Movimiento).where(Movimiento.id_importacion == id_importacion))
    await db.delete(importacion)
    await db.flush()
    return resultado.rowcount
