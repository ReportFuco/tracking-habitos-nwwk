import os
from dotenv import load_dotenv
from pathlib import Path


load_dotenv()


def _parse_csv_env(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _parse_bool_env(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


# Detalles de la API
TITLE_API = os.getenv("TITLE_API", "Tracking Hábitos")
VERSION_API = os.getenv("VERSION", "0.1.0")
PORT = int(os.getenv("PORT", 8000))
URL_SITE = os.getenv("URL_SITE", "").strip() or f"http://localhost:{PORT}"
CORS_ORIGINS = _parse_csv_env(os.getenv("CORS_ORIGINS"))

# api openai
API_KEY = os.getenv("APIKEY_OPENAI")

# Datos de la base de datos
DATABASE_URL = os.getenv("DATABASE_URL", "")
DATABASE_NAME = os.getenv("DATABASE_NAME", "")
DATABASE_USER = os.getenv("DATABASE_USER", "")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD", "")
DATABASE_HOST = os.getenv("DATABASE_HOST")
DATABASE_PORT = os.getenv("DATABASE_PORT")


# Alembic
ALEMBIC_VERSIONS_PATH = Path("app/alembic/versions")
ALEMBIC_INI = "app/alembic.ini" 


# Sin default: un fallback constante permitiria firmar tokens validos para cualquier
# usuario con solo leer el codigo fuente.
SECRET = os.getenv("SECRET_JWT", "")

if not SECRET:
    raise RuntimeError(
        "Falta SECRET_JWT. Genera uno con "
        '`python -c "import secrets; print(secrets.token_urlsafe(64))"` '
        "y agregalo al .env antes de levantar la API."
    )

# Sesion web para browser/PWA. Es opaca, revocable y se almacena en auth.web_session.
SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "tcl_session")
SESSION_IDLE_DAYS = int(os.getenv("SESSION_IDLE_DAYS", "30"))
SESSION_ABSOLUTE_DAYS = int(os.getenv("SESSION_ABSOLUTE_DAYS", "90"))
ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "15"))
SESSION_COOKIE_SECURE = _parse_bool_env(
    os.getenv("SESSION_COOKIE_SECURE"),
    default=URL_SITE.startswith("https://"),
)

# Web Push. Las llaves VAPID identifican a este servidor ante APNs/FCM.
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "").strip()
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "").strip()
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "").strip()
TRAINING_REMINDER_FIRST_MINUTES = int(os.getenv("TRAINING_REMINDER_FIRST_MINUTES", "60"))
TRAINING_REMINDER_SECOND_MINUTES = int(os.getenv("TRAINING_REMINDER_SECOND_MINUTES", "120"))
PUSH_WORKER_POLL_SECONDS = int(os.getenv("PUSH_WORKER_POLL_SECONDS", "20"))
PUSH_MAX_ATTEMPTS = int(os.getenv("PUSH_MAX_ATTEMPTS", "3"))

if SESSION_IDLE_DAYS <= 0:
    raise RuntimeError("SESSION_IDLE_DAYS debe ser mayor que cero.")
if SESSION_ABSOLUTE_DAYS < SESSION_IDLE_DAYS:
    raise RuntimeError("SESSION_ABSOLUTE_DAYS debe ser mayor o igual a SESSION_IDLE_DAYS.")
if ACCESS_TOKEN_MINUTES <= 0:
    raise RuntimeError("ACCESS_TOKEN_MINUTES debe ser mayor que cero.")
if TRAINING_REMINDER_FIRST_MINUTES <= 0:
    raise RuntimeError("TRAINING_REMINDER_FIRST_MINUTES debe ser mayor que cero.")
if TRAINING_REMINDER_SECOND_MINUTES <= TRAINING_REMINDER_FIRST_MINUTES:
    raise RuntimeError("El segundo recordatorio debe ser posterior al primero.")
if PUSH_WORKER_POLL_SECONDS <= 0 or PUSH_MAX_ATTEMPTS <= 0:
    raise RuntimeError("La configuracion del worker Push debe usar valores positivos.")
if any((VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)) and not all(
    (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT)
):
    raise RuntimeError("La configuracion VAPID debe incluir las tres variables.")
if VAPID_SUBJECT and not VAPID_SUBJECT.startswith(("mailto:", "https://")):
    raise RuntimeError("VAPID_SUBJECT debe comenzar con mailto: o https://.")


__all__ = [
    "TITLE_API", 
    "VERSION_API", 
    "PORT", 
    "URL_SITE", 
    "CORS_ORIGINS",
    "API_KEY", 
    "DATABASE_URL",
    "DATABASE_NAME",
    "DATABASE_USER",
    "DATABASE_PASSWORD",
    "DATABASE_HOST",
    "DATABASE_PORT",
    "ALEMBIC_VERSIONS_PATH",
    "ALEMBIC_INI",
    "SECRET",
    "SESSION_COOKIE_NAME",
    "SESSION_IDLE_DAYS",
    "SESSION_ABSOLUTE_DAYS",
    "ACCESS_TOKEN_MINUTES",
    "SESSION_COOKIE_SECURE",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "VAPID_SUBJECT",
    "TRAINING_REMINDER_FIRST_MINUTES",
    "TRAINING_REMINDER_SECOND_MINUTES",
    "PUSH_WORKER_POLL_SECONDS",
    "PUSH_MAX_ATTEMPTS",
]
