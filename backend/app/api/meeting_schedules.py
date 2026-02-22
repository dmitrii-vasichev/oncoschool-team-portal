import html
import logging
import uuid
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import delete as sa_delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from zoneinfo import ZoneInfo

from app.api.auth import get_current_user, require_moderator
from app.db.database import get_session
from app.db.models import Meeting, MeetingParticipant, MeetingSchedule, TeamMember
from app.db.repositories import MeetingScheduleRepository, TelegramTargetRepository
from app.db.schemas import (
    MeetingScheduleCreate,
    MeetingScheduleResponse,
    MeetingScheduleUpdate,
)
from app.services.zoom_service import extract_zoom_join_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/meeting-schedules", tags=["meeting-schedules"])

schedule_repo = MeetingScheduleRepository()
target_repo = TelegramTargetRepository()
VALID_RECURRENCES = {
    "weekly",
    "biweekly",
    "monthly_last_workday",
    "one_time",
    "on_demand",
}
RECURRING_RECURRENCES = {"weekly", "biweekly", "monthly_last_workday"}
ALLOWED_REMINDER_OFFSETS_MINUTES = (0, 15, 30, 60, 120)
DEFAULT_REMINDER_OFFSETS_MINUTES = [60, 0]
RUSSIAN_WEEKDAYS_LONG = {
    1: "Понедельник",
    2: "Вторник",
    3: "Среда",
    4: "Четверг",
    5: "Пятница",
    6: "Суббота",
    7: "Воскресенье",
}


def _normalize_reminder_offsets(
    reminder_offsets_minutes: list[int] | None,
    fallback_minutes: int | None = None,
) -> list[int]:
    raw_values = list(reminder_offsets_minutes or [])
    if not raw_values and fallback_minutes is not None:
        raw_values = [fallback_minutes]
    if not raw_values:
        raw_values = list(DEFAULT_REMINDER_OFFSETS_MINUTES)

    normalized: list[int] = []
    for value in raw_values:
        try:
            offset = int(value)
        except (TypeError, ValueError):
            continue
        if offset not in ALLOWED_REMINDER_OFFSETS_MINUTES:
            continue
        if offset not in normalized:
            normalized.append(offset)

    if not normalized:
        if fallback_minutes in ALLOWED_REMINDER_OFFSETS_MINUTES:
            normalized = [int(fallback_minutes)]
        else:
            normalized = list(DEFAULT_REMINDER_OFFSETS_MINUTES)

    return sorted(normalized, reverse=True)


def _normalize_reminder_texts_by_offset(
    reminder_texts_by_offset: dict[str, str] | None,
    reminder_offsets_minutes: list[int],
    fallback_text: str | None = None,
) -> dict[str, str]:
    normalized: dict[str, str] = {}
    source = reminder_texts_by_offset if isinstance(reminder_texts_by_offset, dict) else {}
    allowed_offsets = set(reminder_offsets_minutes)

    for raw_key, raw_value in source.items():
        try:
            offset = int(raw_key)
        except (TypeError, ValueError):
            continue
        if offset not in ALLOWED_REMINDER_OFFSETS_MINUTES or offset not in allowed_offsets:
            continue
        text = str(raw_value or "").strip()
        if text:
            normalized[str(offset)] = text

    fallback = (fallback_text or "").strip()
    first_offset_key = str(reminder_offsets_minutes[0]) if reminder_offsets_minutes else None
    if fallback and first_offset_key and first_offset_key not in normalized:
        normalized[first_offset_key] = fallback

    return normalized


def _is_last_selected_weekday_in_month(dt_local: datetime, day_of_week: int) -> bool:
    """Check that local date is the last selected weekday in its month."""
    if dt_local.isoweekday() != day_of_week:
        return False
    next_same_weekday = dt_local + timedelta(days=7)
    return next_same_weekday.month != dt_local.month


def _matches_recurrence(candidate_local: datetime, day_of_week: int, recurrence: str) -> bool:
    """Validate candidate local datetime against weekly/biweekly/monthly rules."""
    if candidate_local.isoweekday() != day_of_week:
        return False

    if recurrence == "biweekly":
        week_number = candidate_local.isocalendar()[1]
        return week_number % 2 == 0

    if recurrence == "monthly_last_workday":
        return _is_last_selected_weekday_in_month(candidate_local, day_of_week)

    return True


def _local_to_utc(time_local: str, timezone: str) -> time:
    """Convert local time string like '15:00' to UTC time."""
    local_time = time.fromisoformat(time_local)
    local_dt = datetime.combine(date.today(), local_time)
    local_dt = local_dt.replace(tzinfo=ZoneInfo(timezone))
    utc_dt = local_dt.astimezone(ZoneInfo("UTC"))
    return utc_dt.time()


def _parse_local_datetime(datetime_local: str, timezone: str) -> tuple[datetime, datetime]:
    """Parse local datetime string and return (local_naive, utc_naive)."""
    local_dt = datetime.fromisoformat(datetime_local)
    if local_dt.tzinfo is not None:
        local_dt = local_dt.astimezone(ZoneInfo(timezone)).replace(tzinfo=None)
    local_aware = local_dt.replace(tzinfo=ZoneInfo(timezone))
    utc_naive = local_aware.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
    return local_dt, utc_naive


def _calc_next_meeting_datetime(
    day_of_week: int,
    time_utc: time,
    timezone_str: str,
    recurrence: str,
    one_time_date: date | None = None,
    next_occurrence_at: datetime | None = None,
) -> datetime | None:
    """Calculate next meeting datetime (naive UTC) for any recurrence mode."""
    now_utc = datetime.now(ZoneInfo("UTC"))

    if recurrence == "one_time":
        if not one_time_date:
            return None
        candidate = datetime.combine(one_time_date, time_utc, tzinfo=ZoneInfo("UTC"))
        if candidate > now_utc:
            return candidate.replace(tzinfo=None)
        return None

    if recurrence == "on_demand":
        if not next_occurrence_at:
            return None
        candidate = next_occurrence_at
        if candidate.tzinfo is None:
            candidate = candidate.replace(tzinfo=ZoneInfo("UTC"))
        else:
            candidate = candidate.astimezone(ZoneInfo("UTC"))
        if candidate > now_utc:
            return candidate.replace(tzinfo=None)
        return None

    tz = ZoneInfo(timezone_str)
    for days_ahead in range(60):
        candidate_date = now_utc.date() + timedelta(days=days_ahead)
        candidate_dt = datetime.combine(candidate_date, time_utc, tzinfo=ZoneInfo("UTC"))
        candidate_local = candidate_dt.astimezone(tz)

        if candidate_dt > now_utc and _matches_recurrence(
            candidate_local, day_of_week, recurrence
        ):
            return candidate_dt.replace(tzinfo=None)

    return None


