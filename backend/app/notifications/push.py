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


def send_training_push(subscription: PushSubscription, milestone: str) -> None:
    webpush(
        subscription_info={
            "endpoint": subscription.endpoint,
            "keys": {
                "p256dh": subscription.p256dh,
                "auth": subscription.auth_key,
            },
        },
        data=build_training_payload(milestone),
        vapid_private_key=VAPID_PRIVATE_KEY,
        vapid_claims={"sub": VAPID_SUBJECT},
        ttl=60 * 60,
    )
