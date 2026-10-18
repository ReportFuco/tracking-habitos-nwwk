"""Alertas Push de metas de gasto y resumen semanal del domingo.

El worker evalúa cada minuto a los usuarios con avisos de metas activos, un dispositivo
suscrito y una meta o presupuesto fijado. Las alertas salen de
services.finanzas.semanal.alertas_semana (las mismas que muestra la app); cada una se
envía una sola vez gracias a notificaciones.alerta_gasto.
"""
import logging
from datetime import datetime, time, timedelta

from sqlalchemy import exists, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AlertaGasto,
    MetaGasto,
    NotificationPreference,
    PreferenciaCategoria,
    PushSubscription,
    Usuario,
)
from app.notifications.gastos import chile_now, send_to_user_devices
from app.notifications.push import send_budget_push
from app.schemas.finanzas import AlertaSemana, ResumenSemanalResponse
from app.services.finanzas import semanal


logger = logging.getLogger("budget-push")
EVALUAR_CADA = timedelta(seconds=60)
# El resumen de la semana llega el domingo desde esta hora (Chile).
HORA_RESUMEN = time(20, 0)
_ultima_evaluacion: datetime | None = None


def alerta_resumen(resumen: ResumenSemanalResponse) -> AlertaSemana:
    """Cierre de la semana: gasto contra la meta y contra la semana anterior."""
    gasto = resumen.gasto_semana
    meta = resumen.meta_semanal
    if meta:
        titulo = f"Tu semana: {semanal.formato_clp(gasto)} de {semanal.formato_clp(meta)}"
        if gasto <= meta:
            mensaje = f"Cumpliste la meta y te sobraron {semanal.formato_clp(meta - gasto)}."
        else:
            mensaje = f"Te pasaste de la meta por {semanal.formato_clp(gasto - meta)}."
    else:
        titulo = f"Tu semana: {semanal.formato_clp(gasto)}"
        mensaje = ""

    anterior = resumen.gasto_semana_anterior
    if anterior:
        variacion = (gasto - anterior) / anterior * 100
        if abs(variacion) < 1:
            mensaje += " Igual que la semana pasada."
        elif variacion < 0:
            mensaje += f" {round(-variacion)}% menos que la semana pasada."
        else:
            mensaje += f" {round(variacion)}% más que la semana pasada."
    return AlertaSemana(
        clave=f"{resumen.semana_inicio.isoformat()}:resumen",
        nivel="info",
        titulo=titulo,
        mensaje=mensaje.strip() or "Revisa en qué se fue tu semana.",
    )


def alertas_a_enviar(resumen: ResumenSemanalResponse, now: datetime) -> list[AlertaSemana]:
    """Las de nivel aviso o excedido (las informativas solo se ven en la app) y, el
    domingo desde HORA_RESUMEN, el resumen de la semana."""
    alertas = [alerta for alerta in resumen.alertas if alerta.nivel != "info"]
    if now.weekday() == 6 and now.time().replace(tzinfo=None) >= HORA_RESUMEN:
        alertas.append(alerta_resumen(resumen))
    return alertas


async def reclamar_alertas(db: AsyncSession, auth_user_id: int, claves: list[str]) -> set[str]:
    """Registra las claves y devuelve las que no se habían enviado antes.

    Al superar el 100% también se marca el 80% de lo mismo: si se borrara un gasto y se
    volviera a bajar del tope, no tiene sentido avisar del 80% después.
    """
    if not claves:
        return set()
    todas = set(claves)
    todas |= {clave.removesuffix(":100") + ":80" for clave in claves if clave.endswith(":100")}
    nuevas = await db.scalars(
        insert(AlertaGasto)
        .values([{"auth_user_id": auth_user_id, "clave": clave} for clave in sorted(todas)])
        .on_conflict_do_nothing(constraint="uq_alerta_gasto_usuario_clave")
        .returning(AlertaGasto.clave)
    )
    return set(nuevas.all()) & set(claves)


async def usuarios_con_metas(db: AsyncSession) -> list[tuple[int, int]]:
    """(auth_user_id, id_usuario) de quienes pueden recibir alertas de metas."""
    filas = await db.execute(
        select(NotificationPreference.auth_user_id, Usuario.id_usuario)
        .join(Usuario, Usuario.auth_user_id == NotificationPreference.auth_user_id)
        .where(
            NotificationPreference.budget_alerts_enabled.is_(True),
            exists().where(
                PushSubscription.auth_user_id == NotificationPreference.auth_user_id,
                PushSubscription.enabled.is_(True),
            ),
            or_(
                exists().where(
                    MetaGasto.id_usuario == Usuario.id_usuario,
                    MetaGasto.meta_semanal.is_not(None),
                ),
                exists().where(
                    PreferenciaCategoria.id_usuario == Usuario.id_usuario,
                    PreferenciaCategoria.presupuesto_semanal.is_not(None),
                ),
            ),
        )
    )
    return [(auth_user_id, id_usuario) for auth_user_id, id_usuario in filas.all()]


async def evaluar_usuario(db: AsyncSession, auth_user_id: int, id_usuario: int, now: datetime) -> int:
    """Envía la alerta nueva más grave del usuario, si hay. Devuelve a cuántos
    dispositivos llegó."""
    usuario = await db.get(Usuario, id_usuario)
    if usuario is None:
        return 0
    resumen = await semanal.resumen_semanal(db, usuario, hoy=now.date())
    alertas = alertas_a_enviar(resumen, now)
    nuevas = await reclamar_alertas(db, auth_user_id, [alerta.clave for alerta in alertas])
    await db.commit()
    pendientes = [alerta for alerta in alertas if alerta.clave in nuevas]
    if not pendientes:
        return 0

    # Una sola notificación: la más grave, y si hay más se mencionan.
    principal = pendientes[0]
    cuerpo = principal.mensaje
    if len(pendientes) > 1:
        otras = len(pendientes) - 1
        cuerpo += f" (+{otras} {'alerta' if otras == 1 else 'alertas'} más)"
    return await send_to_user_devices(
        db,
        auth_user_id,
        lambda subscription: send_budget_push(subscription, principal.titulo, cuerpo),
        "metas",
    )


async def process_budget_alerts(session_factory, now: datetime | None = None) -> None:
    global _ultima_evaluacion
    now = now or chile_now()
    if _ultima_evaluacion is not None and now - _ultima_evaluacion < EVALUAR_CADA:
        return
    _ultima_evaluacion = now

    async with session_factory() as db:
        candidatos = await usuarios_con_metas(db)
    for auth_user_id, id_usuario in candidatos:
        try:
            async with session_factory() as db:
                await evaluar_usuario(db, auth_user_id, id_usuario, now)
        except Exception:
            logger.exception("No se pudieron evaluar las metas de %s", auth_user_id)