def _calc_next_occurrence_date(schedule: MeetingSchedule) -> date | None:
    """Calculate the next occurrence date for a schedule, considering recurrence rules."""
    now_utc = datetime.now(ZoneInfo("UTC"))

    if schedule.recurrence == "one_time":
        if not schedule.one_time_date:
            return None
        if (
            schedule.last_triggered_date
            and schedule.last_triggered_date >= schedule.one_time_date
        ):
            return None
        candidate = datetime.combine(
            schedule.one_time_date,
            schedule.time_utc,
            tzinfo=ZoneInfo("UTC"),
        )
        return schedule.one_time_date if candidate > now_utc else None

    if schedule.recurrence == "on_demand":
        if not schedule.next_occurrence_at:
            return None
        candidate = schedule.next_occurrence_at
        if candidate.tzinfo is None:
            candidate = candidate.replace(tzinfo=ZoneInfo("UTC"))
        else:
            candidate = candidate.astimezone(ZoneInfo("UTC"))
        if candidate > now_utc:
            return candidate.date()
        return None

    tz = ZoneInfo(schedule.timezone)
    effective_time = schedule.next_occurrence_time_override or schedule.time_utc
    skip_first_match = bool(getattr(schedule, "next_occurrence_skip", False))

    for days_ahead in range(60):
        candidate_date = now_utc.date() + timedelta(days=days_ahead)
        candidate_dt = datetime.combine(candidate_date, effective_time, tzinfo=ZoneInfo("UTC"))
        candidate_local = candidate_dt.astimezone(tz)

        if candidate_dt <= now_utc:
            if candidate_date != now_utc.date():
                continue
            if schedule.last_triggered_date and schedule.last_triggered_date >= candidate_date:
                continue

        if schedule.last_triggered_date and candidate_date <= schedule.last_triggered_date:
            continue

        if not _matches_recurrence(candidate_local, schedule.day_of_week, schedule.recurrence):
            continue

        if skip_first_match:
            skip_first_match = False
            continue

        return candidate_date

    return None


def _calc_next_occurrence_datetime(schedule: MeetingSchedule) -> datetime | None:
    """Calculate the next occurrence datetime (naive UTC) for persisted meetings."""
    if schedule.recurrence == "on_demand":
        if not schedule.next_occurrence_at:
            return None
        candidate = schedule.next_occurrence_at
        if candidate.tzinfo is None:
            candidate = candidate.replace(tzinfo=ZoneInfo("UTC"))
        else:
            candidate = candidate.astimezone(ZoneInfo("UTC"))
        now_utc = datetime.now(ZoneInfo("UTC"))
        if candidate <= now_utc:
            return None
        return candidate.replace(tzinfo=None)

    next_date = _calc_next_occurrence_date(schedule)
    if not next_date:
        return None

    effective_time = (
        schedule.next_occurrence_time_override
        if schedule.recurrence in RECURRING_RECURRENCES
        else None
    ) or schedule.time_utc
    return datetime.combine(next_date, effective_time)


def _to_utc_aware(dt_value: datetime | None) -> datetime | None:
    if not dt_value:
        return None
    if dt_value.tzinfo is None:
        return dt_value.replace(tzinfo=ZoneInfo("UTC"))
    return dt_value.astimezone(ZoneInfo("UTC"))


def _format_datetime_msk(dt_value: datetime | None) -> str | None:
    dt_utc = _to_utc_aware(dt_value)
    if not dt_utc:
        return None
    dt_msk = dt_utc.astimezone(ZoneInfo("Europe/Moscow"))
    weekday = RUSSIAN_WEEKDAYS_LONG.get(dt_msk.isoweekday(), "")
    if weekday:
        return f"{weekday}, {dt_msk.strftime('%d.%m.%Y %H:%M')} МСК"
    return dt_msk.strftime("%d.%m.%Y %H:%M МСК")


def _copy_telegram_targets(raw_targets: list | None) -> list[dict]:
    copied_targets: list[dict] = []
    for target in raw_targets or []:
        if not isinstance(target, dict):
            continue
        copied_targets.append(
            {
                "chat_id": target.get("chat_id"),
                "thread_id": target.get("thread_id"),
            }
        )
    return copied_targets


def _build_schedule_notification_snapshot(schedule: MeetingSchedule) -> dict[str, object]:
    return {
        "title": schedule.title,
        "participant_ids": list(schedule.participant_ids or []),
        "telegram_targets": _copy_telegram_targets(schedule.telegram_targets),
        "next_occurrence_skip": bool(schedule.next_occurrence_skip),
        "next_occurrence_time_override": schedule.next_occurrence_time_override,
        "next_occurrence_dt": _calc_next_occurrence_datetime(schedule),
    }


def _normalize_participant_ids(raw_ids: object) -> tuple[str, ...]:
    normalized: set[str] = set()
    if not isinstance(raw_ids, list):
        return ()

    for participant_id in raw_ids:
        if isinstance(participant_id, uuid.UUID):
            normalized.add(str(participant_id))
            continue
        try:
            normalized.add(str(uuid.UUID(str(participant_id))))
        except (TypeError, ValueError):
            continue

    return tuple(sorted(normalized))


def _normalize_targets(raw_targets: object) -> tuple[tuple[int, int | None], ...]:
    if not isinstance(raw_targets, list):
        return ()
    return tuple(sorted(_extract_unique_notification_targets(raw_targets)))


