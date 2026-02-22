import asyncio
import html
import logging
import uuid
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from aiogram import Bot
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.db.models import (
    Meeting,
    MeetingParticipant,
    MeetingSchedule,
    TeamMember,
    TelegramNotificationTarget,
)
from app.db.repositories import AppSettingsRepository, MeetingScheduleRepository
from app.services.zoom_service import sanitize_zoom_join_url

logger = logging.getLogger(__name__)
ZOOM_CREATE_MAX_ATTEMPTS = 3
ZOOM_CREATE_RETRY_BASE_DELAY_SECONDS = 2
ALLOWED_REMINDER_OFFSETS_MINUTES = (0, 15, 30, 60, 120)
DEFAULT_REMINDER_OFFSET_MINUTES = 60
MEETING_REMINDER_TEXTS_KEY = "meeting_reminder_texts"
MEETING_WEEKLY_DIGEST_SETTINGS_KEY = "meeting_weekly_digest_settings"
DEFAULT_MEETING_WEEKLY_DIGEST_DAY = 7
DEFAULT_MEETING_WEEKLY_DIGEST_TIME = "21:00"
DEFAULT_MEETING_WEEKLY_DIGEST_TEMPLATE = (
    "Наши встречи с {week_start} по {week_end}:\n\n{meetings}"
)
MEETING_DIGEST_TIMEZONE = "Europe/Moscow"
WEEKLY_DIGEST_LAST_SENT_WEEK_START_KEY = "last_sent_week_start"
REMINDER_PARTICIPANTS_PLACEHOLDERS = (
    "{участники}",
    "{юзернеймы}",
    "{participants}",
    "{usernames}",
    "{participant_usernames}",
)
TRIGGER_EARLY_WINDOW_SECONDS = 0
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
RUSSIAN_WEEKDAYS_SHORT = {
    1: "Пн",
    2: "Вт",
    3: "Ср",
    4: "Чт",
    5: "Пт",
    6: "Сб",
    7: "Вс",
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
        self.app_settings_repo = AppSettingsRepository()
        self.scheduler = AsyncIOScheduler()

    def start(self) -> None:
        """Start the scheduler with a per-minute check."""
        if self.scheduler.running:
            logger.info("MeetingSchedulerService already running")
            return

        self.scheduler.add_job(
            self._check_schedules,
            "cron",
            minute="*",
            second=0,
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
        self.scheduler.add_job(
            self._check_weekly_meeting_digest,
            "cron",
            minute="*",
            second=10,
            id="meeting_weekly_digest",
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

    @staticmethod
    def _parse_hhmm(value: str) -> tuple[int, int]:
        raw = str(value or "").strip()
        parts = raw.split(":")
        if len(parts) != 2:
            raise ValueError("Invalid HH:MM format")
        hour = int(parts[0])
        minute = int(parts[1])
        if not (0 <= hour < 24 and 0 <= minute < 60):
            raise ValueError("Time must be in 00:00..23:59 range")
        return hour, minute

    @classmethod
    def _normalize_weekly_digest_settings(cls, value: dict | None) -> dict:
        source = value if isinstance(value, dict) else {}
        enabled = bool(source.get("enabled", False))

        try:
            day_of_week = int(source.get("day_of_week", DEFAULT_MEETING_WEEKLY_DIGEST_DAY))
        except (TypeError, ValueError):
            day_of_week = DEFAULT_MEETING_WEEKLY_DIGEST_DAY
        if day_of_week < 1 or day_of_week > 7:
            day_of_week = DEFAULT_MEETING_WEEKLY_DIGEST_DAY

        time_local = str(source.get("time_local", DEFAULT_MEETING_WEEKLY_DIGEST_TIME) or "").strip()
        try:
            hour, minute = cls._parse_hhmm(time_local)
        except (TypeError, ValueError):
            time_local = DEFAULT_MEETING_WEEKLY_DIGEST_TIME
            hour, minute = cls._parse_hhmm(time_local)

        template = str(source.get("template") or "").strip() or DEFAULT_MEETING_WEEKLY_DIGEST_TEMPLATE

        target_ids: list[uuid.UUID] = []
        raw_target_ids = source.get("target_ids")
        if isinstance(raw_target_ids, list):
            for raw_target_id in raw_target_ids:
                try:
                    parsed_target_id = uuid.UUID(str(raw_target_id))
                except (TypeError, ValueError):
                    continue
                if parsed_target_id not in target_ids:
                    target_ids.append(parsed_target_id)

        last_sent_week_start = source.get(WEEKLY_DIGEST_LAST_SENT_WEEK_START_KEY)
        if not isinstance(last_sent_week_start, str) or not last_sent_week_start.strip():
            last_sent_week_start = None
        else:
            last_sent_week_start = last_sent_week_start.strip()

        return {
            "enabled": enabled,
            "day_of_week": day_of_week,
            "time_local": time_local,
            "hour": hour,
            "minute": minute,
            "target_ids": target_ids,
            "template": template,
            "timezone": MEETING_DIGEST_TIMEZONE,
            WEEKLY_DIGEST_LAST_SENT_WEEK_START_KEY: last_sent_week_start,
        }

    @staticmethod
    def _serialize_weekly_digest_settings(normalized: dict) -> dict:
        return {
            "enabled": bool(normalized.get("enabled", False)),
            "day_of_week": int(normalized.get("day_of_week", DEFAULT_MEETING_WEEKLY_DIGEST_DAY)),
            "time_local": str(normalized.get("time_local", DEFAULT_MEETING_WEEKLY_DIGEST_TIME)),
            "timezone": MEETING_DIGEST_TIMEZONE,
            "target_ids": [str(target_id) for target_id in (normalized.get("target_ids") or [])],
            "template": str(
                normalized.get("template") or DEFAULT_MEETING_WEEKLY_DIGEST_TEMPLATE
            ),
            WEEKLY_DIGEST_LAST_SENT_WEEK_START_KEY: normalized.get(
                WEEKLY_DIGEST_LAST_SENT_WEEK_START_KEY
            ),
        }

    @staticmethod
    def _next_week_bounds(now_msk: datetime) -> tuple[date, date]:
        days_until_next_monday = 8 - now_msk.isoweekday()
        week_start = now_msk.date() + timedelta(days=days_until_next_monday)
        week_end = week_start + timedelta(days=6)
        return week_start, week_end

    async def _check_weekly_meeting_digest(self) -> None:
        try:
            now_utc = datetime.now(ZoneInfo("UTC"))
            now_msk = now_utc.astimezone(ZoneInfo(MEETING_DIGEST_TIMEZONE))

            async with self.session_maker() as session:
                setting = await self.app_settings_repo.get(
                    session, MEETING_WEEKLY_DIGEST_SETTINGS_KEY
                )
                normalized = self._normalize_weekly_digest_settings(
                    setting.value if setting else None
                )
                if not normalized["enabled"]:
                    return

                if now_msk.isoweekday() != normalized["day_of_week"]:
                    return
                if now_msk.hour != normalized["hour"] or now_msk.minute != normalized["minute"]:
                    return

                week_start, week_end = self._next_week_bounds(now_msk)
                week_start_key = week_start.isoformat()
                if normalized.get(WEEKLY_DIGEST_LAST_SENT_WEEK_START_KEY) == week_start_key:
                    return

                targets = await self._resolve_weekly_digest_targets(
                    session,
                    normalized["target_ids"],
                )
                if not targets:
                    logger.warning("Weekly meeting digest skipped: no Telegram targets configured")
                    return

                digest_items = await self._build_weekly_digest_items(
                    session,
                    week_start=week_start,
                    week_end=week_end,
                    now_utc=now_utc,
                )
                message_text = self._render_weekly_digest_message(
                    template=normalized["template"],
                    week_start=week_start,
                    week_end=week_end,
                    items=digest_items,
                )
                if len(message_text) > 4096:
                    message_text = message_text[:4000].rstrip() + "\n\n..."

                sent_count = 0
                for target in targets:
                    try:
                        kwargs = {
                            "chat_id": int(target.chat_id),
                            "text": message_text,
                            "parse_mode": "HTML",
                        }
                        if target.thread_id:
                            kwargs["message_thread_id"] = int(target.thread_id)
                        await self.bot.send_message(**kwargs)
                        sent_count += 1
                    except Exception as e:
                        logger.error(
                            "Weekly meeting digest failed for chat=%s thread=%s: %s",
                            target.chat_id,
                            target.thread_id,
                            e,
                        )

                if sent_count == 0:
                    return

                normalized[WEEKLY_DIGEST_LAST_SENT_WEEK_START_KEY] = week_start_key
                await self.app_settings_repo.set(
                    session,
                    MEETING_WEEKLY_DIGEST_SETTINGS_KEY,
                    self._serialize_weekly_digest_settings(normalized),
                    updated_by_id=setting.updated_by_id if setting else None,
                )
                await session.commit()
                logger.info(
                    "Weekly meeting digest sent (week=%s, targets=%s, items=%s)",
                    week_start_key,
                    sent_count,
                    len(digest_items),
                )
        except Exception as e:
            logger.error("Error in _check_weekly_meeting_digest: %s", e, exc_info=True)

    async def _resolve_weekly_digest_targets(
        self,
        session,
        target_ids: list[uuid.UUID],
    ) -> list[TelegramNotificationTarget]:
        if not target_ids:
            return []
        stmt = (
            select(TelegramNotificationTarget)
            .where(
                TelegramNotificationTarget.is_active.is_(True),
                TelegramNotificationTarget.id.in_(target_ids),
            )
            .order_by(TelegramNotificationTarget.created_at.asc())
        )
        result = await session.execute(stmt)
        targets = list(result.scalars().all())
        targets_by_id = {target.id: target for target in targets}
        ordered_targets: list[TelegramNotificationTarget] = []
        for target_id in target_ids:
            target = targets_by_id.get(target_id)
            if target:
                ordered_targets.append(target)
        return ordered_targets

    async def _build_weekly_digest_items(
        self,
        session,
        *,
        week_start: date,
        week_end: date,
        now_utc: datetime,
    ) -> list[dict]:
        schedule_repo = MeetingScheduleRepository()
        schedules = await schedule_repo.get_all_active(session)

        participant_ids: list[uuid.UUID] = []
        for schedule in schedules:
            for participant_id in schedule.participant_ids or []:
                if participant_id not in participant_ids:
                    participant_ids.append(participant_id)

        members = await self._get_participants(session, participant_ids)
        mention_by_member_id: dict[uuid.UUID, str] = {}
        for member in members:
            username = (member.telegram_username or "").strip().lstrip("@")
            if username:
                mention_by_member_id[member.id] = f"@{username}"

        items: list[dict] = []
        for schedule in schedules:
            occurrence_utc = self._schedule_occurrence_for_digest_week(
                schedule,
                week_start=week_start,
                week_end=week_end,
                now_utc=now_utc,
            )
            if not occurrence_utc:
                continue

            occurrence_msk = occurrence_utc.astimezone(ZoneInfo(MEETING_DIGEST_TIMEZONE))
            participants_mentions = " ".join(
                mention_by_member_id[member_id]
                for member_id in (schedule.participant_ids or [])
                if member_id in mention_by_member_id
            )
            items.append(
                {
                    "occurrence_utc": occurrence_utc,
                    "occurrence_msk": occurrence_msk,
                    "title": html.escape((schedule.title or "").strip() or "Встреча"),
                    "participants_mentions": participants_mentions,
                }
            )

        items.sort(key=lambda item: item["occurrence_utc"])
        return items

    def _schedule_occurrence_for_digest_week(
        self,
        schedule: MeetingSchedule,
        *,
        week_start: date,
        week_end: date,
        now_utc: datetime,
    ) -> datetime | None:
        timezone = ZoneInfo(schedule.timezone or MEETING_DIGEST_TIMEZONE)

        if schedule.recurrence == "on_demand":
            if not schedule.next_occurrence_at:
                return None
            occurrence_utc = self._to_utc_aware(schedule.next_occurrence_at)
            if occurrence_utc < now_utc:
                return None
            occurrence_local_date = occurrence_utc.astimezone(timezone).date()
            if week_start <= occurrence_local_date <= week_end:
                return occurrence_utc
            return None

        if schedule.recurrence == "one_time":
            if not schedule.one_time_date:
                return None
            if schedule.last_triggered_date and schedule.last_triggered_date >= schedule.one_time_date:
                return None
            occurrence_utc = datetime.combine(
                schedule.one_time_date,
                schedule.time_utc,
                tzinfo=ZoneInfo("UTC"),
            )
            if occurrence_utc < now_utc:
                return None
            occurrence_local_date = occurrence_utc.astimezone(timezone).date()
            if week_start <= occurrence_local_date <= week_end:
                return occurrence_utc
            return None

        recurring_occurrences = self._iter_recurring_occurrences_until_week_end(
            schedule=schedule,
            now_utc=now_utc,
            week_end=week_end,
        )
        if not recurring_occurrences:
            return None

        if schedule.next_occurrence_skip and recurring_occurrences:
            recurring_occurrences = recurring_occurrences[1:]

        if schedule.next_occurrence_time_override and recurring_occurrences:
            first_occurrence = recurring_occurrences[0]
            adjusted = self._apply_time_override_for_occurrence(
                first_occurrence,
                schedule.next_occurrence_time_override,
                timezone,
            )
            recurring_occurrences[0] = adjusted
            recurring_occurrences = sorted(recurring_occurrences)
            if recurring_occurrences and recurring_occurrences[0] < now_utc:
                recurring_occurrences = recurring_occurrences[1:]

        for occurrence_utc in recurring_occurrences:
            occurrence_local_date = occurrence_utc.astimezone(timezone).date()
            if week_start <= occurrence_local_date <= week_end:
                return occurrence_utc
            if occurrence_local_date > week_end:
                break

        return None

    @staticmethod
    def _to_utc_aware(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=ZoneInfo("UTC"))
        return value.astimezone(ZoneInfo("UTC"))

    def _iter_recurring_occurrences_until_week_end(
        self,
        *,
        schedule: MeetingSchedule,
        now_utc: datetime,
        week_end: date,
    ) -> list[datetime]:
        timezone = ZoneInfo(schedule.timezone or MEETING_DIGEST_TIMEZONE)
        week_end_local_dt = datetime.combine(
            week_end,
            time(23, 59, 59),
            tzinfo=timezone,
        )
        search_end_utc_date = week_end_local_dt.astimezone(ZoneInfo("UTC")).date() + timedelta(
            days=1
        )
        cursor_utc_date = now_utc.date() - timedelta(days=1)
        occurrences: list[datetime] = []

        while cursor_utc_date <= search_end_utc_date:
            occurrence_utc = datetime.combine(
                cursor_utc_date,
                schedule.time_utc,
                tzinfo=ZoneInfo("UTC"),
            )
            if occurrence_utc < now_utc:
                cursor_utc_date += timedelta(days=1)
                continue

            if schedule.last_triggered_date and schedule.last_triggered_date >= occurrence_utc.date():
                cursor_utc_date += timedelta(days=1)
                continue

            occurrence_local = occurrence_utc.astimezone(timezone)
            if occurrence_local.isoweekday() != schedule.day_of_week:
                cursor_utc_date += timedelta(days=1)
                continue

            if schedule.recurrence == "biweekly":
                week_number = occurrence_local.isocalendar()[1]
                if week_number % 2 != 0:
                    cursor_utc_date += timedelta(days=1)
                    continue
            elif schedule.recurrence == "monthly_last_workday":
                if not self._is_last_selected_weekday_of_month(
                    occurrence_local,
                    schedule.day_of_week,
                ):
                    cursor_utc_date += timedelta(days=1)
                    continue
            elif schedule.recurrence != "weekly":
                cursor_utc_date += timedelta(days=1)
                continue

            occurrences.append(occurrence_utc)
            cursor_utc_date += timedelta(days=1)

        return occurrences

    @staticmethod
    def _apply_time_override_for_occurrence(
        occurrence_utc: datetime,
        override_time_utc: time,
        timezone: ZoneInfo,
    ) -> datetime:
        occurrence_local = occurrence_utc.astimezone(timezone)
        override_local_time = datetime.combine(
            occurrence_local.date(),
            override_time_utc,
            tzinfo=ZoneInfo("UTC"),
        ).astimezone(timezone).time()
        adjusted_local = datetime.combine(
            occurrence_local.date(),
            override_local_time,
            tzinfo=timezone,
        )
        return adjusted_local.astimezone(ZoneInfo("UTC"))

    @classmethod
    def _render_weekly_digest_message(
        cls,
        *,
        template: str,
        week_start: date,
        week_end: date,
        items: list[dict],
    ) -> str:
        safe_template = str(template or "").strip() or DEFAULT_MEETING_WEEKLY_DIGEST_TEMPLATE
        meetings_block = cls._format_weekly_digest_items_block(items)
        week_start_short = week_start.strftime("%d.%m")
        week_end_short = week_end.strftime("%d.%m")
        week_start_long = week_start.strftime("%d.%m.%Y")
        week_end_long = week_end.strftime("%d.%m.%Y")

        replacements = {
            "{week_start}": week_start_short,
            "{week_end}": week_end_short,
            "{week_start_date}": week_start_long,
            "{week_end_date}": week_end_long,
            "{meetings_count}": str(len(items)),
            "{meetings}": meetings_block,
            "{items}": meetings_block,
        }

        rendered = safe_template
        for token, value in replacements.items():
            rendered = rendered.replace(token, value)
        return rendered.strip()

    @staticmethod
    def _format_weekly_digest_items_block(items: list[dict]) -> str:
        if not items:
            return "На следующей неделе встречи не запланированы."

        blocks: list[str] = []
        for item in items:
            occurrence_msk = item["occurrence_msk"]
            weekday = RUSSIAN_WEEKDAYS_SHORT.get(occurrence_msk.isoweekday(), "")
            title = item["title"]
            mentions = item["participants_mentions"]
            lines = [f"<b>{weekday} {occurrence_msk.strftime('%H:%M')} по мск</b>", title]
            if mentions:
                lines.append(mentions)
            blocks.append("\n".join(lines))

        return "\n\n".join(blocks)

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
    def _contains_participants_placeholder(template: str) -> bool:
        template_lower = template.lower()
        return any(token in template_lower for token in REMINDER_PARTICIPANTS_PLACEHOLDERS)

    @staticmethod
    def _get_custom_reminder_template(
        reminder_templates_by_offset: dict[str, str],
        reminder_offset_minutes: int | None,
    ) -> str:
        if reminder_offset_minutes is None:
            return ""
        return str(reminder_templates_by_offset.get(str(reminder_offset_minutes), "")).strip()

    @staticmethod
    def _normalize_global_reminder_templates(value: dict | None) -> dict[str, str]:
        source: dict = {}
        if isinstance(value, dict):
            nested = value.get("texts_by_offset")
            if isinstance(nested, dict):
                source = nested
            else:
                source = value

        normalized: dict[str, str] = {}
        for raw_key, raw_text in source.items():
            try:
                offset = int(raw_key)
            except (TypeError, ValueError):
                continue
            if offset not in ALLOWED_REMINDER_OFFSETS_MINUTES:
                continue
            text = str(raw_text or "").strip()
            if text:
                normalized[str(offset)] = text
        return normalized

    async def _get_global_reminder_templates(self, session) -> dict[str, str]:
        try:
            setting = await self.app_settings_repo.get(session, MEETING_REMINDER_TEXTS_KEY)
        except Exception:
            logger.warning("Failed to load global reminder templates", exc_info=True)
            return {}
        if not setting:
            return {}
        return self._normalize_global_reminder_templates(setting.value)

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
        """Send reminders to all telegram targets."""
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

        global_templates_by_offset = await self._get_global_reminder_templates(session)
        custom_template = self._get_custom_reminder_template(
            global_templates_by_offset,
            reminder_offset_minutes=reminder_offset_minutes,
        )
        contains_zoom_placeholder = self._contains_zoom_link_placeholder(custom_template)
        contains_participants_placeholder = self._contains_participants_placeholder(
            custom_template
        )
        participants_mentions = ""
        if schedule.participant_ids:
            members = await self._get_participants(session, schedule.participant_ids)
            mentions = []
            for member in members:
                if member.telegram_username:
                    username = member.telegram_username.lstrip("@")
                    mentions.append(f"@{username}")
            participants_mentions = " ".join(mentions)

        if custom_template:
            text = self._render_custom_reminder_text(
                custom_template,
                schedule,
                meeting,
                zoom_link=safe_join_url if include_zoom_link else None,
                participants_mentions=participants_mentions,
            )
        else:
            text = self._default_reminder_text(
                schedule,
                meeting,
                reminder_offset_minutes=reminder_offset_minutes,
            )

        # Backward compatibility: old templates without participant placeholder.
        if participants_mentions and not contains_participants_placeholder:
            text += "\n\n" + participants_mentions

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
    def _default_reminder_text(
        schedule: MeetingSchedule,
        meeting: Meeting,
        reminder_offset_minutes: int | None = None,
    ) -> str:
        """Default reminder text if reminder_text is not set."""
        time_str, _, _ = MeetingSchedulerService._meeting_time_parts(schedule, meeting)
        if reminder_offset_minutes == 0:
            return (
                f"Здравствуйте! Встреча {schedule.title} начинается сейчас "
                f"({time_str} МСК)"
            )

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
        participants_mentions: str | None = None,
    ) -> str:
        """Render template placeholders for custom reminder text."""
        time_str, date_str, weekday_str = MeetingSchedulerService._meeting_time_parts(
            schedule, meeting
        )
        participants_text = participants_mentions or ""
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
            "{участники}": participants_text,
            "{юзернеймы}": participants_text,
            "{participants}": participants_text,
            "{usernames}": participants_text,
            "{participant_usernames}": participants_text,
        }
        rendered = template
        for token, value in replacements.items():
            rendered = rendered.replace(token, value)
        return rendered
