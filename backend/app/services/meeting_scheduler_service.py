import logging
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from aiogram import Bot
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.db.models import Meeting, MeetingParticipant, MeetingSchedule, TeamMember
from app.db.repositories import MeetingScheduleRepository

logger = logging.getLogger(__name__)


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
                        if self._should_trigger(schedule, now_utc):
                            if schedule.next_occurrence_skip:
                                # Skip this occurrence: mark triggered, reset flags
                                logger.info(
                                    f"Skipping schedule '{schedule.title}' "
                                    f"(next_occurrence_skip=True)"
                                )
                                schedule.last_triggered_date = now_utc.date()
                                schedule.next_occurrence_skip = False
                                schedule.next_occurrence_time_override = None
                                await session.commit()
                            else:
                                await self._trigger_meeting(session, schedule, now_utc)
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
        """Check if a meeting has ended (all datetimes are naive UTC)."""
        if status == "completed":
            return True
        if not meeting_date:
            return False
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

    def _should_trigger(self, schedule: MeetingSchedule, now_utc: datetime) -> bool:
        """Check all conditions for triggering a schedule."""
        # 1. Already triggered today? (DB-based, survives restarts)
        today_utc = now_utc.date()
        if schedule.last_triggered_date and schedule.last_triggered_date >= today_utc:
            return False

        # Use effective time (override or regular) for all calculations
        effective_time = schedule.next_occurrence_time_override or schedule.time_utc

        # 2. Day of week — check in LOCAL timezone to handle UTC/local day mismatch
        meeting_dt_utc = datetime.combine(
            now_utc.date(), effective_time, tzinfo=ZoneInfo("UTC")
        )
        meeting_dt_local = meeting_dt_utc.astimezone(ZoneInfo(schedule.timezone))
        if meeting_dt_local.isoweekday() != schedule.day_of_week:
            return False

        # 3. Recurrence
        if schedule.recurrence == "biweekly":
            week_number = meeting_dt_local.isocalendar()[1]
            if week_number % 2 != 0:
                return False
        elif schedule.recurrence == "monthly_last_workday":
            if not self._is_last_selected_weekday_of_month(
                meeting_dt_local, schedule.day_of_week
            ):
                return False

        # 4. Time: trigger at (effective_time - reminder_minutes_before) with catch-up
        trigger_time = self._calc_trigger_time(schedule, effective_time)
        current_minutes = now_utc.hour * 60 + now_utc.minute
        trigger_minutes = trigger_time.hour * 60 + trigger_time.minute
        meeting_minutes = effective_time.hour * 60 + effective_time.minute

        diff = abs(current_minutes - trigger_minutes)
        if diff > 720:
            diff = 1440 - diff
        in_trigger_window = diff <= 1

        # Catch-up: if trigger time has passed but meeting time hasn't,
        # still allow (handles schedule created after trigger window).
        if trigger_minutes <= meeting_minutes:
            in_catchup = trigger_minutes <= current_minutes <= meeting_minutes
        else:
            # Trigger crosses midnight
            in_catchup = current_minutes >= trigger_minutes or current_minutes <= meeting_minutes

        if not in_trigger_window and not in_catchup:
            return False

        return True

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

    async def _trigger_meeting(
        self,
        session,
        schedule: MeetingSchedule,
        now_utc: datetime,
    ) -> None:
        """Create Zoom meeting (if needed) + Meeting record + send Telegram reminders."""
        meeting_date = self._next_meeting_datetime(schedule, now_utc)
        meeting_date_naive = meeting_date.replace(tzinfo=None)

        # Check if meeting already exists (pre-created when schedule was created)
        existing = await self._find_existing_meeting(session, schedule.id, meeting_date_naive)

        # 1. Create Zoom meeting (if configured and not already set up)
        zoom_data = None
        if schedule.zoom_enabled and self.zoom_service:
            if existing and existing.zoom_meeting_id:
                zoom_data = {"id": existing.zoom_meeting_id, "join_url": existing.zoom_join_url}
            else:
                try:
                    zoom_data = await self.zoom_service.create_meeting(
                        topic=schedule.title,
                        start_time=meeting_date,
                        duration=schedule.duration_minutes,
                        timezone=schedule.timezone,
                    )
                    logger.info(
                        f"Zoom meeting created for schedule '{schedule.title}': {zoom_data.get('id')}"
                    )
                except Exception as e:
                    logger.error(f"Zoom create failed for schedule {schedule.id}: {e}")

        # 2. Use existing meeting or create new one
        if existing:
            meeting = existing
            # Update with Zoom info if it was missing
            if zoom_data and not existing.zoom_meeting_id:
                existing.zoom_meeting_id = str(zoom_data["id"])
                existing.zoom_join_url = zoom_data.get("join_url")
                await session.commit()
            logger.info(f"Using existing meeting for schedule '{schedule.title}' at {meeting_date}")
        else:
            meeting = Meeting(
                title=schedule.title,
                meeting_date=meeting_date_naive,
                schedule_id=schedule.id,
                status="scheduled",
                duration_minutes=schedule.duration_minutes,
                zoom_meeting_id=str(zoom_data["id"]) if zoom_data else None,
                zoom_join_url=zoom_data.get("join_url") if zoom_data else None,
                created_by_id=schedule.created_by_id,
            )
            session.add(meeting)
            await session.flush()

            # Add participants from schedule
            if schedule.participant_ids:
                for pid in schedule.participant_ids:
                    session.add(MeetingParticipant(meeting_id=meeting.id, member_id=pid))

            await session.commit()
            logger.info(f"Meeting created for schedule '{schedule.title}' at {meeting_date}")

        # 3. Send Telegram reminders (only if enabled)
        if schedule.reminder_enabled:
            await self._send_reminders(session, schedule, meeting, zoom_data)

        # 4. Mark as triggered in DB (survives restarts) + reset override flags
        schedule.last_triggered_date = now_utc.date()
        schedule.next_occurrence_time_override = None
        schedule.next_occurrence_skip = False
        await session.commit()

    def _next_meeting_datetime(self, schedule: MeetingSchedule, now_utc: datetime) -> datetime:
        """Calculate the meeting datetime (UTC-aware) for today's trigger."""
        effective_time = schedule.next_occurrence_time_override or schedule.time_utc
        meeting_dt = datetime.combine(now_utc.date(), effective_time)
        return meeting_dt.replace(tzinfo=ZoneInfo("UTC"))

    async def _find_existing_meeting(
        self, session, schedule_id, meeting_date_naive: datetime
    ) -> Meeting | None:
        """Find existing scheduled meeting for this schedule and date."""
        target_date = (
            meeting_date_naive.date()
            if isinstance(meeting_date_naive, datetime)
            else meeting_date_naive
        )
        stmt = select(Meeting).where(
            Meeting.schedule_id == schedule_id,
            func.date(Meeting.meeting_date) == target_date,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    async def _send_reminders(
        self, session, schedule: MeetingSchedule, meeting: Meeting, zoom_data
    ) -> None:
        """Send reminders to all telegram_targets, including participant @mentions."""
        text = schedule.reminder_text or self._default_reminder_text(schedule, meeting)

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

        if zoom_data and zoom_data.get("join_url"):
            text += f"\n\nСсылка для подключения: {zoom_data['join_url']}"

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
        try:
            # meeting_date is stored as naive UTC — explicitly localize to UTC first
            meeting_utc = meeting.meeting_date.replace(tzinfo=ZoneInfo("UTC"))
            # Always show Moscow time since the notification says "по МСК"
            moscow_time = meeting_utc.astimezone(ZoneInfo("Europe/Moscow"))
            time_str = moscow_time.strftime("%H:%M")
        except Exception:
            time_str = schedule.time_utc.strftime("%H:%M")

        return (
            f"Доброго времени ❤️\n\n"
            f"Напоминаем, сегодня в {time_str} по МСК "
            f"{schedule.title}"
        )
