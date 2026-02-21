import asyncio
import logging
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from aiogram import Bot
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.db.models import Meeting, MeetingParticipant, MeetingSchedule, TeamMember
from app.db.repositories import MeetingScheduleRepository
from app.services.zoom_service import sanitize_zoom_join_url

logger = logging.getLogger(__name__)
ZOOM_CREATE_MAX_ATTEMPTS = 3
ZOOM_CREATE_RETRY_BASE_DELAY_SECONDS = 2
ALLOWED_REMINDER_OFFSETS_MINUTES = (0, 15, 30, 60, 120)
DEFAULT_REMINDER_OFFSET_MINUTES = 60
TRIGGER_EARLY_WINDOW_SECONDS = 90
TRIGGER_LATE_GRACE_SECONDS = 300
RUSSIAN_WEEKDAYS = {
    1: "понедельник",
    2: "вторник",
    3: "среда",
    4: "четверг",
    5: "пятница",
    6: "суббота",
    7: "воскресенье",
}


class MeetingSchedulerService:
    """
    Replaces n8n workflow. Uses APScheduler.
    - Every minute checks if any schedule needs to be triggered:
      create Zoom meeting + Meeting record + send Telegram reminders.
    - Periodically syncs Zoom transcripts for finished meetings.
    """

    def __init__(
        self,
        bot: Bot,
        session_maker: async_sessionmaker,
        zoom_service=None,
    ):
        self.bot = bot
        self.session_maker = session_maker
        self.zoom_service = zoom_service
        self.scheduler = AsyncIOScheduler()

    def start(self) -> None:
        """Start the scheduler with a per-minute check."""
        if self.scheduler.running:
            logger.info("MeetingSchedulerService already running")
            return

        self.scheduler.add_job(
            self._check_schedules,
            "interval",
            minutes=1,
            id="meeting_scheduler",
            replace_existing=True,
        )
        self.scheduler.add_job(
            self._sync_zoom_transcripts,
            "interval",
            minutes=1,
            id="meeting_transcript_sync",
            replace_existing=True,
        )
        self.scheduler.start()
        logger.info("MeetingSchedulerService started")

    def stop(self) -> None:
        """Stop the scheduler."""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("MeetingSchedulerService stopped")

    async def _check_schedules(self) -> None:
        """Main loop: check all active schedules and trigger if needed."""
        try:
            now_utc = datetime.now(ZoneInfo("UTC"))
            schedule_repo = MeetingScheduleRepository()

            async with self.session_maker() as session:
                schedules = await schedule_repo.get_all_active(session)

                for schedule in schedules:
                    try:
                        reminder_offsets = self._get_schedule_reminder_offsets(schedule)
                        for reminder_offset in reminder_offsets:
                            if not self._should_trigger(schedule, now_utc, reminder_offset):
                                continue
                            if schedule.next_occurrence_skip:
                                # Skip this occurrence: mark triggered, reset flags
                                logger.info(
                                    f"Skipping schedule '{schedule.title}' "
                                    f"(next_occurrence_skip=True)"
                                )
                                schedule.last_triggered_date = self._next_meeting_datetime(
                                    schedule,
                                    now_utc,
                                ).date()
                                schedule.next_occurrence_skip = False
                                if schedule.recurrence == "on_demand":
                                    schedule.next_occurrence_at = None
                                    await self._ensure_on_demand_template_meeting(
                                        session, schedule
                                    )
                                elif schedule.recurrence == "one_time":
                                    schedule.is_active = False
                                else:
                                    schedule.next_occurrence_time_override = None
                                await session.commit()
                            else:
                                await self._trigger_meeting(
                                    session,
                                    schedule,
                                    now_utc,
                                    reminder_offset_minutes=reminder_offset,
                                )
                            # One reminder send/skip action per schedule per tick.
                            break
                    except Exception as e:
                        logger.error(
                            f"Error processing schedule {schedule.id} ({schedule.title}): {e}",
                            exc_info=True,
                        )
        except Exception as e:
            logger.error(f"Error in _check_schedules: {e}", exc_info=True)

    @staticmethod
    def _has_meeting_finished(
        meeting_date: datetime | None,
        duration_minutes: int | None,
        status: str | None,
        now_utc_naive: datetime,
    ) -> bool:
        """Check if a meeting has ended.

        Accepts either timezone-aware or naive datetimes.
        Naive values are treated as UTC.
        """
        if status == "completed":
            return True
        if not meeting_date:
            return False

        def _to_utc_naive(value: datetime) -> datetime:
            if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
                return value
            return value.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)

        # Normalize both values to comparable naive UTC datetimes.
        meeting_date = _to_utc_naive(meeting_date)
        now_utc_naive = _to_utc_naive(now_utc_naive)

        duration = duration_minutes or 60
        end_time = meeting_date + timedelta(minutes=duration)
        return now_utc_naive >= end_time

    async def _sync_zoom_transcripts(self) -> None:
        """Try to auto-fetch Zoom transcripts for recently finished meetings."""
        if not self.zoom_service:
            return

        now_utc_naive = datetime.now(ZoneInfo("UTC")).replace(tzinfo=None)
        lookback_start = now_utc_naive - timedelta(days=30)

        try:
            async with self.session_maker() as session:
                stmt = (
                    select(Meeting)
                    .where(
                        Meeting.zoom_meeting_id.is_not(None),
                        Meeting.transcript.is_(None),
                        Meeting.meeting_date.is_not(None),
                        Meeting.meeting_date >= lookback_start,
                        Meeting.meeting_date <= now_utc_naive,
                    )
                    .order_by(Meeting.meeting_date.desc())
                    .limit(100)
                )
                result = await session.execute(stmt)
                meetings = list(result.scalars().all())

                updated = 0
                for meeting in meetings:
                    if not self._has_meeting_finished(
                        meeting.meeting_date,
                        meeting.duration_minutes,
                        meeting.status,
                        now_utc_naive,
                    ):
                        continue

                    try:
                        transcript_text = await self.zoom_service.get_transcript(
                            meeting.zoom_meeting_id
                        )
                    except Exception as e:
                        logger.warning(
                            "Zoom transcript fetch failed for meeting %s (zoom_id=%s): %s",
                            meeting.id,
                            meeting.zoom_meeting_id,
                            e,
                        )
                        continue

                    if not transcript_text:
                        continue

                    meeting.transcript = transcript_text
                    meeting.transcript_source = "zoom_api"
                    updated += 1
                    logger.info("Transcript synced from Zoom for meeting %s", meeting.id)

                if updated:
                    await session.commit()
                    logger.info("Zoom transcript sync updated %s meeting(s)", updated)
        except Exception as e:
            logger.error(f"Error in _sync_zoom_transcripts: {e}", exc_info=True)

    def _should_trigger(
        self,
        schedule: MeetingSchedule,
        now_utc: datetime,
        reminder_offset_minutes: int,
    ) -> bool:
        """Check trigger window for a specific reminder offset."""
        recurrence = schedule.recurrence
        effective_time = schedule.next_occurrence_time_override or schedule.time_utc

        # on_demand has explicit datetime, not weekday-based recurrence.
        if recurrence == "on_demand":
            if not schedule.next_occurrence_at:
                return False
            meeting_dt_utc = schedule.next_occurrence_at
            if meeting_dt_utc.tzinfo is None:
                meeting_dt_utc = meeting_dt_utc.replace(tzinfo=ZoneInfo("UTC"))
            else:
                meeting_dt_utc = meeting_dt_utc.astimezone(ZoneInfo("UTC"))
            trigger_at = meeting_dt_utc - timedelta(minutes=reminder_offset_minutes)
            delta_seconds = (now_utc - trigger_at).total_seconds()
            return -TRIGGER_EARLY_WINDOW_SECONDS <= delta_seconds <= TRIGGER_LATE_GRACE_SECONDS

        if recurrence == "one_time":
            if not schedule.one_time_date:
                return False
            meeting_dt_utc = datetime.combine(
                schedule.one_time_date,
                effective_time,
                tzinfo=ZoneInfo("UTC"),
            )
            if schedule.last_triggered_date and schedule.last_triggered_date >= meeting_dt_utc.date():
                return False
            trigger_at = meeting_dt_utc - timedelta(minutes=reminder_offset_minutes)
            delta_seconds = (now_utc - trigger_at).total_seconds()
            return -TRIGGER_EARLY_WINDOW_SECONDS <= delta_seconds <= TRIGGER_LATE_GRACE_SECONDS

        # Recurring weekday modes.
        timezone = ZoneInfo(schedule.timezone)
        for day_shift in (0, 1):
            meeting_dt_utc = datetime.combine(
                now_utc.date() + timedelta(days=day_shift),
                effective_time,
                tzinfo=ZoneInfo("UTC"),
            )
            if schedule.last_triggered_date and schedule.last_triggered_date >= meeting_dt_utc.date():
                continue
            meeting_dt_local = meeting_dt_utc.astimezone(timezone)
            if meeting_dt_local.isoweekday() != schedule.day_of_week:
                continue

            if recurrence == "biweekly":
                week_number = meeting_dt_local.isocalendar()[1]
                if week_number % 2 != 0:
                    continue
            elif recurrence == "monthly_last_workday":
                if not self._is_last_selected_weekday_of_month(
                    meeting_dt_local,
                    schedule.day_of_week,
                ):
                    continue

            trigger_at = meeting_dt_utc - timedelta(minutes=reminder_offset_minutes)
            delta_seconds = (now_utc - trigger_at).total_seconds()
            if -TRIGGER_EARLY_WINDOW_SECONDS <= delta_seconds <= TRIGGER_LATE_GRACE_SECONDS:
                return True
        return False

    def _calc_trigger_time(self, schedule: MeetingSchedule, effective_time: time | None = None) -> time:
        """Calculate trigger time = effective_time - reminder_minutes_before."""
        t = effective_time or schedule.time_utc
        meeting_minutes = t.hour * 60 + t.minute
        trigger_minutes = meeting_minutes - schedule.reminder_minutes_before
        # Handle negative (wraps to previous day — but we only trigger on matching day)
        if trigger_minutes < 0:
            trigger_minutes += 1440
        h = trigger_minutes // 60
        m = trigger_minutes % 60
        return time(h, m)

    @staticmethod
    def _is_last_selected_weekday_of_month(dt: datetime, day_of_week: int) -> bool:
        """Check: current day is selected weekday and it's the last one in this month."""
        if dt.isoweekday() != day_of_week:
            return False
        next_same_weekday = dt + timedelta(days=7)
        return next_same_weekday.month != dt.month

    @staticmethod
    def _normalize_reminder_offsets(
        reminder_offsets_minutes: list[int] | None,
        fallback_minutes: int | None = None,
    ) -> list[int]:
        raw_values = list(reminder_offsets_minutes or [])
        if not raw_values and fallback_minutes is not None:
            raw_values = [fallback_minutes]
        if not raw_values:
            raw_values = [DEFAULT_REMINDER_OFFSET_MINUTES]

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
                normalized = [DEFAULT_REMINDER_OFFSET_MINUTES]

        return sorted(normalized, reverse=True)

    @classmethod
    def _get_schedule_reminder_offsets(cls, schedule: MeetingSchedule) -> list[int]:
        return cls._normalize_reminder_offsets(
            getattr(schedule, "reminder_offsets_minutes", None),
            fallback_minutes=getattr(schedule, "reminder_minutes_before", DEFAULT_REMINDER_OFFSET_MINUTES),
        )

    @staticmethod
    def _contains_zoom_link_placeholder(template: str) -> bool:
        template_lower = template.lower()
        return (
            "{zoom_link}" in template_lower
            or "{zoom_url}" in template_lower
            or "{ссылка_zoom}" in template_lower
        )

    @staticmethod
    def _resolve_zoom_join_url(raw_join_url: str | None, zoom_meeting_id: str | None) -> str | None:
        safe_join_url = sanitize_zoom_join_url(
            raw_join_url,
            zoom_meeting_id=zoom_meeting_id,
        )
        if safe_join_url:
            return safe_join_url
        if zoom_meeting_id:
            return f"https://zoom.us/j/{zoom_meeting_id}"
        return None

    async def _create_zoom_meeting_with_retry(
        self,
        schedule: MeetingSchedule,
        meeting_date: datetime,
    ) -> dict:
        if not self.zoom_service:
            raise RuntimeError(
                f"Zoom is required for schedule '{schedule.title}', but ZoomService is not configured"
            )

        last_error: Exception | None = None
        for attempt in range(1, ZOOM_CREATE_MAX_ATTEMPTS + 1):
            try:
                zoom_data = await self.zoom_service.create_meeting(
                    topic=schedule.title,
                    start_time=meeting_date,
                    duration=schedule.duration_minutes,
                    timezone=schedule.timezone,
                )
                if not zoom_data or not zoom_data.get("id"):
                    raise RuntimeError("Zoom API returned response without meeting id")
                logger.info(
                    "Zoom meeting created for schedule '%s': %s (attempt %s/%s)",
                    schedule.title,
                    zoom_data.get("id"),
                    attempt,
                    ZOOM_CREATE_MAX_ATTEMPTS,
                )
                return zoom_data
            except Exception as exc:
                last_error = exc
                if attempt >= ZOOM_CREATE_MAX_ATTEMPTS:
                    break
                delay_seconds = ZOOM_CREATE_RETRY_BASE_DELAY_SECONDS * attempt
                logger.warning(
                    "Zoom create failed for schedule %s (%s/%s): %s. Retrying in %ss",
                    schedule.id,
                    attempt,
                    ZOOM_CREATE_MAX_ATTEMPTS,
                    exc,
                    delay_seconds,
                )
                await asyncio.sleep(delay_seconds)

        raise RuntimeError(
            f"Zoom meeting creation failed for schedule {schedule.id} after "
            f"{ZOOM_CREATE_MAX_ATTEMPTS} attempts"
        ) from last_error

    async def _trigger_meeting(
        self,
        session,
        schedule: MeetingSchedule,
        now_utc: datetime,
        reminder_offset_minutes: int,
    ) -> None:
        """Create/update meeting + send reminder for a specific offset."""
        meeting_date = self._next_meeting_datetime(schedule, now_utc)
        meeting_date_naive = meeting_date.replace(tzinfo=None)
        configured_offsets = self._get_schedule_reminder_offsets(schedule)

        # Check if meeting already exists (pre-created when schedule was created)
        existing = await self._find_existing_meeting(session, schedule.id, meeting_date_naive)
        if existing and reminder_offset_minutes in (existing.sent_reminder_offsets_minutes or []):
            return

        # 1. Create Zoom meeting (required for reminder delivery)
        zoom_data = None
        if schedule.zoom_enabled:
            if existing and existing.zoom_meeting_id:
                zoom_data = {
                    "id": existing.zoom_meeting_id,
                    "join_url": self._resolve_zoom_join_url(
                        existing.zoom_join_url,
                        existing.zoom_meeting_id,
                    ),
                }
            else:
                zoom_data = await self._create_zoom_meeting_with_retry(schedule, meeting_date)

        zoom_meeting_id = str(zoom_data["id"]) if zoom_data and zoom_data.get("id") else None
        zoom_join_url = self._resolve_zoom_join_url(
            (zoom_data or {}).get("join_url"),
            zoom_meeting_id,
        )

        if existing and not zoom_meeting_id:
            zoom_meeting_id = existing.zoom_meeting_id
        if existing and not zoom_join_url:
            zoom_join_url = self._resolve_zoom_join_url(
                existing.zoom_join_url,
                zoom_meeting_id or existing.zoom_meeting_id,
            )

        if schedule.zoom_enabled and not zoom_join_url:
            raise RuntimeError(
                f"Zoom link is required but missing for schedule {schedule.id} "
                f"at {meeting_date.isoformat()}"
            )

        # 2. Use existing meeting or create new one
        if existing:
            meeting = existing
            updated = False
            # Update stored Zoom data if it was missing or stale.
            if zoom_meeting_id and existing.zoom_meeting_id != zoom_meeting_id:
                existing.zoom_meeting_id = zoom_meeting_id
                updated = True
            if zoom_join_url and existing.zoom_join_url != zoom_join_url:
                existing.zoom_join_url = zoom_join_url
                updated = True
            if updated:
                logger.info(
                    "Zoom metadata refreshed for schedule '%s' at %s",
                    schedule.title,
                    meeting_date,
                )
            logger.info(f"Using existing meeting for schedule '{schedule.title}' at {meeting_date}")
        else:
            meeting = Meeting(
                title=schedule.title,
                meeting_date=meeting_date_naive,
                schedule_id=schedule.id,
                status="scheduled",
                duration_minutes=schedule.duration_minutes,
                zoom_meeting_id=zoom_meeting_id,
                zoom_join_url=zoom_join_url,
                created_by_id=schedule.created_by_id,
            )
            session.add(meeting)
            await session.flush()

            # Add participants from schedule
            if schedule.participant_ids:
                for pid in schedule.participant_ids:
                    session.add(MeetingParticipant(meeting_id=meeting.id, member_id=pid))
            logger.info(f"Meeting prepared for schedule '{schedule.title}' at {meeting_date}")

        # 3. Send Telegram reminders (only if enabled)
        if schedule.reminder_enabled:
            await self._send_reminders(
                session,
                schedule,
                meeting,
                zoom_data,
                reminder_offset_minutes=reminder_offset_minutes,
            )

        sent_offsets = set(meeting.sent_reminder_offsets_minutes or [])
        sent_offsets.add(reminder_offset_minutes)
        meeting.sent_reminder_offsets_minutes = sorted(sent_offsets, reverse=True)

        all_required_sent = all(offset in sent_offsets for offset in configured_offsets)
        if all_required_sent:
            # Mark occurrence as fully processed only after all configured reminders were sent.
            schedule.last_triggered_date = meeting_date.date()
            if schedule.recurrence == "on_demand":
                schedule.next_occurrence_at = None
                await self._ensure_on_demand_template_meeting(session, schedule)
            elif schedule.recurrence == "one_time":
                schedule.is_active = False
            else:
                schedule.next_occurrence_time_override = None
                schedule.next_occurrence_skip = False
        await session.commit()

    def _next_meeting_datetime(self, schedule: MeetingSchedule, now_utc: datetime) -> datetime:
        """Calculate the meeting datetime (UTC-aware) for today's trigger."""
        if schedule.recurrence == "on_demand" and schedule.next_occurrence_at:
            if schedule.next_occurrence_at.tzinfo is None:
                return schedule.next_occurrence_at.replace(tzinfo=ZoneInfo("UTC"))
            return schedule.next_occurrence_at.astimezone(ZoneInfo("UTC"))

        if schedule.recurrence == "one_time" and schedule.one_time_date:
            effective_time = schedule.next_occurrence_time_override or schedule.time_utc
            return datetime.combine(
                schedule.one_time_date,
                effective_time,
                tzinfo=ZoneInfo("UTC"),
            )

        effective_time = schedule.next_occurrence_time_override or schedule.time_utc
        meeting_dt = datetime.combine(now_utc.date(), effective_time)
        return meeting_dt.replace(tzinfo=ZoneInfo("UTC"))

    async def _find_existing_meeting(
        self, session, schedule_id, meeting_date_naive: datetime
    ) -> Meeting | None:
        """Find existing scheduled meeting for this schedule and datetime."""
        stmt = select(Meeting).where(
            Meeting.schedule_id == schedule_id,
            Meeting.meeting_date == meeting_date_naive,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def _ensure_on_demand_template_meeting(
        self,
        session,
        schedule: MeetingSchedule,
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
            created_by_id=schedule.created_by_id,
        )
        session.add(template)
        await session.flush()
        if schedule.participant_ids:
            for pid in schedule.participant_ids:
                session.add(MeetingParticipant(meeting_id=template.id, member_id=pid))
        return template

    async def _send_reminders(
        self,
        session,
        schedule: MeetingSchedule,
        meeting: Meeting,
        zoom_data,
        reminder_offset_minutes: int | None = None,
    ) -> None:
        """Send reminders to all telegram_targets, including participant @mentions."""
        raw_join_url = (zoom_data or {}).get("join_url") or meeting.zoom_join_url
        safe_join_url = self._resolve_zoom_join_url(
            raw_join_url,
            meeting.zoom_meeting_id,
        )
        include_zoom_link = bool(getattr(schedule, "zoom_enabled", False)) or getattr(
            schedule, "reminder_include_zoom_link", True
        )

        if include_zoom_link and not safe_join_url:
            raise RuntimeError(
                f"Cannot send reminder for schedule {schedule.id}: Zoom link is missing"
            )

        custom_template = (schedule.reminder_text or "").strip()
        contains_zoom_placeholder = self._contains_zoom_link_placeholder(custom_template)
        if custom_template:
            text = self._render_custom_reminder_text(
                custom_template,
                schedule,
                meeting,
                zoom_link=safe_join_url if include_zoom_link else None,
            )
        else:
            text = self._default_reminder_text(schedule, meeting)

        # Add participant @username mentions
        if schedule.participant_ids:
            members = await self._get_participants(session, schedule.participant_ids)
            mentions = []
            for m in members:
                if m.telegram_username:
                    username = m.telegram_username.lstrip("@")
                    mentions.append(f"@{username}")
            if mentions:
                text += "\n\n" + " ".join(mentions)

        if include_zoom_link:
            if contains_zoom_placeholder:
                logger.info(
                    "Reminder for schedule %s uses {zoom_link} placeholder (offset=%s)",
                    schedule.id,
                    reminder_offset_minutes,
                )
            else:
                text += f"\n\nСсылка для подключения: {safe_join_url}"

        # Deduplicate targets by chat_id+thread_id to avoid sending twice
        seen_targets: set[str] = set()
        for target in schedule.telegram_targets or []:
            chat_id = target.get("chat_id")
            thread_id = target.get("thread_id")
            if not chat_id:
                continue
            target_key = f"{chat_id}:{thread_id}"
            if target_key in seen_targets:
                logger.warning(f"Skipping duplicate target {target_key} for '{schedule.title}'")
                continue
            seen_targets.add(target_key)
            try:
                kwargs = {"chat_id": int(chat_id), "text": text, "parse_mode": "HTML"}
                if thread_id:
                    kwargs["message_thread_id"] = int(thread_id)
                await self.bot.send_message(**kwargs)
                logger.info(f"Reminder sent to chat {chat_id} for '{schedule.title}'")
            except Exception as e:
                logger.error(f"Failed to send reminder to {chat_id}: {e}")

    @staticmethod
    async def _get_participants(session, participant_ids: list) -> list[TeamMember]:
        """Fetch TeamMember objects by their IDs."""
        if not participant_ids:
            return []
        stmt = select(TeamMember).where(
            TeamMember.id.in_(participant_ids),
            TeamMember.is_active.is_(True),
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    def _default_reminder_text(schedule: MeetingSchedule, meeting: Meeting) -> str:
        """Default reminder text if reminder_text is not set."""
        time_str, _, _ = MeetingSchedulerService._meeting_time_parts(schedule, meeting)

        return (
            f"Здравствуйте! Напоминаю, сегодня в {time_str} по МСК "
            f"встреча {schedule.title}"
        )

    @staticmethod
    def _meeting_time_parts(schedule: MeetingSchedule, meeting: Meeting) -> tuple[str, str, str]:
        """Return (time_msk, date_msk, weekday_ru) for reminder templates."""
        try:
            # meeting_date is stored as naive UTC — explicitly localize to UTC first
            meeting_utc = meeting.meeting_date.replace(tzinfo=ZoneInfo("UTC"))
            # Always show Moscow time since the notification says "по МСК"
            moscow_time = meeting_utc.astimezone(ZoneInfo("Europe/Moscow"))
            time_str = moscow_time.strftime("%H:%M")
            date_str = moscow_time.strftime("%d.%m.%Y")
            weekday_str = RUSSIAN_WEEKDAYS.get(moscow_time.isoweekday(), "")
        except Exception:
            time_str = schedule.time_utc.strftime("%H:%M")
            date_str = datetime.now(ZoneInfo("Europe/Moscow")).strftime("%d.%m.%Y")
            weekday_str = ""
        return time_str, date_str, weekday_str

    @staticmethod
    def _render_custom_reminder_text(
        template: str,
        schedule: MeetingSchedule,
        meeting: Meeting,
        zoom_link: str | None = None,
    ) -> str:
        """Render template placeholders for custom reminder text."""
        time_str, date_str, weekday_str = MeetingSchedulerService._meeting_time_parts(
            schedule, meeting
        )
        replacements = {
            "{время}": time_str,
            "{название}": schedule.title,
            "{дата}": date_str,
            "{день_недели}": weekday_str,
            "{time_msk}": time_str,
            "{title}": schedule.title,
            "{date_msk}": date_str,
            "{weekday_ru}": weekday_str,
            "{zoom_link}": zoom_link or "",
            "{zoom_url}": zoom_link or "",
            "{ссылка_zoom}": zoom_link or "",
        }
        rendered = template
        for token, value in replacements.items():
            rendered = rendered.replace(token, value)
        return rendered
