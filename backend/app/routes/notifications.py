from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.fastapi_users import current_user
from app.db.session import get_db
from app.models import NotificationPreference, PushSubscription
from app.schemas.notifications import (
    NotificationPreferenceUpdate,
    PushConfigResponse,
    PushStatusResponse,
    PushSubscriptionCreate,
    PushSubscriptionDelete,
)
from app.settings import (
    TRAINING_REMINDER_FIRST_MINUTES,
    TRAINING_REMINDER_SECOND_MINUTES,
    VAPID_PRIVATE_KEY,
    VAPID_PUBLIC_KEY,
    VAPID_SUBJECT,
)


router = APIRouter(prefix="/notifications", tags=["Notificaciones"])


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def push_is_configured() -> bool:
    return bool(VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY and VAPID_SUBJECT)


async def get_or_create_preference(
    db: AsyncSession,
    auth_user_id: int,
) -> NotificationPreference:
    preference = await db.get(NotificationPreference, auth_user_id)
    if preference is None:
        preference = NotificationPreference(auth_user_id=auth_user_id)
        db.add(preference)
        await db.flush()
    return preference


@router.get("/config", response_model=PushConfigResponse)
async def get_push_config(user=Depends(current_user)) -> PushConfigResponse:
    return PushConfigResponse(
        configured=push_is_configured(),
        vapid_public_key=VAPID_PUBLIC_KEY or None,
        reminder_minutes=[
            TRAINING_REMINDER_FIRST_MINUTES,
            TRAINING_REMINDER_SECOND_MINUTES,
        ],
    )


@router.get("/status", response_model=PushStatusResponse)
async def get_push_status(
    user=Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> PushStatusResponse:
    preference = await get_or_create_preference(db, user.id)
    subscription_count = await db.scalar(
        select(func.count(PushSubscription.id_subscription)).where(
            PushSubscription.auth_user_id == user.id,
            PushSubscription.enabled.is_(True),
        )
    )
    return PushStatusResponse(
        configured=push_is_configured(),
        training_reminders_enabled=preference.training_reminders_enabled,
        active_subscriptions=subscription_count or 0,
    )


@router.post("/subscriptions", response_model=PushStatusResponse)
async def subscribe_device(
    data: PushSubscriptionCreate,
    request: Request,
    user=Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> PushStatusResponse:
    if not push_is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Web Push aun no esta configurado en el servidor.",
        )

    now = utc_now()
    subscription = await db.scalar(
        select(PushSubscription).where(PushSubscription.endpoint == data.endpoint)
    )
    if subscription is None:
        subscription = PushSubscription(
            auth_user_id=user.id,
            endpoint=data.endpoint,
            p256dh=data.keys.p256dh,
            auth_key=data.keys.auth,
        )
        db.add(subscription)
    else:
        # Un endpoint pertenece al navegador, no para siempre a una cuenta. Si el mismo
        # dispositivo cambia de usuario, se reasigna al usuario autenticado actual.
        subscription.auth_user_id = user.id
        subscription.p256dh = data.keys.p256dh
        subscription.auth_key = data.keys.auth

    subscription.enabled = True
    subscription.failure_count = 0
    subscription.disabled_at = None
    subscription.updated_at = now
    subscription.user_agent = request.headers.get("user-agent", "")[:255] or None

    preference = await get_or_create_preference(db, user.id)
    preference.training_reminders_enabled = True
    preference.updated_at = now
    await db.flush()

    subscription_count = await db.scalar(
        select(func.count(PushSubscription.id_subscription)).where(
            PushSubscription.auth_user_id == user.id,
            PushSubscription.enabled.is_(True),
        )
    )
    return PushStatusResponse(
        configured=True,
        training_reminders_enabled=True,
        active_subscriptions=subscription_count or 0,
    )


@router.post("/subscriptions/unsubscribe", response_model=PushStatusResponse)
async def unsubscribe_device(
    data: PushSubscriptionDelete,
    user=Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> PushStatusResponse:
    subscription = await db.scalar(
        select(PushSubscription).where(
            PushSubscription.endpoint == data.endpoint,
            PushSubscription.auth_user_id == user.id,
        )
    )
    if subscription is not None:
        subscription.enabled = False
        subscription.disabled_at = utc_now()
        subscription.updated_at = utc_now()

    preference = await get_or_create_preference(db, user.id)
    await db.flush()
    subscription_count = await db.scalar(
        select(func.count(PushSubscription.id_subscription)).where(
            PushSubscription.auth_user_id == user.id,
            PushSubscription.enabled.is_(True),
        )
    )
    return PushStatusResponse(
        configured=push_is_configured(),
        training_reminders_enabled=preference.training_reminders_enabled,
        active_subscriptions=subscription_count or 0,
    )


@router.patch("/preferences", response_model=PushStatusResponse)
async def update_preferences(
    data: NotificationPreferenceUpdate,
    user=Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> PushStatusResponse:
    preference = await get_or_create_preference(db, user.id)
    preference.training_reminders_enabled = data.training_reminders_enabled
    preference.updated_at = utc_now()
    subscription_count = await db.scalar(
        select(func.count(PushSubscription.id_subscription)).where(
            PushSubscription.auth_user_id == user.id,
            PushSubscription.enabled.is_(True),
        )
    )
    return PushStatusResponse(
        configured=push_is_configured(),
        training_reminders_enabled=preference.training_reminders_enabled,
        active_subscriptions=subscription_count or 0,
    )