def _normalize_override_time(raw_time: object) -> str | None:
    if raw_time is None:
        return None
    if isinstance(raw_time, time):
        return raw_time.isoformat()
    return str(raw_time)


def _normalize_next_occurrence(raw_dt: object) -> datetime | None:
    if not isinstance(raw_dt, datetime):
        return None
    return _to_utc_aware(raw_dt)


def _has_schedule_notification_changes(
    previous_snapshot: dict[str, object],
    schedule: MeetingSchedule,
) -> bool:
    current_snapshot = _build_schedule_notification_snapshot(schedule)

    if str(previous_snapshot.get("title") or "").strip() != str(
        current_snapshot.get("title") or ""
    ).strip():
        return True

    if bool(previous_snapshot.get("next_occurrence_skip", False)) != bool(
        current_snapshot.get("next_occurrence_skip", False)
    ):
        return True

    if _normalize_override_time(previous_snapshot.get("next_occurrence_time_override")) != (
        _normalize_override_time(current_snapshot.get("next_occurrence_time_override"))
    ):
        return True

    if _normalize_next_occurrence(previous_snapshot.get("next_occurrence_dt")) != (
        _normalize_next_occurrence(current_snapshot.get("next_occurrence_dt"))
    ):
        return True

    if _normalize_participant_ids(previous_snapshot.get("participant_ids")) != (
        _normalize_participant_ids(current_snapshot.get("participant_ids"))
    ):
        return True

    if _normalize_targets(previous_snapshot.get("telegram_targets")) != (
        _normalize_targets(current_snapshot.get("telegram_targets"))
    ):
        return True

    return False


def _extract_unique_notification_targets(raw_targets: list | None) -> list[tuple[int, int | None]]:
    unique_targets: list[tuple[int, int | None]] = []
    seen: set[tuple[int, int | None]] = set()

    for target in raw_targets or []:
        if not isinstance(target, dict):
            continue

        chat_raw = target.get("chat_id")
        if chat_raw in (None, ""):
            continue
        try:
            chat_id = int(chat_raw)
        except (TypeError, ValueError):
            continue

        thread_raw = target.get("thread_id")
        thread_id: int | None = None
        if thread_raw not in (None, ""):
            try:
                thread_id = int(thread_raw)
            except (TypeError, ValueError):
                continue

        target_key = (chat_id, thread_id)
        if target_key in seen:
            continue
        seen.add(target_key)
        unique_targets.append(target_key)

    return unique_targets


async def _build_participants_mentions(
    session: AsyncSession,
    participant_ids: list[uuid.UUID],
) -> str:
    ordered_ids: list[uuid.UUID] = []
    seen_ids: set[uuid.UUID] = set()
    for participant_id in participant_ids:
        if participant_id in seen_ids:
            continue
        seen_ids.add(participant_id)
        ordered_ids.append(participant_id)

    if not ordered_ids:
        return ""

    stmt = select(TeamMember).where(
        TeamMember.id.in_(ordered_ids),
        TeamMember.is_active.is_(True),
    )
    result = await session.execute(stmt)
    members = list(result.scalars().all())
    members_by_id = {member.id: member for member in members}

    mentions: list[str] = []
    seen_usernames: set[str] = set()
    for participant_id in ordered_ids:
        member = members_by_id.get(participant_id)
        if not member:
            continue
        username = (member.telegram_username or "").strip().lstrip("@")
        if not username:
            continue
        username_key = username.casefold()
        if username_key in seen_usernames:
            continue
        seen_usernames.add(username_key)
        mentions.append(f"@{username}")

    return " ".join(mentions)


def _detect_schedule_change_kind(
    previous_snapshot: dict[str, object],
    schedule: MeetingSchedule | None,
    *,
    deleted: bool,
) -> str:
    if deleted:
        return "deleted"
    if not schedule:
        return "updated"

    previous_skip = bool(previous_snapshot.get("next_occurrence_skip", False))
    current_skip = bool(schedule.next_occurrence_skip)
    if not previous_skip and current_skip:
        return "cancel_next"

    previous_override = previous_snapshot.get("next_occurrence_time_override")
    current_override = schedule.next_occurrence_time_override
    if previous_override != current_override and current_override is not None:
        return "reschedule_next"

    previous_next = previous_snapshot.get("next_occurrence_dt")
    current_next = _calc_next_occurrence_datetime(schedule)
    if isinstance(previous_next, datetime) and isinstance(current_next, datetime):
        if previous_next != current_next:
            return "reschedule_next"

    return "updated"


def _build_schedule_change_message_html(
    *,
    previous_snapshot: dict[str, object],
    schedule: MeetingSchedule | None,
    deleted: bool,
    participants_mentions: str,
) -> str:
    title_source = (
        schedule.title
        if schedule and schedule.title
        else str(previous_snapshot.get("title") or "")
    )
    safe_title = html.escape(title_source.strip() or "Встреча")
    change_kind = _detect_schedule_change_kind(
        previous_snapshot,
        schedule,
        deleted=deleted,
    )

    change_lines = [f"По встрече <b>{safe_title}</b> произошли изменения."]
    if change_kind == "deleted":
        change_lines.append("Расписание удалено, новые повторения больше не будут создаваться.")
    elif change_kind == "cancel_next":
        change_lines.append("Ближайшая встреча отменена.")
    elif change_kind == "reschedule_next":
        change_lines.append("Ближайшая встреча перенесена.")
    else:
        change_lines.append("Расписание встречи обновлено.")

    previous_next = previous_snapshot.get("next_occurrence_dt")
    previous_next_label = _format_datetime_msk(
        previous_next if isinstance(previous_next, datetime) else None
    )
    current_next = None if deleted or not schedule else _calc_next_occurrence_datetime(schedule)
    current_next_label = _format_datetime_msk(current_next)

    time_lines: list[str] = []
    if previous_next_label and (deleted or previous_next_label != current_next_label):
        time_lines.append(f"Было: <b>{html.escape(previous_next_label)}</b>")

    if current_next_label and not deleted:
        prefix = (
            "Стало"
            if previous_next_label and previous_next_label != current_next_label
            else "Ближайшая встреча"
        )
        time_lines.append(f"{prefix}: <b>{html.escape(current_next_label)}</b>")

    sections = [
        "Добрый день!",
        "\n".join(change_lines),
    ]
    if time_lines:
        sections.append("\n".join(time_lines))
    if participants_mentions:
        sections.append(f"Участники: {participants_mentions}")

    return "\n\n".join(sections)


