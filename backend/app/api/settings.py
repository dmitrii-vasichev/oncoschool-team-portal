import logging
import time
import uuid
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user, require_admin, require_moderator
from app.db.repositories import GetCourseCredentialsRepository
from app.db.schemas import (
    AIProviderUpdate,
    GetCourseCredentialsResponse,
    GetCourseCredentialsUpdate,
    ReminderSettingsResponse,
    ReminderSettingsUpdate,
    ReportScheduleResponse,
    ReportScheduleUpdate,
)

logger = logging.getLogger(__name__)

# Simple in-memory cooldown for bulk operations (member_id -> last_call_timestamp)
_bulk_cooldowns: dict[str, float] = {}
BULK_COOLDOWN_SECONDS = 30
REMINDER_TIMEZONE = "Europe/Moscow"
MEETING_REMINDER_TEXTS_KEY = "meeting_reminder_texts"
MEETING_WEEKLY_DIGEST_SETTINGS_KEY = "meeting_weekly_digest_settings"
WEEKLY_DIGEST_ALLOWED_STATUSES = {"pending", "sent", "failed"}
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
from app.utils.encryption import encrypt
from app.services.ai_config_service import AIFeatureConfigService
from app.services.ai_service import AIService
from app.services.reminder_service import (
    ALLOWED_TASK_OVERDUE_INTERVAL_HOURS,
    DEFAULT_TASK_OVERDUE_DAILY_TIME_MSK,
    DEFAULT_TASK_OVERDUE_INTERVAL_HOURS,
    TASK_OVERDUE_NOTIFICATIONS_KEY,
    ReminderService,
    normalize_digest_sections_order,
    normalize_task_line_fields_order,
    normalize_upcoming_days,
)

router = APIRouter(prefix="/settings", tags=["settings"])
sub_repo = NotificationSubscriptionRepository()
reminder_repo = ReminderSettingsRepository()
creds_repo = GetCourseCredentialsRepository()
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


def _get_meeting_scheduler(request: Request):
    scheduler = getattr(request.app.state, "meeting_scheduler", None)
    if scheduler is None:
        raise HTTPException(
            status_code=503,
            detail="Сервис планировщика встреч недоступен",
        )
    return scheduler


def _get_reminder_service(request: Request):
    return getattr(request.app.state, "reminder_service", None)


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
    task_overdue_interval_hours: int = DEFAULT_TASK_OVERDUE_INTERVAL_HOURS
    task_overdue_daily_time_msk: str = DEFAULT_TASK_OVERDUE_DAILY_TIME_MSK


class SubscriptionsUpdate(BaseModel):
    subscriptions: dict[str, bool]
    task_overdue_interval_hours: int | None = None
    task_overdue_daily_time_msk: str | None = None


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
    interval_setting = await app_settings_repo.get(session, TASK_OVERDUE_NOTIFICATIONS_KEY)
    interval_hours, daily_time_msk = ReminderService.schedule_from_app_settings(
        interval_setting.value if interval_setting else None
    )
    return SubscriptionsResponse(
        subscriptions=result,
        task_overdue_interval_hours=interval_hours,
        task_overdue_daily_time_msk=daily_time_msk,
    )


@router.put("/notifications", response_model=SubscriptionsResponse)
async def update_notifications(
    request: Request,
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

    interval_setting = await app_settings_repo.get(session, TASK_OVERDUE_NOTIFICATIONS_KEY)
    interval_hours, daily_time_msk = ReminderService.schedule_from_app_settings(
        interval_setting.value if interval_setting else None
    )
    schedule_changed = False

    if data.task_overdue_interval_hours is not None:
        if data.task_overdue_interval_hours not in ALLOWED_TASK_OVERDUE_INTERVAL_HOURS:
            allowed = ", ".join(
                str(value) for value in sorted(ALLOWED_TASK_OVERDUE_INTERVAL_HOURS)
            )
            raise HTTPException(
                status_code=400,
                detail=f"Периодичность просроченных задач должна быть одной из: {allowed} часов.",
            )
        interval_hours = data.task_overdue_interval_hours
        schedule_changed = True

    if data.task_overdue_daily_time_msk is not None:
        try:
            hh, mm = _parse_hhmm(data.task_overdue_daily_time_msk)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=400,
                detail="Неверный формат времени для просроченных задач. Используйте HH:MM (00:00 — 23:59)",
            )
        daily_time_msk = f"{hh:02d}:{mm:02d}"
        schedule_changed = True

    if schedule_changed:
        await app_settings_repo.set(
            session,
            TASK_OVERDUE_NOTIFICATIONS_KEY,
            {
                "interval_hours": interval_hours,
                "daily_time_msk": daily_time_msk,
            },
            updated_by_id=member.id,
        )

    await session.commit()

    if schedule_changed:
        reminder_service = _get_reminder_service(request)
        if reminder_service is not None:
            interval_hours, daily_time_msk = reminder_service.set_task_overdue_schedule(
                interval_hours,
                daily_time_msk,
            )

    # Return updated state
    subs = await sub_repo.get_by_member(session, member.id)
    subs_map = {s.event_type: s.is_active for s in subs}
    result = {et: subs_map.get(et, False) for et in EVENT_TYPES}
    return SubscriptionsResponse(
        subscriptions=result,
        task_overdue_interval_hours=interval_hours,
        task_overdue_daily_time_msk=daily_time_msk,
    )


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
    if "digest_sections_order" in update_data:
        update_data["digest_sections_order"] = normalize_digest_sections_order(
            update_data.get("digest_sections_order")
        )
    if "task_line_fields_order" in update_data:
        update_data["task_line_fields_order"] = normalize_task_line_fields_order(
            update_data.get("task_line_fields_order")
        )
    if "upcoming_days" in update_data:
        update_data["upcoming_days"] = normalize_upcoming_days(
            update_data.get("upcoming_days")
        )
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


