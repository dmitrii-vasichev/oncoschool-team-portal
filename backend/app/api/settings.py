import logging
import time
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user, require_admin, require_moderator

logger = logging.getLogger(__name__)

# Simple in-memory cooldown for bulk operations (member_id -> last_call_timestamp)
_bulk_cooldowns: dict[str, float] = {}
BULK_COOLDOWN_SECONDS = 30
REMINDER_TIMEZONE = "Europe/Moscow"
MEETING_REMINDER_TEXTS_KEY = "meeting_reminder_texts"
MEETING_WEEKLY_DIGEST_SETTINGS_KEY = "meeting_weekly_digest_settings"
ALLOWED_MEETING_REMINDER_OFFSETS_MINUTES = {0, 15, 30, 60, 120}
DEFAULT_MEETING_WEEKLY_DIGEST_DAY = 7
DEFAULT_MEETING_WEEKLY_DIGEST_TIME = "21:00"
DEFAULT_MEETING_WEEKLY_DIGEST_TEMPLATE = (
    "Наши встречи с {week_start} по {week_end}:\n\n{meetings}"
)
from app.db.database import get_session
from app.db.models import TeamMember
from app.db.repositories import (
    AppSettingsRepository,
    NotificationSubscriptionRepository,
    ReminderSettingsRepository,
    TelegramTargetRepository,
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
target_repo = TelegramTargetRepository()
ai_service = AIService()


def _normalize_meeting_reminder_texts(
    raw_value: dict | None,
) -> dict[str, str]:
    source: dict = {}
    if isinstance(raw_value, dict):
        nested = raw_value.get("texts_by_offset")
        if isinstance(nested, dict):
            source = nested
        else:
            source = raw_value

    normalized: dict[str, str] = {}
    for raw_key, raw_text in source.items():
        try:
            offset = int(raw_key)
        except (TypeError, ValueError):
            continue
        if offset not in ALLOWED_MEETING_REMINDER_OFFSETS_MINUTES:
            continue
        text = str(raw_text or "").strip()
        if text:
            normalized[str(offset)] = text

    # Keep stable ordering for deterministic responses.
    ordered_items = sorted(
        normalized.items(),
        key=lambda item: int(item[0]),
        reverse=True,
    )
    return dict(ordered_items)


def _parse_hhmm(value: str) -> tuple[int, int]:
    raw = str(value or "").strip()
    parts = raw.split(":")
    if len(parts) != 2:
        raise ValueError("Неверный формат времени")
    hour = int(parts[0])
    minute = int(parts[1])
    if not (0 <= hour < 24 and 0 <= minute < 60):
        raise ValueError("Время должно быть в диапазоне 00:00 — 23:59")
    return hour, minute


def _normalize_meeting_weekly_digest_settings(raw_value: dict | None) -> dict:
    source = raw_value if isinstance(raw_value, dict) else {}

    enabled = bool(source.get("enabled", False))

    try:
        day_of_week = int(source.get("day_of_week", DEFAULT_MEETING_WEEKLY_DIGEST_DAY))
    except (TypeError, ValueError):
        day_of_week = DEFAULT_MEETING_WEEKLY_DIGEST_DAY
    if day_of_week < 1 or day_of_week > 7:
        day_of_week = DEFAULT_MEETING_WEEKLY_DIGEST_DAY

    time_local = str(source.get("time_local", DEFAULT_MEETING_WEEKLY_DIGEST_TIME) or "").strip()
    try:
        _parse_hhmm(time_local)
    except (TypeError, ValueError):
        time_local = DEFAULT_MEETING_WEEKLY_DIGEST_TIME

    raw_target_ids = source.get("target_ids")
    normalized_target_ids: list[str] = []
    if isinstance(raw_target_ids, list):
        for raw_target_id in raw_target_ids:
            try:
                target_id = str(uuid.UUID(str(raw_target_id)))
            except (TypeError, ValueError):
                continue
            if target_id not in normalized_target_ids:
                normalized_target_ids.append(target_id)

    template = str(source.get("template") or "").strip() or DEFAULT_MEETING_WEEKLY_DIGEST_TEMPLATE

    last_sent_week_start = source.get("last_sent_week_start")
    if isinstance(last_sent_week_start, str) and last_sent_week_start.strip():
        normalized_last_sent_week_start = last_sent_week_start.strip()
    else:
        normalized_last_sent_week_start = None

    return {
        "enabled": enabled,
        "day_of_week": day_of_week,
        "time_local": time_local,
        "timezone": REMINDER_TIMEZONE,
        "target_ids": normalized_target_ids,
        "template": template,
        "last_sent_week_start": normalized_last_sent_week_start,
    }


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


# ── Meeting Reminder Text Templates ──


class MeetingReminderTextsResponse(BaseModel):
    texts_by_offset: dict[str, str]
    updated_by_id: uuid.UUID | None = None
    updated_at: datetime | None = None


class MeetingReminderTextsUpdate(BaseModel):
    texts_by_offset: dict[str, str]


@router.get(
    "/meeting-reminder-texts",
    response_model=MeetingReminderTextsResponse,
)
async def get_meeting_reminder_texts(
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Get global meeting reminder text templates. Moderator only."""
    setting = await app_settings_repo.get(session, MEETING_REMINDER_TEXTS_KEY)
    if not setting:
        return MeetingReminderTextsResponse(texts_by_offset={})

    return MeetingReminderTextsResponse(
        texts_by_offset=_normalize_meeting_reminder_texts(setting.value),
        updated_by_id=setting.updated_by_id,
        updated_at=setting.updated_at,
    )


@router.put(
    "/meeting-reminder-texts",
    response_model=MeetingReminderTextsResponse,
)
async def update_meeting_reminder_texts(
    data: MeetingReminderTextsUpdate,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Update global meeting reminder text templates. Moderator only."""
    normalized = _normalize_meeting_reminder_texts(
        {"texts_by_offset": data.texts_by_offset}
    )
    setting = await app_settings_repo.set(
        session,
        MEETING_REMINDER_TEXTS_KEY,
        {"texts_by_offset": normalized},
        updated_by_id=member.id,
    )
    await session.commit()

    return MeetingReminderTextsResponse(
        texts_by_offset=normalized,
        updated_by_id=setting.updated_by_id,
        updated_at=setting.updated_at,
    )


class MeetingWeeklyDigestSettingsResponse(BaseModel):
    enabled: bool = False
    day_of_week: int = DEFAULT_MEETING_WEEKLY_DIGEST_DAY
    time_local: str = DEFAULT_MEETING_WEEKLY_DIGEST_TIME
    timezone: str = REMINDER_TIMEZONE
    target_ids: list[uuid.UUID] = Field(default_factory=list)
    template: str = DEFAULT_MEETING_WEEKLY_DIGEST_TEMPLATE
    updated_by_id: uuid.UUID | None = None
    updated_at: datetime | None = None


class MeetingWeeklyDigestSettingsUpdate(BaseModel):
    enabled: bool = False
    day_of_week: int = DEFAULT_MEETING_WEEKLY_DIGEST_DAY
    time_local: str = DEFAULT_MEETING_WEEKLY_DIGEST_TIME
    target_ids: list[uuid.UUID] = Field(default_factory=list)
    template: str = DEFAULT_MEETING_WEEKLY_DIGEST_TEMPLATE


@router.get(
    "/meeting-weekly-digest",
    response_model=MeetingWeeklyDigestSettingsResponse,
)
async def get_meeting_weekly_digest_settings(
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Get weekly meeting digest settings. Moderator only."""
    setting = await app_settings_repo.get(session, MEETING_WEEKLY_DIGEST_SETTINGS_KEY)
    normalized = _normalize_meeting_weekly_digest_settings(setting.value if setting else None)

    return MeetingWeeklyDigestSettingsResponse(
        enabled=normalized["enabled"],
        day_of_week=normalized["day_of_week"],
        time_local=normalized["time_local"],
        timezone=REMINDER_TIMEZONE,
        target_ids=[uuid.UUID(value) for value in normalized["target_ids"]],
        template=normalized["template"],
        updated_by_id=setting.updated_by_id if setting else None,
        updated_at=setting.updated_at if setting else None,
    )


@router.put(
    "/meeting-weekly-digest",
    response_model=MeetingWeeklyDigestSettingsResponse,
)
async def update_meeting_weekly_digest_settings(
    data: MeetingWeeklyDigestSettingsUpdate,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Update weekly meeting digest settings. Moderator only."""
    try:
        _parse_hhmm(data.time_local)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Неверный формат времени. Используйте HH:MM (00:00 — 23:59)",
        )

    active_targets = await target_repo.get_all_active(session)
    active_target_ids = {target.id for target in active_targets}
    normalized_target_ids: list[uuid.UUID] = []
    for target_id in data.target_ids:
        if target_id not in active_target_ids:
            raise HTTPException(
                status_code=404,
                detail="Одна или несколько Telegram-групп не найдены",
            )
        if target_id not in normalized_target_ids:
            normalized_target_ids.append(target_id)

    if data.enabled and not normalized_target_ids:
        raise HTTPException(
            status_code=400,
            detail="Выберите хотя бы одну Telegram-группу для дайджеста",
        )

    template = str(data.template or "").strip() or DEFAULT_MEETING_WEEKLY_DIGEST_TEMPLATE
    normalized = _normalize_meeting_weekly_digest_settings(
        {
            "enabled": data.enabled,
            "day_of_week": data.day_of_week,
            "time_local": data.time_local,
            "target_ids": [str(value) for value in normalized_target_ids],
            "template": template,
        }
    )

    existing = await app_settings_repo.get(session, MEETING_WEEKLY_DIGEST_SETTINGS_KEY)
    if existing and isinstance(existing.value, dict):
        last_sent_week_start = existing.value.get("last_sent_week_start")
        if isinstance(last_sent_week_start, str) and last_sent_week_start.strip():
            normalized["last_sent_week_start"] = last_sent_week_start.strip()

    setting = await app_settings_repo.set(
        session,
        MEETING_WEEKLY_DIGEST_SETTINGS_KEY,
        normalized,
        updated_by_id=member.id,
    )
    await session.commit()

    return MeetingWeeklyDigestSettingsResponse(
        enabled=normalized["enabled"],
        day_of_week=normalized["day_of_week"],
        time_local=normalized["time_local"],
        timezone=REMINDER_TIMEZONE,
        target_ids=[uuid.UUID(value) for value in normalized["target_ids"]],
        template=normalized["template"],
        updated_by_id=setting.updated_by_id,
        updated_at=setting.updated_at,
    )


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