async def _notify_schedule_change(
    request: Request,
    session: AsyncSession,
    *,
    previous_snapshot: dict[str, object],
    schedule: MeetingSchedule | None,
    deleted: bool,
) -> None:
    bot = getattr(request.app.state, "bot", None)
    if not bot:
        logger.warning("Telegram bot unavailable, skip schedule change notification")
        return

    raw_targets = (
        schedule.telegram_targets
        if schedule is not None
        else previous_snapshot.get("telegram_targets")
    )
    targets = _extract_unique_notification_targets(
        raw_targets if isinstance(raw_targets, list) else []
    )
    if not targets:
        logger.info("No telegram targets configured for schedule change notification")
        return

    participant_ids_raw = (
        list(schedule.participant_ids or [])
        if schedule is not None
        else list(previous_snapshot.get("participant_ids") or [])
    )
    participant_ids: list[uuid.UUID] = []
    for participant_id in participant_ids_raw:
        if isinstance(participant_id, uuid.UUID):
            participant_ids.append(participant_id)
            continue
        try:
            participant_ids.append(uuid.UUID(str(participant_id)))
        except (TypeError, ValueError):
            continue

    participants_mentions = await _build_participants_mentions(session, participant_ids)
    message_html = _build_schedule_change_message_html(
        previous_snapshot=previous_snapshot,
        schedule=schedule,
        deleted=deleted,
        participants_mentions=participants_mentions,
    )

    for chat_id, thread_id in targets:
        try:
            kwargs = {
                "chat_id": chat_id,
                "text": message_html,
                "parse_mode": "HTML",
            }
            if thread_id is not None:
                kwargs["message_thread_id"] = thread_id
            await bot.send_message(**kwargs)
        except Exception as e:
            logger.warning(
                "Failed to send schedule change notification to chat %s thread %s: %s",
                chat_id,
                thread_id,
                e,
            )


async def _sync_next_scheduled_meeting(
    session: AsyncSession,
    schedule: MeetingSchedule,
    zoom_service,
) -> None:
    """Align the nearest scheduled meeting row (and Zoom) with schedule state."""
    next_occurrence_dt = _calc_next_occurrence_datetime(schedule)
    if not next_occurrence_dt:
        return

    meeting = await _find_next_scheduled_meeting_with_date(session, schedule.id)

    if not meeting:
        zoom_meeting_id = None
        zoom_join_url = None
        if schedule.zoom_enabled:
            zoom_meeting_id, zoom_join_url = await _create_zoom_fields_for_occurrence(
                zoom_service,
                title=schedule.title,
                occurrence_at=next_occurrence_dt,
                duration_minutes=schedule.duration_minutes,
                timezone=schedule.timezone,
                context=f"syncing schedule {schedule.id}",
            )

        meeting = Meeting(
            title=schedule.title,
            meeting_date=next_occurrence_dt,
            schedule_id=schedule.id,
            status="scheduled",
            duration_minutes=schedule.duration_minutes,
            zoom_meeting_id=zoom_meeting_id,
            zoom_join_url=zoom_join_url,
            created_by_id=schedule.created_by_id,
        )
        session.add(meeting)
        await session.flush()
        if schedule.participant_ids:
            await _add_meeting_participants(session, meeting.id, list(schedule.participant_ids))
        return

    date_changed = meeting.meeting_date != next_occurrence_dt
    title_changed = meeting.title != schedule.title
    duration_changed = meeting.duration_minutes != schedule.duration_minutes

    meeting.title = schedule.title
    meeting.duration_minutes = schedule.duration_minutes
    meeting.status = "scheduled"

    if date_changed:
        meeting.meeting_date = next_occurrence_dt
        meeting.sent_reminder_offsets_minutes = []

    if not schedule.zoom_enabled:
        return

    if meeting.zoom_meeting_id:
        if (date_changed or title_changed or duration_changed) and zoom_service:
            try:
                await zoom_service.update_meeting(
                    meeting.zoom_meeting_id,
                    topic=schedule.title,
                    start_time=next_occurrence_dt.strftime("%Y-%m-%dT%H:%M:%S"),
                    duration=schedule.duration_minutes,
                    timezone=schedule.timezone,
                )
            except Exception as e:
                logger.warning(
                    "Zoom update failed while syncing schedule %s: %s",
                    schedule.id,
                    e,
                )
        if not meeting.zoom_join_url:
            meeting.zoom_join_url = extract_zoom_join_url({"id": meeting.zoom_meeting_id})
        return

    zoom_meeting_id, zoom_join_url = await _create_zoom_fields_for_occurrence(
        zoom_service,
        title=schedule.title,
        occurrence_at=next_occurrence_dt,
        duration_minutes=schedule.duration_minutes,
        timezone=schedule.timezone,
        context=f"syncing schedule {schedule.id}",
    )
    if zoom_meeting_id:
        meeting.zoom_meeting_id = zoom_meeting_id
    if zoom_join_url:
        meeting.zoom_join_url = zoom_join_url


