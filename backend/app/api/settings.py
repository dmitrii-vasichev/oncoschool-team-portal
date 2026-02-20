import logging
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user, require_admin, require_moderator

logger = logging.getLogger(__name__)

# Simple in-memory cooldown for bulk operations (member_id -> last_call_timestamp)
_bulk_cooldowns: dict[str, float] = {}
BULK_COOLDOWN_SECONDS = 30
REMINDER_TIMEZONE = "Europe/Moscow"
from app.db.database import get_session
from app.db.models import TeamMember
from app.db.repositories import (
    AppSettingsRepository,
    NotificationSubscriptionRepository,
    ReminderSettingsRepository,
)
from app.db.schemas import (
    AIProviderUpdate,
    NotificationSubscriptionResponse,
    ReminderSettingsResponse,
    ReminderSettingsUpdate,
)
from app.services.ai_service import AIService

router = APIRouter(prefix="/settings", tags=["settings"])
sub_repo = NotificationSubscriptionRepository()
reminder_repo = ReminderSettingsRepository()
app_settings_repo = AppSettingsRepository()
ai_service = AIService()


# ── Notification Subscriptions ──

EVENT_TYPES = [
    "task_created",
    "task_status_changed",
    "task_completed",
    "task_overdue",
    "task_update_added",
    "meeting_created",
]


class SubscriptionsResponse(BaseModel):
    subscriptions: dict[str, bool]


class SubscriptionsUpdate(BaseModel):
    subscriptions: dict[str, bool]


