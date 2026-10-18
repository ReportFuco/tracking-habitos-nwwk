import json
from urllib.parse import urljoin

from pywebpush import webpush

from app.models import PushSubscription
from app.settings import URL_SITE, VAPID_PRIVATE_KEY, VAPID_SUBJECT


def build_training_payload(milestone: str) -> str:
    elapsed = "una hora" if milestone == "1h" else "dos horas"
    body = (
        f"Tu entrenamiento lleva {elapsed} activo. "
        "Si ya terminaste, recuerda cerrar la sesion."
    )
    navigate = urljoin(f"{URL_SITE.rstrip('/')}/", "app/entrenamientos/activo")
    return json.dumps(
        {
            # Declarative Web Push (Safari 18.4+) y datos que consume nuestro service
            # worker como fallback en navegadores que aun no lo implementan.
            "web_push": 8030,
            "notification": {
                "title": "¿Sigues entrenando?",
                "lang": "es-CL",
                "dir": "ltr",
                "body": body,
                "navigate": navigate,
                "silent": False,
                "app_badge": "1",
                "tag": f"training-reminder-{milestone}",
            },
        },
        ensure_ascii=False,
    )


def build_expense_payload() -> str:
    navigate = urljoin(f"{URL_SITE.rstrip('/')}/", "app/finanzas/registrar-movimiento")
    return json.dumps(
        {
            "web_push": 8030,
            "notification": {
                "title": "¿Anotaste tus gastos de hoy?",
                "lang": "es-CL",
                "dir": "ltr",
                "body": "Hoy todavía no registras ningún gasto. Te toma un minuto.",
                "navigate": navigate,
                "silent": False,
                "app_badge": "1",
                # Un solo aviso visible: el de mañana reemplaza al de hoy si sigue ahi.
                "tag": "expense-reminder",
            },
        },
        ensure_ascii=False,
    )


def build_budget_payload(title: str, body: str) -> str:
    navigate = urljoin(f"{URL_SITE.rstrip('/')}/", "app/finanzas/semana")
    return json.dumps(
        {
            "web_push": 8030,
            "notification": {
                "title": title,
                "lang": "es-CL",
                "dir": "ltr",
                "body": body,
                "navigate": navigate,
                "silent": False,
                "app_badge": "1",
                # Una alerta nueva de metas reemplaza a la anterior si sigue visible.
                "tag": "budget-alert",
            },
        },
        ensure_ascii=False,
    )


def send_push(subscription: PushSubscription, payload: str, ttl: int) -> None:
    webpush(
        subscription_info={
            "endpoint": subscription.endpoint,
            "keys": {
                "p256dh": subscription.p256dh,
                "auth": subscription.auth_key,
            },
        },
        data=payload,
        vapid_private_key=VAPID_PRIVATE_KEY,
        vapid_claims={"sub": VAPID_SUBJECT},
        ttl=ttl,
    )


def send_training_push(subscription: PushSubscription, milestone: str) -> None:
    send_push(subscription, build_training_payload(milestone), ttl=60 * 60)


def send_expense_push(subscription: PushSubscription) -> None:
    # Si el telefono esta apagado, el aviso aun sirve unas horas despues; al dia
    # siguiente ya no.
    send_push(subscription, build_expense_payload(), ttl=3 * 60 * 60)


def send_budget_push(subscription: PushSubscription, title: str, body: str) -> None:
    # Una alerta de gasto pierde sentido si llega al dia siguiente.
    send_push(subscription, build_budget_payload(title, body), ttl=6 * 60 * 60)
