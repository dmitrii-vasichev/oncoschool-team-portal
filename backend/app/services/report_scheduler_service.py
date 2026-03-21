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
DEFAULT_SCHEDULE = {"time": "05:45", "timezone": "Europe/Moscow", "enabled": True}
CLEANUP_RETENTION_DAYS = 180
BACKFILL_PROGRESS_KEY = "backfill_progress"


class ReportSchedulerService:
    """Runs daily GetCourse data collection at a configurable time."""

    def __init__(self, bot: Bot, session_maker: async_sessionmaker) -> None:
        self.bot = bot
        self.session_maker = session_maker
        self.scheduler = AsyncIOScheduler()
        self._app_settings_repo = AppSettingsRepository()
        self._metrics_repo = DailyMetricRepository()
        self._target_repo = TelegramTargetRepository()
        self._getcourse_service = GetCourseService()
        self._collected_today: date | None = None

    def start(self) -> None:
        """Start the scheduler with collection check and cleanup jobs."""
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
                    return setting.value
        except Exception as e:
            logger.error("Failed to load report schedule: %s", e)
        return dict(DEFAULT_SCHEDULE)

    async def _check_and_collect(self) -> None:
        """Check if it's time to collect and trigger if so."""
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

            # Already collected today
            if self._collected_today == today:
                return

            # Parse configured time
            time_str = schedule.get("time", "05:45")
            try:
                parts = time_str.split(":")
                target_hour, target_minute = int(parts[0]), int(parts[1])
            except (ValueError, IndexError):
                target_hour, target_minute = 5, 45

            if now.hour != target_hour or now.minute != target_minute:
                return

            # Time to collect yesterday's data
            yesterday = today - timedelta(days=1)
            logger.info("ReportScheduler: collecting metrics for %s", yesterday)

            async with self.session_maker() as session:
                async with session.begin():
                    metric = await self._getcourse_service.collect_metrics(
                        session, yesterday
                    )

            self._collected_today = today
            logger.info("ReportScheduler: collection completed for %s", yesterday)

            # Send notification
            await self._send_report_notification(metric, yesterday)

        except Exception as e:
            logger.error("ReportScheduler: collection failed: %s", e)

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
        """Background backfill: collect metrics for each date in range."""
        import asyncio

        total = (date_to - date_from).days + 1
        collected = 0
        skipped = 0
        failed = 0

        logger.info("Backfill started: %s to %s (%d dates)", date_from, date_to, total)

        for i in range(total):
            current_date = date_from + timedelta(days=i)
            try:
                async with self.session_maker() as session:
                    existing = await self._metrics_repo.get_by_date(
                        session, "getcourse", current_date
                    )
                    if existing:
                        skipped += 1
                        continue

                async with self.session_maker() as session:
                    async with session.begin():
                        await self._getcourse_service.collect_metrics(
                            session, current_date, collected_by_id
                        )
                collected += 1
                logger.info("Backfill: collected %s (%d/%d)", current_date, i + 1, total)

                # Rate limit: 5 second pause between dates
                await asyncio.sleep(5)

            except Exception as e:
                failed += 1
                logger.error("Backfill: failed for %s: %s", current_date, e)
                # On rate limit, wait longer before next attempt
                if "много запросов" in str(e).lower() or "rate" in str(e).lower():
                    logger.info("Rate limited, waiting 30s before next date")
                    await asyncio.sleep(30)

        # Save progress to app_settings
        try:
            async with self.session_maker() as session:
                async with session.begin():
                    await self._app_settings_repo.set(
                        session,
                        BACKFILL_PROGRESS_KEY,
                        {
                            "status": "completed",
                            "total_dates": total,
                            "collected": collected,
                            "skipped": skipped,
                            "failed": failed,
                            "completed_at": datetime.now(tz=ZoneInfo("UTC")).isoformat(),
                        },
                    )
        except Exception as e:
            logger.error("Failed to save backfill progress: %s", e)

        logger.info(
            "Backfill completed: total=%d, collected=%d, skipped=%d, failed=%d",
            total, collected, skipped, failed,
        )