@router.get("/notifications", response_model=SubscriptionsResponse)
async def get_notifications(
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Get notification subscriptions. Moderator only."""
    subs = await sub_repo.get_by_member(session, member.id)
    subs_map = {s.event_type: s.is_active for s in subs}
    # Fill in missing event types as False
    result = {et: subs_map.get(et, False) for et in EVENT_TYPES}
    return SubscriptionsResponse(subscriptions=result)


@router.put("/notifications", response_model=SubscriptionsResponse)
async def update_notifications(
    data: SubscriptionsUpdate,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Update notification subscriptions. Moderator only."""
    for event_type, is_active in data.subscriptions.items():
        if event_type not in EVENT_TYPES:
            raise HTTPException(
                status_code=400, detail=f"Неизвестный тип события: {event_type}"
            )
        await sub_repo.upsert(session, member.id, event_type, is_active)
    await session.commit()

    # Return updated state
    subs = await sub_repo.get_by_member(session, member.id)
    subs_map = {s.event_type: s.is_active for s in subs}
    result = {et: subs_map.get(et, False) for et in EVENT_TYPES}
    return SubscriptionsResponse(subscriptions=result)


# ── Reminder Settings ──


@router.get("/reminders/{member_id}", response_model=ReminderSettingsResponse | None)
async def get_reminder_settings(
    member_id: uuid.UUID,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Get reminder settings for a member. Moderator only."""
    rs = await reminder_repo.get_by_member(session, member_id)
    return rs


@router.put("/reminders/{member_id}", response_model=ReminderSettingsResponse)
async def update_reminder_settings(
    member_id: uuid.UUID,
    data: ReminderSettingsUpdate,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Update reminder settings for a member. Moderator only."""
    update_data = data.model_dump(exclude_unset=True)
    update_data["configured_by_id"] = member.id
    # Portal reminder time is interpreted in Moscow timezone.
    update_data["timezone"] = REMINDER_TIMEZONE

    rs = await reminder_repo.upsert(session, member_id, **update_data)
    await session.commit()
    return rs


class BulkReminderRequest(BaseModel):
    is_enabled: bool
    reminder_time: str | None = None  # HH:MM format
    days_of_week: list[int] | None = None


@router.post("/reminders/bulk", response_model=dict)
async def bulk_update_reminders(
    data: BulkReminderRequest,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Bulk update reminder settings for all members. Moderator only."""
    # Throttle bulk operations
    member_key = str(member.id)
    now = time.time()
    last_call = _bulk_cooldowns.get(member_key, 0)
    if now - last_call < BULK_COOLDOWN_SECONDS:
        raise HTTPException(
            status_code=429,
            detail=f"Слишком частые запросы. Подождите {BULK_COOLDOWN_SECONDS} секунд.",
        )
    _bulk_cooldowns[member_key] = now

    from datetime import time as time_type
    from app.db.repositories import TeamMemberRepository

    member_repo = TeamMemberRepository()
    all_members = await member_repo.get_all_active(session)

    # Validate time format
    parsed_time = None
    if data.reminder_time:
        try:
            parts = data.reminder_time.split(":")
            if len(parts) != 2:
                raise ValueError()
            h, m_val = int(parts[0]), int(parts[1])
            if not (0 <= h < 24 and 0 <= m_val < 60):
                raise ValueError()
            parsed_time = time_type(h, m_val)
        except (ValueError, IndexError):
            raise HTTPException(
                status_code=400,
                detail="Неверный формат времени. Используйте HH:MM (00:00 — 23:59)",
            )

    # Validate days_of_week
    if data.days_of_week:
        for d in data.days_of_week:
            if not (0 <= d <= 6):
                raise HTTPException(
                    status_code=400,
                    detail="days_of_week должен содержать числа от 0 (Пн) до 6 (Вс)",
                )

    updated_count = 0
    for m in all_members:
        kwargs = {
            "is_enabled": data.is_enabled,
            "configured_by_id": member.id,
            "timezone": REMINDER_TIMEZONE,
        }
        if parsed_time:
            kwargs["reminder_time"] = parsed_time
        if data.days_of_week:
            kwargs["days_of_week"] = data.days_of_week

        await reminder_repo.upsert(session, m.id, **kwargs)
        updated_count += 1
    await session.commit()

    return {"updated": updated_count}


# ── AI Provider Settings ──


class AISettingsResponse(BaseModel):
    current_provider: str
    current_model: str
    available_providers: dict[str, bool]
    providers_config: dict | None = None


@router.get("/ai", response_model=AISettingsResponse)
async def get_ai_settings(
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get current AI provider and available options."""
    info = await ai_service.get_current_provider_info(session)
    available = ai_service.get_available_providers()

    # Get providers config
    config_setting = await app_settings_repo.get(session, "ai_providers_config")
    providers_config = config_setting.value if config_setting else None

    return AISettingsResponse(
        current_provider=info["provider"],
        current_model=info["model"],
        available_providers=available,
        providers_config=providers_config,
    )


@router.put("/ai", response_model=AISettingsResponse)
async def update_ai_settings(
    data: AIProviderUpdate,
    member: TeamMember = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Change AI provider and model. Admin only."""
    # Validate provider is available
    available = ai_service.get_available_providers()
    if data.provider not in available:
        raise HTTPException(
            status_code=400,
            detail=f"Провайдер '{data.provider}' недоступен (нет API ключа)",
        )

    # Validate model is valid for provider
    config_setting = await app_settings_repo.get(session, "ai_providers_config")
    if config_setting:
        provider_config = config_setting.value.get(data.provider, {})
        valid_models = provider_config.get("models", [])
        if valid_models and data.model not in valid_models:
            raise HTTPException(
                status_code=400,
                detail=f"Модель '{data.model}' недоступна для {data.provider}. "
                       f"Доступные: {', '.join(valid_models)}",
            )

    await app_settings_repo.set(
        session,
        "ai_provider",
        {"provider": data.provider, "model": data.model},
        updated_by_id=member.id,
    )
    await session.commit()

    # Return updated state
    providers_config = config_setting.value if config_setting else None
    return AISettingsResponse(
        current_provider=data.provider,
        current_model=data.model,
        available_providers=available,
        providers_config=providers_config,
    )