def _enrich_response(schedule: MeetingSchedule) -> MeetingScheduleResponse:
    """Build response with computed next_occurrence_date."""
    resp = MeetingScheduleResponse.model_validate(schedule)
    resp.reminder_offsets_minutes = _normalize_reminder_offsets(
        resp.reminder_offsets_minutes,
        fallback_minutes=resp.reminder_minutes_before,
    )
    resp.reminder_minutes_before = resp.reminder_offsets_minutes[0]
    resp.reminder_texts_by_offset = _normalize_reminder_texts_by_offset(
        resp.reminder_texts_by_offset,
        resp.reminder_offsets_minutes,
        fallback_text=resp.reminder_text,
    )
    resp.reminder_text = resp.reminder_texts_by_offset.get(str(resp.reminder_minutes_before))
    if resp.next_occurrence_at and resp.next_occurrence_at.tzinfo is None:
        resp.next_occurrence_at = resp.next_occurrence_at.replace(tzinfo=ZoneInfo("UTC"))
    resp.next_occurrence_date = _calc_next_occurrence_date(schedule)
    return resp


async def _add_meeting_participants(
    session: AsyncSession,
    meeting_id: uuid.UUID,
    participant_ids: list[uuid.UUID],
) -> None:
    for pid in participant_ids:
        session.add(MeetingParticipant(meeting_id=meeting_id, member_id=pid))
    await session.flush()


async def _find_meeting_by_schedule_datetime(
    session: AsyncSession,
    schedule_id: uuid.UUID,
    meeting_date: datetime,
) -> Meeting | None:
    stmt = select(Meeting).where(
        Meeting.schedule_id == schedule_id,
        Meeting.meeting_date == meeting_date,
    )
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def _find_next_scheduled_meeting_with_date(
    session: AsyncSession,
    schedule_id: uuid.UUID,
) -> Meeting | None:
    now_utc_naive = datetime.now(ZoneInfo("UTC")).replace(tzinfo=None)

    future_stmt = (
        select(Meeting)
        .where(
            Meeting.schedule_id == schedule_id,
            Meeting.status == "scheduled",
            Meeting.meeting_date.is_not(None),
            Meeting.meeting_date >= now_utc_naive,
        )
        .order_by(Meeting.meeting_date.asc(), Meeting.created_at.asc())
    )
    future_result = await session.execute(future_stmt)
    future = future_result.scalars().first()
    if future:
        return future

    fallback_stmt = (
        select(Meeting)
        .where(
            Meeting.schedule_id == schedule_id,
            Meeting.status == "scheduled",
            Meeting.meeting_date.is_not(None),
        )
        .order_by(Meeting.meeting_date.desc(), Meeting.created_at.desc())
    )
    fallback_result = await session.execute(fallback_stmt)
    return fallback_result.scalars().first()


async def _find_schedule_template_meeting(
    session: AsyncSession,
    schedule_id: uuid.UUID,
) -> Meeting | None:
    stmt = select(Meeting).where(
        Meeting.schedule_id == schedule_id,
        Meeting.meeting_date.is_(None),
        Meeting.status == "scheduled",
    )
    result = await session.execute(stmt)
    return result.scalars().first()


async def _ensure_on_demand_template_meeting(
    session: AsyncSession,
    schedule: MeetingSchedule,
    created_by_id: uuid.UUID | None,
) -> Meeting:
    stmt = select(Meeting).where(
        Meeting.schedule_id == schedule.id,
        Meeting.meeting_date.is_(None),
        Meeting.status == "scheduled",
    )
    result = await session.execute(stmt)
    existing = result.scalars().first()
    if existing:
        return existing

    template = Meeting(
        title=schedule.title,
        meeting_date=None,
        schedule_id=schedule.id,
        status="scheduled",
        duration_minutes=schedule.duration_minutes,
        created_by_id=created_by_id,
    )
    session.add(template)
    await session.flush()
    if schedule.participant_ids:
        await _add_meeting_participants(session, template.id, list(schedule.participant_ids))
    return template


async def _create_zoom_fields_for_occurrence(
    zoom_service,
    *,
    title: str,
    occurrence_at: datetime,
    duration_minutes: int,
    timezone: str,
    context: str,
) -> tuple[str | None, str | None]:
    """Create Zoom meeting for a scheduled occurrence and return (meeting_id, join_url)."""
    if not zoom_service:
        logger.warning("Zoom service unavailable while %s", context)
        return None, None

    try:
        start_time = occurrence_at
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=ZoneInfo("UTC"))
        else:
            start_time = start_time.astimezone(ZoneInfo("UTC"))

        zoom_data = await zoom_service.create_meeting(
            topic=title,
            start_time=start_time,
            duration=duration_minutes,
            timezone=timezone,
        )
    except Exception as e:
        logger.warning("Zoom create failed while %s: %s", context, e)
        return None, None

    zoom_meeting_id = str(zoom_data["id"]) if zoom_data and zoom_data.get("id") else None
    zoom_join_url = extract_zoom_join_url(zoom_data)
    return zoom_meeting_id, zoom_join_url


