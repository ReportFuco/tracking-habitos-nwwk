import json
from datetime import date, datetime, time
from types import SimpleNamespace

from app.main import app
from app.notifications import push
from app.notifications.gastos import CHILE_TZ, mark_today_if_time_passed
from app.notifications.push import build_expense_payload
from app.schemas.notifications import NotificationPreferenceUpdate


def test_payload_abre_el_registro_de_gastos():
    payload = json.loads(build_expense_payload())

    assert payload["web_push"] == 8030
    assert payload["notification"]["navigate"].endswith("/app/finanzas/registrar-movimiento")
    assert payload["notification"]["tag"] == "expense-reminder"


def test_aviso_de_gastos_vence_en_tres_horas(monkeypatch):
    captured = {}
    monkeypatch.setattr(push, "webpush", lambda **kwargs: captured.update(kwargs))
    subscription = SimpleNamespace(endpoint="https://push.example.test/x", p256dh="p", auth_key="a")

    push.send_expense_push(subscription)

    assert captured["ttl"] == 3 * 60 * 60
    assert "registrar-movimiento" in captured["data"]


def test_si_la_hora_ya_paso_no_avisa_hasta_manana():
    preference = SimpleNamespace(expense_reminder_time=time(21, 0), expense_reminder_last_on=None)

    mark_today_if_time_passed(preference, datetime(2026, 10, 15, 23, 0, tzinfo=CHILE_TZ))

    assert preference.expense_reminder_last_on == date(2026, 10, 15)


def test_si_la_hora_no_llega_avisa_hoy():
    preference = SimpleNamespace(expense_reminder_time=time(21, 0), expense_reminder_last_on=None)

    mark_today_if_time_passed(preference, datetime(2026, 10, 15, 9, 0, tzinfo=CHILE_TZ))

    assert preference.expense_reminder_last_on is None


def test_hora_del_aviso_se_guarda_sin_segundos():
    data = NotificationPreferenceUpdate(expense_reminder_time="20:30:45")

    assert data.expense_reminder_time == time(20, 30)
    assert data.training_reminders_enabled is None


def test_endpoint_de_preferencias_expuesto():
    assert "/api/notifications/preferences" in app.openapi()["paths"]
