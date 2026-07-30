from pydantic import BaseModel, Field, field_validator


class PushKeys(BaseModel):
    p256dh: str = Field(min_length=20, max_length=255)
    auth: str = Field(min_length=8, max_length=255)


class PushSubscriptionCreate(BaseModel):
    endpoint: str = Field(min_length=20, max_length=4096)
    keys: PushKeys

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, value: str) -> str:
        if not value.startswith("https://"):
            raise ValueError("El endpoint Push debe usar HTTPS.")
        return value


class PushSubscriptionDelete(BaseModel):
    endpoint: str = Field(min_length=20, max_length=4096)


class NotificationPreferenceUpdate(BaseModel):
    training_reminders_enabled: bool


class PushConfigResponse(BaseModel):
    configured: bool
    vapid_public_key: str | None
    reminder_minutes: list[int]


class PushStatusResponse(BaseModel):
    configured: bool
    training_reminders_enabled: bool
    active_subscriptions: int
