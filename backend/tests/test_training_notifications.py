import json
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.main import app
from app.notifications.push import build_training_payload
from app.notifications import push
from app.notifications.service import (
    cancel_training_reminders,
    schedule_training_reminders,
)


class FakeDatabase:
    def __init__(self):
        self.added = []
        self.statement = None

    def add_all(self, values):
        self.added.extend(values)

    async def execute(self, statement):
        self.statement = statement


def test_notification_endpoints_are_exposed():
    paths = app.openapi()["paths"]

    assert "/api/notifications/config" in paths
    assert "/api/notifications/status" in paths
    assert "/api/notifications/subscriptions" in paths


def test_start_schedules_one_and_two_hour_reminders():
    db = FakeDatabase()
    started_at = datetime(2026, 7, 28, 12, 30, tzinfo=timezone.utc)
    workout = SimpleNamespace(
        id_entrenamiento_fuerza=17,
        inicio_at=started_at,
    )

    reminders = schedule_training_reminders(db, workout)

    assert [item.milestone for item in reminders] == ["1h", "2h"]
    assert [int((item.send_at - started_at).total_seconds() / 60) for item in reminders] == [
        60,
        120,
    ]
    assert all(item.id_entrenamiento_fuerza == 17 for item in reminders)


@pytest.mark.asyncio
async def test_close_builds_bulk_cancellation():
    db = FakeDatabase()

    await cancel_training_reminders(db, 17)

    compiled = str(db.statement)
    assert "training_reminder" in compiled
    assert "id_entrenamiento_fuerza" in compiled
    assert "status" in compiled


def test_push_payload_opens_active_workout_and_uses_declarative_format():
    payload = json.loads(build_training_payload("1h"))

    assert payload["web_push"] == 8030
    assert payload["notification"]["title"] == "¿Sigues entrenando?"
    assert payload["notification"]["navigate"].endswith("/app/entrenamientos/activo")
    assert "una hora" in payload["notification"]["body"]


def test_sender_uses_subscription_keys_and_one_hour_ttl(monkeypatch):
    captured = {}

    def fake_webpush(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(push, "webpush", fake_webpush)
    monkeypatch.setattr(push, "VAPID_PRIVATE_KEY", "private-test")
    monkeypatch.setattr(push, "VAPID_SUBJECT", "mailto:test@example.com")
    subscription = SimpleNamespace(
        endpoint="https://push.example.test/subscription",
        p256dh="public-device-key",
        auth_key="auth-device-key",
    )

    push.send_training_push(subscription, "2h")

    assert captured["subscription_info"]["endpoint"] == subscription.endpoint
    assert captured["subscription_info"]["keys"]["auth"] == subscription.auth_key
    assert captured["ttl"] == 60 * 60
