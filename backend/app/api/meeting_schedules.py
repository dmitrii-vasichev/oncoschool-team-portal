import logging
import uuid
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from zoneinfo import ZoneInfo

from app.api.auth import get_current_user, require_moderator
from app.db.database import get_session
from app.db.models import Meeting, MeetingParticipant, MeetingSchedule, TeamMember
from app.db.repositories import MeetingScheduleRepository, TelegramTargetRepository, TeamMemberRepository
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
member_repo = TeamMemberRepository()

VALID_RECURRENCES = {"weekly", "biweekly", "monthly_last_workday"}
DEFAULT_REMINDER_ZOOM_MISSING_TEXT = "Ссылка на Zoom появится позже."


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


def _calc_next_meeting_datetime(
    day_of_week: int,
    time_utc: time,
    timezone_str: str,
    recurrence: str,
) -> datetime | None:
    """Calculate the next meeting datetime (naive UTC) for a given schedule.

    Iterates up to ~2 months ahead and finds the first datetime where:
    - the meeting time is in the future
    - local date matches recurrence/day_of_week rules
    """
    now_utc = datetime.now(ZoneInfo("UTC"))
    tz = ZoneInfo(timezone_str)

    for days_ahead in range(60):
        candidate_date = now_utc.date() + timedelta(days=days_ahead)
        candidate_dt = datetime.combine(candidate_date, time_utc, tzinfo=ZoneInfo("UTC"))
        candidate_local = candidate_dt.astimezone(tz)

        if candidate_dt > now_utc and _matches_recurrence(
            candidate_local, day_of_week, recurrence
        ):
            return candidate_dt.replace(tzinfo=None)  # Return naive UTC

    return None


def _calc_next_occurrence_date(schedule: MeetingSchedule) -> date | None:
    """Calculate the next occurrence date for a schedule, considering recurrence rules."""
    now_utc = datetime.now(ZoneInfo("UTC"))
    tz = ZoneInfo(schedule.timezone)
    effective_time = schedule.next_occurrence_time_override or schedule.time_utc

    for days_ahead in range(60):  # Look up to ~2 months ahead
        candidate_date = now_utc.date() + timedelta(days=days_ahead)
        candidate_dt = datetime.combine(candidate_date, effective_time, tzinfo=ZoneInfo("UTC"))
        candidate_local = candidate_dt.astimezone(tz)

        # Must be in the future (or today if not yet triggered)
        if candidate_dt <= now_utc:
            # Allow today if not yet triggered
            if candidate_date != now_utc.date():
                continue
            if schedule.last_triggered_date and schedule.last_triggered_date >= candidate_date:
                continue

        # Already triggered on this date
        if schedule.last_triggered_date and candidate_date <= schedule.last_triggered_date:
            continue

        # Day of week + recurrence check (in local timezone)
        if not _matches_recurrence(candidate_local, schedule.day_of_week, schedule.recurrence):
            continue

        return candidate_date

    return None


