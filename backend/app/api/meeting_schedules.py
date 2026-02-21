import logging
import uuid
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
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

        return candidate_date

    return None


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
            zoom_data = None
            if zoom_service:
                try:
                    tz_aware = next_meeting_date.replace(tzinfo=ZoneInfo("UTC"))
                    zoom_data = await zoom_service.create_meeting(
                        topic=data.title,
                        start_time=tz_aware,
                        duration=data.duration_minutes,
                        timezone=timezone,
                    )
                except Exception as e:
                    logger.warning(f"Zoom create failed for new schedule: {e}")

            meeting = Meeting(
                title=data.title,
                meeting_date=next_meeting_date,
                schedule_id=schedule.id,
                status="scheduled",
                duration_minutes=data.duration_minutes,
                zoom_meeting_id=str(zoom_data["id"]) if zoom_data else None,
                zoom_join_url=extract_zoom_join_url(zoom_data) if zoom_data else None,
                created_by_id=member.id,
            )
            session.add(meeting)
            await session.flush()

            if data.participant_ids:
                await _add_meeting_participants(session, meeting.id, data.participant_ids)

    await session.commit()
    return _enrich_response(schedule)


@router.patch("/{schedule_id}", response_model=MeetingScheduleResponse)
async def update_schedule(
    schedule_id: uuid.UUID,
    data: MeetingScheduleUpdate,
    _: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Update a meeting schedule (moderator only)."""
    schedule = await schedule_repo.get_by_id(session, schedule_id)
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Расписание не найдено")

    update_data = data.model_dump(exclude_unset=True)

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
        await _ensure_on_demand_template_meeting(session, schedule, schedule.created_by_id)
        if schedule.next_occurrence_at:
            existing = await _find_meeting_by_schedule_datetime(
                session,
                schedule_id=schedule.id,
                meeting_date=schedule.next_occurrence_at,
            )
            if not existing:
                meeting = Meeting(
                    title=schedule.title,
                    meeting_date=schedule.next_occurrence_at,
                    schedule_id=schedule.id,
                    status="scheduled",
                    duration_minutes=schedule.duration_minutes,
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

    await session.commit()
    return _enrich_response(schedule)


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: uuid.UUID,
    _: TeamMember = Depends(require_moderator),
    session: AsyncSession = Depends(get_session),
):
    """Soft-delete a meeting schedule (moderator only)."""
    schedule = await schedule_repo.get_by_id(session, schedule_id)
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Расписание не найдено")

    await schedule_repo.delete(session, schedule_id)
    await session.commit()