class MeetingWeeklyDigestTargetStatusResponse(BaseModel):
    target_id: uuid.UUID
    status: Literal["pending", "sent", "failed"] = "pending"
    sent_at: datetime | None = None
    error_message: str | None = None
    last_attempt_at: datetime | None = None
    target_label: str | None = None
    chat_id: int | None = None
    thread_id: int | None = None


class MeetingWeeklyDigestSettingsResponse(BaseModel):
    enabled: bool = False
    day_of_week: int = DEFAULT_MEETING_WEEKLY_DIGEST_DAY
    time_local: str = DEFAULT_MEETING_WEEKLY_DIGEST_TIME
    timezone: str = REMINDER_TIMEZONE
    target_ids: list[uuid.UUID] = Field(default_factory=list)
    template: str = DEFAULT_MEETING_WEEKLY_DIGEST_TEMPLATE
    delivery_week_start: str | None = None
    delivery_week_end: str | None = None
    preview_meetings_count: int = 0
    preview_meetings_block: str = ""
    target_statuses: list[MeetingWeeklyDigestTargetStatusResponse] = Field(default_factory=list)
    updated_by_id: uuid.UUID | None = None
    updated_at: datetime | None = None


class MeetingWeeklyDigestSettingsUpdate(BaseModel):
    enabled: bool = False
    day_of_week: int = DEFAULT_MEETING_WEEKLY_DIGEST_DAY
    time_local: str = DEFAULT_MEETING_WEEKLY_DIGEST_TIME
    target_ids: list[uuid.UUID] = Field(default_factory=list)
    template: str = DEFAULT_MEETING_WEEKLY_DIGEST_TEMPLATE


class MeetingWeeklyDigestSendRequest(BaseModel):
    target_ids: list[uuid.UUID] = Field(default_factory=list)


class MeetingWeeklyDigestSendResponse(BaseModel):
    ok: bool
    reason: str
    delivery_week_start: str
    delivery_week_end: str
    attempted: int
    sent_count: int
    failed_count: int
    skipped_sent_count: int
    target_results: list[MeetingWeeklyDigestTargetStatusResponse]


def _weekly_snapshot_to_response(snapshot: dict) -> MeetingWeeklyDigestSettingsResponse:
    target_statuses: list[MeetingWeeklyDigestTargetStatusResponse] = []
    for raw in snapshot.get("target_statuses") or []:
        status = str(raw.get("status") or "pending").strip().lower()
        if status not in WEEKLY_DIGEST_ALLOWED_STATUSES:
            status = "pending"
        target_statuses.append(
            MeetingWeeklyDigestTargetStatusResponse(
                target_id=uuid.UUID(str(raw.get("target_id"))),
                status=status,
                sent_at=raw.get("sent_at"),
                error_message=raw.get("error_message"),
                last_attempt_at=raw.get("last_attempt_at"),
                target_label=raw.get("target_label"),
                chat_id=raw.get("chat_id"),
                thread_id=raw.get("thread_id"),
            )
        )

    return MeetingWeeklyDigestSettingsResponse(
        enabled=bool(snapshot.get("enabled", False)),
        day_of_week=int(snapshot.get("day_of_week", DEFAULT_MEETING_WEEKLY_DIGEST_DAY)),
        time_local=str(snapshot.get("time_local", DEFAULT_MEETING_WEEKLY_DIGEST_TIME)),
        timezone=str(snapshot.get("timezone", REMINDER_TIMEZONE)),
        target_ids=[
            uuid.UUID(str(raw_target_id))
            for raw_target_id in (snapshot.get("target_ids") or [])
        ],
        template=str(snapshot.get("template") or DEFAULT_MEETING_WEEKLY_DIGEST_TEMPLATE),
        delivery_week_start=snapshot.get("delivery_week_start"),
        delivery_week_end=snapshot.get("delivery_week_end"),
        preview_meetings_count=int(snapshot.get("preview_meetings_count") or 0),
        preview_meetings_block=str(snapshot.get("preview_meetings_block") or ""),
        target_statuses=target_statuses,
        updated_by_id=snapshot.get("updated_by_id"),
        updated_at=snapshot.get("updated_at"),
    )