@router.get("", response_model=list[MeetingScheduleResponse])
async def get_all_schedules(
    _: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get all meeting schedules (active and inactive)."""
    schedules = await schedule_repo.get_all_active(session)
    return [_enrich_response(s) for s in schedules]


@router.get("/{schedule_id}", response_model=MeetingScheduleResponse)
async def get_schedule(
    schedule_id: uuid.UUID,
    _: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get a single meeting schedule by ID."""
    schedule = await schedule_repo.get_by_id(session, schedule_id)
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Расписание не найдено")
    return _enrich_response(schedule)


@router.post("", response_model=MeetingScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    data: MeetingScheduleCreate,
    request: Request,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Create a new meeting schedule (moderator only)."""
    if data.recurrence not in VALID_RECURRENCES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"recurrence должен быть одним из: {', '.join(sorted(VALID_RECURRENCES))}",
        )
    zoom_service = getattr(request.app.state, "zoom_service", None)
    if not zoom_service:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Zoom не настроен. Создание встреч без Zoom недоступно.",
        )

    timezone = "Europe/Moscow"
    day_of_week = data.day_of_week
    time_utc: time
    one_time_date: date | None = None
    next_occurrence_at: datetime | None = None

    if data.recurrence in RECURRING_RECURRENCES:
        if data.day_of_week is None or data.day_of_week < 1 or data.day_of_week > 7:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="day_of_week должен быть от 1 (Пн) до 7 (Вс)",
            )
        if not data.time_local:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Для этого типа периодичности требуется время",
            )
        try:
            time_utc = _local_to_utc(data.time_local, timezone)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный формат времени или timezone",
            )
    else:
        if data.meeting_date_local:
            try:
                local_dt, utc_dt = _parse_local_datetime(data.meeting_date_local, timezone)
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Неверный формат meeting_date_local, ожидается YYYY-MM-DDTHH:MM",
                )
            day_of_week = local_dt.isoweekday()
            time_utc = utc_dt.time()
            if data.recurrence == "one_time":
                one_time_date = utc_dt.date()
            else:
                next_occurrence_at = utc_dt
        else:
            if data.recurrence == "one_time":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Для разовой встречи требуется meeting_date_local",
                )
            day_of_week = day_of_week if day_of_week and 1 <= day_of_week <= 7 else 1
            local_time = data.time_local or "15:00"
            try:
                time_utc = _local_to_utc(local_time, timezone)
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Неверный формат времени или timezone",
                )

    telegram_targets = data.telegram_targets
    if not telegram_targets:
        active_targets = await target_repo.get_all_active(session)
        telegram_targets = [
            {"chat_id": str(t.chat_id), "thread_id": t.thread_id}
            for t in active_targets
        ]

    reminder_text = (data.reminder_text or "").strip() or None
    reminder_offsets_minutes = _normalize_reminder_offsets(
        data.reminder_offsets_minutes,
        fallback_minutes=data.reminder_minutes_before,
    )
    reminder_texts_by_offset = _normalize_reminder_texts_by_offset(
        data.reminder_texts_by_offset,
        reminder_offsets_minutes,
        fallback_text=reminder_text,
    )
    reminder_minutes_before = reminder_offsets_minutes[0]
    reminder_text = reminder_texts_by_offset.get(str(reminder_minutes_before))
    reminder_include_zoom_link = True
    reminder_zoom_missing_behavior = "hide"
    reminder_zoom_missing_text = None

    schedule = await schedule_repo.create(
        session,
        title=data.title,
        day_of_week=day_of_week,
        time_utc=time_utc,
        timezone=timezone,
        duration_minutes=data.duration_minutes,
        recurrence=data.recurrence,
        one_time_date=one_time_date,
        next_occurrence_at=next_occurrence_at,
        reminder_enabled=data.reminder_enabled,
        reminder_minutes_before=reminder_minutes_before,
        reminder_offsets_minutes=reminder_offsets_minutes,
        reminder_text=reminder_text,
        reminder_texts_by_offset=reminder_texts_by_offset,
        reminder_include_zoom_link=reminder_include_zoom_link,
        reminder_zoom_missing_behavior=reminder_zoom_missing_behavior,
        reminder_zoom_missing_text=reminder_zoom_missing_text,
        telegram_targets=telegram_targets,
        participant_ids=data.participant_ids,
        zoom_enabled=True,
        created_by_id=member.id,
    )

    if schedule.recurrence == "on_demand":
        await _ensure_on_demand_template_meeting(session, schedule, member.id)

    next_meeting_date = _calc_next_meeting_datetime(
        day_of_week=day_of_week,
        time_utc=time_utc,
        timezone_str=timezone,
        recurrence=schedule.recurrence,
        one_time_date=one_time_date,
        next_occurrence_at=next_occurrence_at,
    )

    if next_meeting_date:
        existing = await _find_meeting_by_schedule_datetime(
            session,
            schedule_id=schedule.id,
            meeting_date=next_meeting_date,
        )
        if not existing:
            zoom_meeting_id, zoom_join_url = await _create_zoom_fields_for_occurrence(
                zoom_service,
                title=data.title,
                occurrence_at=next_meeting_date,
                duration_minutes=data.duration_minutes,
                timezone=timezone,
                context=f"creating schedule {schedule.id}",
            )

            meeting = Meeting(
                title=data.title,
                meeting_date=next_meeting_date,
                schedule_id=schedule.id,
                status="scheduled",
                duration_minutes=data.duration_minutes,
                zoom_meeting_id=zoom_meeting_id,
                zoom_join_url=zoom_join_url,
                created_by_id=member.id,
            )
            session.add(meeting)
            await session.flush()

            if data.participant_ids:
                await _add_meeting_participants(session, meeting.id, data.participant_ids)

    if schedule.recurrence != "on_demand":
        await _sync_next_scheduled_meeting(session, schedule, zoom_service)

    await session.commit()
    return _enrich_response(schedule)


@router.patch("/{schedule_id}", response_model=MeetingScheduleResponse)
async def update_schedule(
    schedule_id: uuid.UUID,
    data: MeetingScheduleUpdate,
    request: Request,
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Update a meeting schedule (moderator only)."""
    schedule = await schedule_repo.get_by_id(session, schedule_id)
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Расписание не найдено")
    zoom_service = getattr(request.app.state, "zoom_service", None)
    previous_recurrence = schedule.recurrence

    update_data = data.model_dump(exclude_unset=True)
    notify_participants = bool(update_data.pop("notify_participants", False))
    notification_snapshot = (
        _build_schedule_notification_snapshot(schedule)
        if notify_participants
        else None
    )

    new_recurrence = update_data.get("recurrence", schedule.recurrence)
    if new_recurrence not in VALID_RECURRENCES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"recurrence должен быть одним из: {', '.join(sorted(VALID_RECURRENCES))}",
        )

    if "day_of_week" in update_data and update_data["day_of_week"] is not None:
        if update_data["day_of_week"] < 1 or update_data["day_of_week"] > 7:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="day_of_week должен быть от 1 (Пн) до 7 (Вс)",
            )

    if "reminder_text" in update_data:
        update_data["reminder_text"] = (update_data["reminder_text"] or "").strip() or None
    if "reminder_texts_by_offset" in update_data and not isinstance(
        update_data["reminder_texts_by_offset"],
        dict,
    ):
        update_data["reminder_texts_by_offset"] = {}
    if "reminder_zoom_missing_text" in update_data:
        update_data["reminder_zoom_missing_text"] = (
            (update_data["reminder_zoom_missing_text"] or "").strip() or None
        )

    update_data["timezone"] = "Europe/Moscow"

    if "time_local" in update_data:
        time_local_str = update_data.pop("time_local")
        if time_local_str:
            try:
                update_data["time_utc"] = _local_to_utc(time_local_str, "Europe/Moscow")
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Неверный формат времени или timezone",
                )

    if "meeting_date_local" in update_data:
        meeting_date_local = update_data.pop("meeting_date_local")
        if meeting_date_local:
            try:
                local_dt, utc_dt = _parse_local_datetime(meeting_date_local, "Europe/Moscow")
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Неверный формат meeting_date_local, ожидается YYYY-MM-DDTHH:MM",
                )
            update_data["day_of_week"] = local_dt.isoweekday()
            update_data.setdefault("time_utc", utc_dt.time())
            if new_recurrence == "one_time":
                update_data["one_time_date"] = utc_dt.date()
                update_data["next_occurrence_at"] = None
            elif new_recurrence == "on_demand":
                update_data["next_occurrence_at"] = utc_dt
                update_data["one_time_date"] = None

    if "next_occurrence_datetime_local" in update_data:
        next_dt_local = update_data.pop("next_occurrence_datetime_local")
        if next_dt_local:
            try:
                local_dt, utc_dt = _parse_local_datetime(next_dt_local, "Europe/Moscow")
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Неверный формат next_occurrence_datetime_local",
                )
            update_data["next_occurrence_at"] = utc_dt
            update_data["day_of_week"] = local_dt.isoweekday()
            update_data.setdefault("time_utc", utc_dt.time())
        else:
            update_data["next_occurrence_at"] = None

    if new_recurrence in RECURRING_RECURRENCES:
        if (
            update_data.get("day_of_week", schedule.day_of_week) is None
            or update_data.get("time_utc", schedule.time_utc) is None
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Для этого типа периодичности нужны day_of_week и time_local",
            )
    elif new_recurrence == "one_time":
        if update_data.get("one_time_date") is None and schedule.one_time_date is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Для разовой встречи нужен meeting_date_local",
            )

    if new_recurrence != "one_time":
        update_data["one_time_date"] = None
    if new_recurrence != "on_demand":
        update_data["next_occurrence_at"] = None

    has_next_occurrence_time_local = "next_occurrence_time_local" in update_data
    next_occurrence_time_local = update_data.pop("next_occurrence_time_local", None)

    if new_recurrence in {"one_time", "on_demand"}:
        update_data["next_occurrence_time_override"] = None
        update_data["next_occurrence_skip"] = False
    else:
        if has_next_occurrence_time_local:
            if next_occurrence_time_local:
                try:
                    update_data["next_occurrence_time_override"] = _local_to_utc(
                        next_occurrence_time_local,
                        "Europe/Moscow",
                    )
                except Exception:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Неверный формат времени переноса",
                    )
            else:
                update_data["next_occurrence_time_override"] = None

        if update_data.get("next_occurrence_skip") is True:
            update_data["next_occurrence_time_override"] = None

    effective_fallback_minutes = update_data.get(
        "reminder_minutes_before",
        schedule.reminder_minutes_before,
    )
    effective_offsets = _normalize_reminder_offsets(
        update_data.get("reminder_offsets_minutes"),
        fallback_minutes=effective_fallback_minutes,
    )
    update_data["reminder_offsets_minutes"] = effective_offsets
    update_data["reminder_minutes_before"] = effective_offsets[0]
    existing_reminder_texts = getattr(schedule, "reminder_texts_by_offset", None) or {}
    effective_reminder_texts = _normalize_reminder_texts_by_offset(
        update_data.get("reminder_texts_by_offset", existing_reminder_texts),
        effective_offsets,
        fallback_text=(
            update_data["reminder_text"]
            if "reminder_text" in update_data
            else schedule.reminder_text
        ),
    )
    update_data["reminder_texts_by_offset"] = effective_reminder_texts
    update_data["reminder_text"] = effective_reminder_texts.get(str(effective_offsets[0]))

    # Zoom link in reminders is mandatory for schedules.
    update_data["reminder_include_zoom_link"] = True
    update_data["reminder_zoom_missing_behavior"] = "hide"
    update_data["reminder_zoom_missing_text"] = None
    update_data["zoom_enabled"] = True

    schedule = await schedule_repo.update(session, schedule_id, **update_data)

    if schedule.recurrence == "on_demand":
        if schedule.next_occurrence_at:
            await _ensure_on_demand_template_meeting(session, schedule, schedule.created_by_id)
            existing = await _find_meeting_by_schedule_datetime(
                session,
                schedule_id=schedule.id,
                meeting_date=schedule.next_occurrence_at,
            )
            if existing:
                if existing.zoom_meeting_id and not existing.zoom_join_url:
                    existing.zoom_join_url = extract_zoom_join_url({"id": existing.zoom_meeting_id})
                if schedule.zoom_enabled and not existing.zoom_meeting_id:
                    zoom_meeting_id, zoom_join_url = await _create_zoom_fields_for_occurrence(
                        zoom_service,
                        title=schedule.title,
                        occurrence_at=schedule.next_occurrence_at,
                        duration_minutes=schedule.duration_minutes,
                        timezone=schedule.timezone,
                        context=f"updating on_demand schedule {schedule.id}",
                    )
                    if zoom_meeting_id:
                        existing.zoom_meeting_id = zoom_meeting_id
                    if zoom_join_url:
                        existing.zoom_join_url = zoom_join_url
            else:
                zoom_meeting_id = None
                zoom_join_url = None
                if schedule.zoom_enabled:
                    zoom_meeting_id, zoom_join_url = await _create_zoom_fields_for_occurrence(
                        zoom_service,
                        title=schedule.title,
                        occurrence_at=schedule.next_occurrence_at,
                        duration_minutes=schedule.duration_minutes,
                        timezone=schedule.timezone,
                        context=f"updating on_demand schedule {schedule.id}",
                    )
                meeting = Meeting(
                    title=schedule.title,
                    meeting_date=schedule.next_occurrence_at,
                    schedule_id=schedule.id,
                    status="scheduled",
                    duration_minutes=schedule.duration_minutes,
                    zoom_meeting_id=zoom_meeting_id,
                    zoom_join_url=zoom_join_url,
                    created_by_id=schedule.created_by_id,
                )
                session.add(meeting)
                await session.flush()
                if schedule.participant_ids:
                    await _add_meeting_participants(
                        session,
                        meeting.id,
                        list(schedule.participant_ids),
                    )
        else:
            template = await _find_schedule_template_meeting(session, schedule.id)
            meeting_with_date = await _find_next_scheduled_meeting_with_date(
                session,
                schedule.id,
            )
            target = template or meeting_with_date

            # If both a template and a dated scheduled meeting exist, keep the template and
            # remove the dated duplicate via SQL (avoid ORM PK-nullification on participants).
            if (
                template
                and meeting_with_date
                and template.id != meeting_with_date.id
            ):
                if meeting_with_date.zoom_meeting_id and zoom_service:
                    try:
                        await zoom_service.delete_meeting(meeting_with_date.zoom_meeting_id)
                    except Exception as e:
                        logger.warning(
                            "Zoom delete failed while clearing on_demand schedule %s: %s",
                            schedule.id,
                            e,
                        )
                await session.execute(
                    sa_delete(MeetingParticipant).where(
                        MeetingParticipant.meeting_id == meeting_with_date.id
                    )
                )
                await session.execute(
                    sa_delete(Meeting).where(Meeting.id == meeting_with_date.id)
                )
            elif (
                meeting_with_date
                and target
                and target.id == meeting_with_date.id
                and meeting_with_date.zoom_meeting_id
                and zoom_service
            ):
                try:
                    await zoom_service.delete_meeting(meeting_with_date.zoom_meeting_id)
                except Exception as e:
                    logger.warning(
                        "Zoom delete failed while clearing on_demand schedule %s: %s",
                        schedule.id,
                        e,
                    )

            if target:
                target.title = schedule.title
                target.meeting_date = None
                target.status = "scheduled"
                target.duration_minutes = schedule.duration_minutes
                target.zoom_meeting_id = None
                target.zoom_join_url = None
                target.zoom_recording_url = None
                target.sent_reminder_offsets_minutes = []

            await _ensure_on_demand_template_meeting(session, schedule, schedule.created_by_id)
    elif previous_recurrence == "on_demand":
        next_meeting_date = _calc_next_meeting_datetime(
            day_of_week=schedule.day_of_week,
            time_utc=schedule.time_utc,
            timezone_str=schedule.timezone,
            recurrence=schedule.recurrence,
            one_time_date=schedule.one_time_date,
            next_occurrence_at=schedule.next_occurrence_at,
        )
        if next_meeting_date:
            existing = await _find_meeting_by_schedule_datetime(
                session,
                schedule_id=schedule.id,
                meeting_date=next_meeting_date,
            )
            template = await _find_schedule_template_meeting(session, schedule.id)

            target = existing
            if not target:
                if template:
                    template.title = schedule.title
                    template.meeting_date = next_meeting_date
                    template.duration_minutes = schedule.duration_minutes
                    template.status = "scheduled"
                    target = template
                else:
                    target = Meeting(
                        title=schedule.title,
                        meeting_date=next_meeting_date,
                        schedule_id=schedule.id,
                        status="scheduled",
                        duration_minutes=schedule.duration_minutes,
                        created_by_id=schedule.created_by_id,
                    )
                    session.add(target)
                    await session.flush()
                    if schedule.participant_ids:
                        await _add_meeting_participants(
                            session,
                            target.id,
                            list(schedule.participant_ids),
                        )

            if schedule.zoom_enabled and target:
                if target.zoom_meeting_id and not target.zoom_join_url:
                    target.zoom_join_url = extract_zoom_join_url(
                        {"id": target.zoom_meeting_id}
                    )
                if not target.zoom_meeting_id:
                    zoom_meeting_id, zoom_join_url = await _create_zoom_fields_for_occurrence(
                        zoom_service,
                        title=schedule.title,
                        occurrence_at=next_meeting_date,
                        duration_minutes=schedule.duration_minutes,
                        timezone=schedule.timezone,
                        context=(
                            "switching schedule "
                            f"{schedule.id} from on_demand to {schedule.recurrence}"
                        ),
                    )
                    if zoom_meeting_id:
                        target.zoom_meeting_id = zoom_meeting_id
                    if zoom_join_url:
                        target.zoom_join_url = zoom_join_url

    if schedule.recurrence != "on_demand":
        await _sync_next_scheduled_meeting(session, schedule, zoom_service)

    await session.commit()
    if (
        notify_participants
        and notification_snapshot
        and _has_schedule_notification_changes(notification_snapshot, schedule)
    ):
        try:
            await _notify_schedule_change(
                request,
                session,
                previous_snapshot=notification_snapshot,
                schedule=schedule,
                deleted=False,
            )
        except Exception:
            logger.warning(
                "Unexpected error while notifying participants about schedule %s change by %s",
                schedule.id,
                member.id,
                exc_info=True,
            )
    return _enrich_response(schedule)


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: uuid.UUID,
    request: Request,
    notify_participants: bool = Query(default=False),
    member: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Soft-delete a meeting schedule (moderator only)."""
    schedule = await schedule_repo.get_by_id(session, schedule_id)
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Расписание не найдено")

    notification_snapshot = (
        _build_schedule_notification_snapshot(schedule)
        if notify_participants
        else None
    )

    await schedule_repo.delete(session, schedule_id)
    await session.commit()

    if notify_participants and notification_snapshot:
        try:
            await _notify_schedule_change(
                request,
                session,
                previous_snapshot=notification_snapshot,
                schedule=None,
                deleted=True,
            )
        except Exception:
            logger.warning(
                "Unexpected error while notifying participants about schedule %s deletion by %s",
                schedule_id,
                member.id,
                exc_info=True,
            )
