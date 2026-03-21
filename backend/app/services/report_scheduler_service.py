"""ReportSchedulerService — daily GetCourse data collection and cleanup via APScheduler."""

import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from aiogram import Bot
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.config import settings
from app.db.repositories import (
    AppSettingsRepository,
    DailyMetricRepository,
    TelegramTargetRepository,
)
from app.services.getcourse_service import GetCourseService

logger = logging.getLogger(__name__)

REPORT_SCHEDULE_KEY = "report_schedule"
DEFAULT_SCHEDULE = {
    "collection_time": "05:45",
    "send_time": "06:30",
    "timezone": "Europe/Moscow",
    "enabled": True,
}
CLEANUP_RETENTION_DAYS = 180
BACKFILL_PROGRESS_KEY = "backfill_progress"


class ReportSchedulerService:
    """Runs daily GetCourse data collection and sends report at separate times."""

    def __init__(self, bot: Bot, session_maker: async_sessionmaker) -> None:
        self.bot = bot
        self.session_maker = session_maker
        self.scheduler = AsyncIOScheduler()
        self._app_settings_repo = AppSettingsRepository()
        self._metrics_repo = DailyMetricRepository()
        self._target_repo = TelegramTargetRepository()
        self._getcourse_service = GetCourseService()
        self._collected_today: date | None = None
        self._sent_today: date | None = None
        self._last_collected_metric = None
        self._last_collected_date: date | None = None

    def start(self) -> None:
        """Start the scheduler with collection check, send check and cleanup jobs."""
        if self.scheduler.running:
            logger.info("ReportSchedulerService already running")
            return

        self.scheduler.add_job(
            self._check_and_collect,
            "interval",
            minutes=1,
            id="report_check_and_collect",
            replace_existing=True,
        )
        self.scheduler.add_job(
            self._check_and_send,
            "interval",
            minutes=1,
            id="report_check_and_send",
            replace_existing=True,
        )
        self.scheduler.add_job(
            self._cleanup_old_metrics,
            "cron",
            hour=3,
            minute=0,
            id="report_cleanup",
            replace_existing=True,
        )
        self.scheduler.start()
        logger.info("ReportSchedulerService scheduler started")

    def stop(self) -> None:
        """Stop the scheduler."""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("ReportSchedulerService scheduler stopped")

    async def reschedule(self) -> None:
        """Reload settings — called after schedule update via API."""
        logger.info("ReportSchedulerService: schedule reloaded (settings updated)")

    async def _get_schedule(self) -> dict:
        """Load schedule settings from app_settings."""
        try:
            async with self.session_maker() as session:
                setting = await self._app_settings_repo.get(session, REPORT_SCHEDULE_KEY)
                if setting and isinstance(setting.value, dict):
                    val = setting.value
                    # Migrate legacy single 'time' field
                    if "collection_time" not in val:
                        old_time = val.get("time", "05:45")
                        return {
                            "collection_time": old_time,
                            "send_time": "06:30",
                            "timezone": val.get("timezone", "Europe/Moscow"),
                            "enabled": val.get("enabled", True),
                        }
                    return val
        except Exception as e:
            logger.error("Failed to load report schedule: %s", e)
        return dict(DEFAULT_SCHEDULE)

    @staticmethod
    def _parse_time(time_str: str, default_h: int = 5, default_m: int = 45) -> tuple[int, int]:
        """Parse 'HH:MM' string into (hour, minute) tuple."""
        try:
            parts = time_str.split(":")
            return int(parts[0]), int(parts[1])
        except (ValueError, IndexError, AttributeError):
            return default_h, default_m

    async def _check_and_collect(self) -> None:
        """Check if it's collection_time and trigger data collection."""
        try:
            schedule = await self._get_schedule()

            if not schedule.get("enabled", True):
                return

            tz_name = schedule.get("timezone", "Europe/Moscow")
            try:
                tz = ZoneInfo(tz_name)
            except Exception:
                tz = ZoneInfo("Europe/Moscow")

            now = datetime.now(tz)
            today = now.date()

            if self._collected_today == today:
                return

            target_hour, target_minute = self._parse_time(
                schedule.get("collection_time", "05:45"), 5, 45
            )

            if now.hour != target_hour or now.minute != target_minute:
                return

            yesterday = today - timedelta(days=1)
            logger.info("ReportScheduler: collecting metrics for %s", yesterday)

            metric = await self._getcourse_service.collect_metrics(
                self.session_maker, yesterday
            )

            self._collected_today = today
            self._last_collected_metric = metric
            self._last_collected_date = yesterday
            logger.info("ReportScheduler: collection completed for %s", yesterday)

        except Exception as e:
            logger.error("ReportScheduler: collection failed: %s", e)

    async def _check_and_send(self) -> None:
        """Check if it's send_time and send the report notification.

        If collection hasn't finished yet, wait — the notification will be
        sent as soon as collection completes (checked every minute).
        """
        try:
            schedule = await self._get_schedule()

            if not schedule.get("enabled", True):
                return

            tz_name = schedule.get("timezone", "Europe/Moscow")
            try:
                tz = ZoneInfo(tz_name)
            except Exception:
                tz = ZoneInfo("Europe/Moscow")

            now = datetime.now(tz)
            today = now.date()

            # Already sent today
            if self._sent_today == today:
                return

            target_hour, target_minute = self._parse_time(
                schedule.get("send_time", "06:30"), 6, 30
            )

            # Not yet send_time
            if now.hour < target_hour or (now.hour == target_hour and now.minute < target_minute):
                return

            # send_time has arrived (or passed) — but collection must be done first
            if self._collected_today != today:
                # Collection hasn't completed yet — wait for it
                return

            # Collection done, send the report
            metric = self._last_collected_metric
            target_date = self._last_collected_date

            if metric is None or target_date is None:
                # Fallback: read from DB
                yesterday = today - timedelta(days=1)
                async with self.session_maker() as session:
                    metric = await self._metrics_repo.get_by_date(
                        session, "getcourse", yesterday
                    )
                target_date = yesterday
                if metric is None:
                    logger.warning("ReportScheduler: no metric found for %s, skipping send", yesterday)
                    self._sent_today = today
                    return

            await self._send_report_notification(metric, target_date)
            self._sent_today = today
            self._last_collected_metric = None
            self._last_collected_date = None
            logger.info("ReportScheduler: report sent for %s", target_date)

        except Exception as e:
            logger.error("ReportScheduler: send failed: %s", e)

    async def _send_report_notification(
        self, metric, target_date: date
    ) -> None:
        """Format and send Telegram notification with metrics and deltas."""
        try:
            # Get previous day metric for delta
            prev_date = target_date - timedelta(days=1)
            prev_metric = None
            async with self.session_maker() as session:
                prev_metric = await self._metrics_repo.get_by_date(
                    session, "getcourse", prev_date
                )

            text = self._format_report_message(metric, prev_metric, target_date)
            markup = InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(
                    text="\U0001f4ca Открыть дашборд",
                    url=f"{settings.NEXT_PUBLIC_FRONTEND_URL}/reports",
                )
            ]])

            async with self.session_maker() as session:
                targets = await self._target_repo.get_active_by_type(
                    session, "report:getcourse"
                )

            for target in targets:
                try:
                    await self.bot.send_message(
                        chat_id=target.chat_id,
                        text=text,
                        reply_markup=markup,
                        message_thread_id=target.thread_id,
                    )
                except Exception as e:
                    logger.warning(
                        "Failed to send report to chat %s: %s", target.chat_id, e
                    )

        except Exception as e:
            logger.error("Failed to send report notification: %s", e)

    @staticmethod
    def _format_report_message(metric, prev_metric, target_date: date) -> str:
        """Format the report notification message."""

        def delta_arrow(current: int | Decimal, previous: int | Decimal | None) -> str:
            if previous is None:
                return ""
            diff = current - previous
            if diff > 0:
                return f" \u2191{diff}"
            elif diff < 0:
                return f" \u2193{abs(diff)}"
            return " \u2192"

        def money_fmt(value: Decimal) -> str:
            return f"{value:,.0f}\u20bd".replace(",", " ")

        date_str = target_date.strftime("%d.%m.%Y")
        prev = prev_metric

        lines = [
            f"\U0001f4ca \u041e\u0442\u0447\u0451\u0442 GetCourse \u0437\u0430 {date_str}",
            "",
            f"\U0001f464 \u041d\u043e\u0432\u044b\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438: {metric.users_count}{delta_arrow(metric.users_count, prev.users_count if prev else None)}",
            f"\U0001f4b3 \u041f\u043b\u0430\u0442\u0435\u0436\u0438: {metric.payments_count} \u043d\u0430 {money_fmt(metric.payments_sum)}{delta_arrow(metric.payments_sum, prev.payments_sum if prev else None)}",
            f"\U0001f4e6 \u0417\u0430\u043a\u0430\u0437\u044b: {metric.orders_count} \u043d\u0430 {money_fmt(metric.orders_sum)}{delta_arrow(metric.orders_sum, prev.orders_sum if prev else None)}",
        ]

        return "\n".join(lines)

    async def _cleanup_old_metrics(self) -> None:
        """Delete metrics older than retention period."""
        try:
            cutoff = date.today() - timedelta(days=CLEANUP_RETENTION_DAYS)
            async with self.session_maker() as session:
                async with session.begin():
                    count = await self._metrics_repo.delete_older_than(
                        session, "getcourse", cutoff
                    )
            if count:
                logger.info("Report cleanup: deleted %d metrics older than %s", count, cutoff)
        except Exception as e:
            logger.error("Report cleanup failed: %s", e)

    async def run_backfill(
        self, date_from: date, date_to: date, collected_by_id=None
    ) -> None:
        """Background backfill: collect metrics for the entire date range.

        Uses range-based collection — only 3 API requests to GetCourse
        (users, payments, deals) for the whole period, then groups by date.
        """
        total = (date_to - date_from).days + 1
        collected = 0
        failed = 0
        error_message = None

        logger.info("Backfill started: %s to %s (%d dates)", date_from, date_to, total)

        # Save "running" status at the start
        try:
            async with self.session_maker() as session:
                async with session.begin():
                    await self._app_settings_repo.set(
                        session,
                        BACKFILL_PROGRESS_KEY,
                        {
                            "status": "running",
                            "total_dates": total,
                            "collected": 0,
                            "failed": 0,
                            "date_from": date_from.isoformat(),
                            "date_to": date_to.isoformat(),
                            "started_at": datetime.now(tz=ZoneInfo("UTC")).isoformat(),
                        },
                    )
        except Exception as e:
            logger.error("Failed to save backfill start progress: %s", e)

        try:
            result = await self._getcourse_service.collect_metrics_range(
                self.session_maker, date_from, date_to, collected_by_id
            )
            collected = result["collected"]
        except Exception as e:
            failed = total
            error_message = str(e)
            logger.error("Backfill failed: %s", e)

        # Save final status
        try:
            async with self.session_maker() as session:
                async with session.begin():
                    await self._app_settings_repo.set(
                        session,
                        BACKFILL_PROGRESS_KEY,
                        {
                            "status": "completed" if failed == 0 else "failed",
                            "total_dates": total,
                            "collected": collected,
                            "failed": failed,
                            "date_from": date_from.isoformat(),
                            "date_to": date_to.isoformat(),
                            "completed_at": datetime.now(tz=ZoneInfo("UTC")).isoformat(),
                            "error": error_message,
                        },
                    )
        except Exception as e:
            logger.error("Failed to save backfill progress: %s", e)

        logger.info(
            "Backfill completed: total=%d, collected=%d, failed=%d",
            total, collected, failed,
        )