@router.get(
    "/meeting-weekly-digest",
    response_model=MeetingWeeklyDigestSettingsResponse,
)
async def get_meeting_weekly_digest_settings(
    request: Request,
    _: TeamMember = Depends(require_moderator),
):
    """Get weekly meeting digest settings. Moderator only."""
    scheduler = _get_meeting_scheduler(request)
    snapshot = await scheduler.get_weekly_digest_status_snapshot()
    return _weekly_snapshot_to_response(snapshot)


@router.put(
    "/meeting-weekly-digest",
    response_model=MeetingWeeklyDigestSettingsResponse,
)
async def update_meeting_weekly_digest_settings(
    request: Request,
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

    setting = await app_settings_repo.set(
        session,
        MEETING_WEEKLY_DIGEST_SETTINGS_KEY,
        normalized,
        updated_by_id=member.id,
    )
    await session.commit()

    scheduler = _get_meeting_scheduler(request)
    snapshot = await scheduler.get_weekly_digest_status_snapshot()
    snapshot["updated_by_id"] = setting.updated_by_id
    snapshot["updated_at"] = setting.updated_at
    return _weekly_snapshot_to_response(snapshot)


@router.post(
    "/meeting-weekly-digest/send-pending-now",
    response_model=MeetingWeeklyDigestSendResponse,
)
async def send_pending_meeting_weekly_digest(
    request: Request,
    data: MeetingWeeklyDigestSendRequest,
    _: TeamMember = Depends(require_moderator),
):
    scheduler = _get_meeting_scheduler(request)
    result = await scheduler.send_weekly_digest_pending_now(
        requested_target_ids=data.target_ids or None
    )

    target_results: list[MeetingWeeklyDigestTargetStatusResponse] = []
    for raw in result.get("target_results") or []:
        status = str(raw.get("status") or "pending").strip().lower()
        if status not in WEEKLY_DIGEST_ALLOWED_STATUSES:
            status = "pending"
        target_results.append(
            MeetingWeeklyDigestTargetStatusResponse(
                target_id=uuid.UUID(str(raw.get("target_id"))),
                status=status,
                sent_at=raw.get("sent_at"),
                error_message=raw.get("error_message"),
                last_attempt_at=raw.get("last_attempt_at"),
                target_label=raw.get("target_label"),
                chat_id=raw.get("chat_id"),
                thread_id=raw.get("thread_id"),
            )
        )

    return MeetingWeeklyDigestSendResponse(
        ok=bool(result.get("ok")),
        reason=str(result.get("reason") or ""),
        delivery_week_start=str(result.get("delivery_week_start") or ""),
        delivery_week_end=str(result.get("delivery_week_end") or ""),
        attempted=int(result.get("attempted") or 0),
        sent_count=int(result.get("sent_count") or 0),
        failed_count=int(result.get("failed_count") or 0),
        skipped_sent_count=int(result.get("skipped_sent_count") or 0),
        target_results=target_results,
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
    """Get current AI provider and available options.

    Reads from ai_feature_config 'default' row (new table), with fallback to app_settings.
    """
    # Try new per-feature config first
    provider, model = await AIFeatureConfigService.get_provider_for_feature(session, "default")
    if not provider:
        # Fallback to legacy app_settings
        info = await ai_service.get_current_provider_info(session)
        provider = info["provider"]
        model = info["model"]

    available = ai_service.get_available_providers()

    # Get providers config
    config_setting = await app_settings_repo.get(session, "ai_providers_config")
    providers_config = config_setting.value if config_setting else None

    return AISettingsResponse(
        current_provider=provider or "not configured",
        current_model=model or "",
        available_providers=available,
        providers_config=providers_config,
    )


@router.put("/ai", response_model=AISettingsResponse)
async def update_ai_settings(
    data: AIProviderUpdate,
    member: TeamMember = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Change AI provider and model. Admin only.

    Writes to both ai_feature_config (default row) AND app_settings (backward compat for bot).
    """
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

    # Write to legacy app_settings (backward compat for bot commands)
    await app_settings_repo.set(
        session,
        "ai_provider",
        {"provider": data.provider, "model": data.model},
        updated_by_id=member.id,
    )

    # Write to new ai_feature_config (default row)
    await AIFeatureConfigService.update_config(
        session, "default", data.provider, data.model, member.id
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


# ── GetCourse Credentials ──


REPORT_SCHEDULE_KEY = "report_schedule"
DEFAULT_REPORT_SCHEDULE = {
    "collection_time": "05:45",
    "send_time": "06:30",
    "timezone": "Europe/Moscow",
    "enabled": True,
}
MIN_SCHEDULE_GAP_MINUTES = 30


def _get_report_scheduler(request: Request):
    return getattr(request.app.state, "report_scheduler", None)


@router.get("/getcourse-credentials", response_model=GetCourseCredentialsResponse)
async def get_getcourse_credentials(
    member: TeamMember = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Get GetCourse credentials status. Admin only. Never returns the API key."""
    gc_creds = await creds_repo.get(session)
    if not gc_creds:
        return GetCourseCredentialsResponse(configured=False)
    return GetCourseCredentialsResponse(
        configured=True,
        base_url=gc_creds.base_url,
        updated_at=gc_creds.updated_at,
    )


@router.put("/getcourse-credentials", response_model=GetCourseCredentialsResponse)
async def update_getcourse_credentials(
    data: GetCourseCredentialsUpdate,
    member: TeamMember = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Update GetCourse credentials. Admin only. Encrypts the API key."""
    encrypted_key = encrypt(data.api_key)
    gc_creds = await creds_repo.upsert(
        session,
        base_url=data.base_url.rstrip("/"),
        api_key_encrypted=encrypted_key,
        updated_by_id=member.id,
    )
    await session.commit()
    return GetCourseCredentialsResponse(
        configured=True,
        base_url=gc_creds.base_url,
        updated_at=gc_creds.updated_at,
    )


# ── Report Schedule ──


def _migrate_legacy_schedule(val: dict) -> dict:
    """Migrate old single 'time' field to collection_time + send_time."""
    if "collection_time" in val:
        return val
    old_time = val.get("time", "05:45")
    h, m = _parse_hhmm(old_time)
    send_h, send_m = h, m + MIN_SCHEDULE_GAP_MINUTES
    if send_m >= 60:
        send_h += send_m // 60
        send_m = send_m % 60
    if send_h >= 24:
        send_h = 23
        send_m = 59
    return {
        "collection_time": old_time,
        "send_time": f"{send_h:02d}:{send_m:02d}",
        "timezone": val.get("timezone", "Europe/Moscow"),
        "enabled": val.get("enabled", True),
    }


@router.get("/report-schedule", response_model=ReportScheduleResponse)
async def get_report_schedule(
    member: TeamMember = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Get report schedule settings. Admin only."""
    setting = await app_settings_repo.get(session, REPORT_SCHEDULE_KEY)
    if not setting:
        return ReportScheduleResponse(**DEFAULT_REPORT_SCHEDULE)
    val = _migrate_legacy_schedule(setting.value)
    return ReportScheduleResponse(
        collection_time=val.get("collection_time", "05:45"),
        send_time=val.get("send_time", "06:30"),
        timezone=val.get("timezone", "Europe/Moscow"),
        enabled=val.get("enabled", True),
    )


@router.put("/report-schedule", response_model=ReportScheduleResponse)
async def update_report_schedule(
    request: Request,
    data: ReportScheduleUpdate,
    member: TeamMember = Depends(require_admin),
    session: AsyncSession = Depends(get_session),
):
    """Update report schedule. Admin only."""
    # Validate time formats
    try:
        c_h, c_m = _parse_hhmm(data.collection_time)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Invalid collection_time format. Use HH:MM (00:00 — 23:59)",
        )
    try:
        s_h, s_m = _parse_hhmm(data.send_time)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Invalid send_time format. Use HH:MM (00:00 — 23:59)",
        )

    # send_time must be after collection_time
    collection_minutes = c_h * 60 + c_m
    send_minutes = s_h * 60 + s_m
    gap = send_minutes - collection_minutes

    if gap < MIN_SCHEDULE_GAP_MINUTES:
        raise HTTPException(
            status_code=400,
            detail=f"send_time must be at least {MIN_SCHEDULE_GAP_MINUTES} minutes after collection_time",
        )

    schedule_data = {
        "collection_time": data.collection_time,
        "send_time": data.send_time,
        "timezone": data.timezone,
        "enabled": data.enabled,
    }
    await app_settings_repo.set(
        session,
        REPORT_SCHEDULE_KEY,
        schedule_data,
        updated_by_id=member.id,
    )
    await session.commit()

    # Notify scheduler to reload
    scheduler = _get_report_scheduler(request)
    if scheduler:
        await scheduler.reschedule()

    return ReportScheduleResponse(**schedule_data)