def _enrich_response(schedule: MeetingSchedule) -> MeetingScheduleResponse:
    """Build response with computed next_occurrence_date."""
    resp = MeetingScheduleResponse.model_validate(schedule)
    resp.next_occurrence_date = _calc_next_occurrence_date(schedule)
    return resp


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
    # Validate
    if data.day_of_week < 1 or data.day_of_week > 7:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="day_of_week должен быть от 1 (Пн) до 7 (Вс)",
        )
    if data.recurrence not in VALID_RECURRENCES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"recurrence должен быть одним из: {', '.join(VALID_RECURRENCES)}",
        )

    # Convert local time to UTC
    try:
        time_utc = _local_to_utc(data.time_local, "Europe/Moscow")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный формат времени или timezone",
        )

    # If telegram_targets is empty, use defaults from TelegramNotificationTarget table
    telegram_targets = data.telegram_targets
    if not telegram_targets:
        active_targets = await target_repo.get_all_active(session)
        telegram_targets = [
            {"chat_id": str(t.chat_id), "thread_id": t.thread_id}
            for t in active_targets
        ]

    reminder_text = (data.reminder_text or "").strip() or None
    reminder_zoom_missing_text = (data.reminder_zoom_missing_text or "").strip() or None

    reminder_include_zoom_link = data.reminder_include_zoom_link
    reminder_zoom_missing_behavior = data.reminder_zoom_missing_behavior
    if not reminder_include_zoom_link:
        reminder_zoom_missing_behavior = "hide"
        reminder_zoom_missing_text = None
    elif reminder_zoom_missing_behavior == "hide":
        reminder_zoom_missing_text = None
    elif reminder_zoom_missing_behavior == "fallback" and reminder_zoom_missing_text is None:
        reminder_zoom_missing_text = DEFAULT_REMINDER_ZOOM_MISSING_TEXT

    schedule = await schedule_repo.create(
        session,
        title=data.title,
        day_of_week=data.day_of_week,
        time_utc=time_utc,
        timezone="Europe/Moscow",
        duration_minutes=data.duration_minutes,
        recurrence=data.recurrence,
        reminder_enabled=data.reminder_enabled,
        reminder_minutes_before=data.reminder_minutes_before,
        reminder_text=reminder_text,
        reminder_include_zoom_link=reminder_include_zoom_link,
        reminder_zoom_missing_behavior=reminder_zoom_missing_behavior,
        reminder_zoom_missing_text=reminder_zoom_missing_text,
        telegram_targets=telegram_targets,
        participant_ids=data.participant_ids,
        zoom_enabled=data.zoom_enabled,
        created_by_id=member.id,
    )

    # Create the first upcoming meeting immediately so it appears in the UI
    next_meeting_date = _calc_next_meeting_datetime(
        data.day_of_week, time_utc, "Europe/Moscow", data.recurrence
    )
    if next_meeting_date:
        zoom_data = None
        zoom_service = getattr(request.app.state, "zoom_service", None)
        if data.zoom_enabled and zoom_service:
            try:
                tz_aware = next_meeting_date.replace(tzinfo=ZoneInfo("UTC"))
                zoom_data = await zoom_service.create_meeting(
                    topic=data.title,
                    start_time=tz_aware,
                    duration=data.duration_minutes,
                    timezone="Europe/Moscow",
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
            for pid in data.participant_ids:
                session.add(MeetingParticipant(meeting_id=meeting.id, member_id=pid))

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

    # Validate if provided
    if "day_of_week" in update_data:
        if update_data["day_of_week"] < 1 or update_data["day_of_week"] > 7:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="day_of_week должен быть от 1 (Пн) до 7 (Вс)",
            )
    if "recurrence" in update_data:
        if update_data["recurrence"] not in VALID_RECURRENCES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"recurrence должен быть одним из: {', '.join(VALID_RECURRENCES)}",
            )

    # Normalize optional free text fields
    if "reminder_text" in update_data:
        update_data["reminder_text"] = (update_data["reminder_text"] or "").strip() or None
    if "reminder_zoom_missing_text" in update_data:
        update_data["reminder_zoom_missing_text"] = (
            (update_data["reminder_zoom_missing_text"] or "").strip() or None
        )

    # Force timezone to Moscow
    update_data["timezone"] = "Europe/Moscow"

    # Convert time_local -> time_utc if provided
    if "time_local" in update_data:
        try:
            update_data["time_utc"] = _local_to_utc(update_data.pop("time_local"), "Europe/Moscow")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Неверный формат времени или timezone",
            )
    # Remove time_local from update_data if not already removed
    update_data.pop("time_local", None)

    # Handle next_occurrence_time_local -> next_occurrence_time_override (UTC)
    if "next_occurrence_time_local" in update_data:
        time_local_str = update_data.pop("next_occurrence_time_local")
        if time_local_str:
            try:
                update_data["next_occurrence_time_override"] = _local_to_utc(time_local_str, "Europe/Moscow")
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Неверный формат времени переноса",
                )
        else:
            update_data["next_occurrence_time_override"] = None

    # Mutual exclusivity: skip=True clears time override
    if update_data.get("next_occurrence_skip") is True:
        update_data["next_occurrence_time_override"] = None

    # Normalize reminder Zoom block options
    effective_include_zoom = update_data.get(
        "reminder_include_zoom_link", schedule.reminder_include_zoom_link
    )
    effective_missing_behavior = update_data.get(
        "reminder_zoom_missing_behavior", schedule.reminder_zoom_missing_behavior
    )
    effective_missing_text = update_data.get(
        "reminder_zoom_missing_text", schedule.reminder_zoom_missing_text
    )

    if not effective_include_zoom:
        update_data["reminder_zoom_missing_behavior"] = "hide"
        update_data["reminder_zoom_missing_text"] = None
    elif effective_missing_behavior == "hide":
        update_data["reminder_zoom_missing_text"] = None
    elif effective_missing_behavior == "fallback" and not (effective_missing_text or "").strip():
        update_data["reminder_zoom_missing_text"] = DEFAULT_REMINDER_ZOOM_MISSING_TEXT

    schedule = await schedule_repo.update(session, schedule_id, **update_data)
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
