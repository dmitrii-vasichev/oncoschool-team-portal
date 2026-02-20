import logging
from datetime import date, datetime, timedelta
from pathlib import Path

from aiogram import Bot
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from app.bot.callbacks import (
    ALL_DEPARTMENTS_TOKEN,
    TaskListCallback,
    TaskListFilter,
    TaskListScope,
)
from app.db.models import ReminderSettings, Task, TeamMember
from app.db.repositories import (
    NotificationSubscriptionRepository,
    ReminderSettingsRepository,
    TaskRepository,
)
from app.services.in_app_notification_service import InAppNotificationService

logger = logging.getLogger(__name__)

DAYS_RU = {1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб", 7: "Вс"}


class ReminderService:
    """Daily digest reminders via APScheduler."""

    def __init__(self, bot: Bot, session_maker: async_sessionmaker):
        self.bot = bot
        self.session_maker = session_maker
        self.scheduler = AsyncIOScheduler()
        self.reminder_repo = ReminderSettingsRepository()
        self.task_repo = TaskRepository()
        self.sub_repo = NotificationSubscriptionRepository()
        self.in_app_notifications = InAppNotificationService()
        # Track which members got digest today (member_id -> date)
        self._sent_today: dict[str, date] = {}

    def start(self) -> None:
        """Start the scheduler with periodic checks."""
        if self.scheduler.running:
            logger.info("ReminderService already running")
            return

        # Check every minute for reminders to send
        self.scheduler.add_job(
            self._check_and_send_reminders,
            "interval",
            minutes=1,
            id="check_reminders",
            replace_existing=True,
        )
        # Check overdue tasks every hour
        self.scheduler.add_job(
            self._check_overdue_tasks,
            "interval",
            hours=1,
            id="check_overdue",
            replace_existing=True,
        )
        # Create in-app alerts for deadline today/tomorrow and overdue transitions
        self.scheduler.add_job(
            self._check_in_app_deadlines,
            "interval",
            hours=1,
            id="check_in_app_deadlines",
            replace_existing=True,
        )
        # Cleanup orphan avatar files daily at 3 AM
        self.scheduler.add_job(
            self._cleanup_orphan_avatars,
            "cron",
            hour=3,
            id="cleanup_avatars",
            replace_existing=True,
        )
        self.scheduler.start()
        logger.info("ReminderService scheduler started")

    def stop(self) -> None:
        """Stop the scheduler."""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("ReminderService scheduler stopped")

    async def _check_and_send_reminders(self) -> None:
        """Check all enabled reminders and send if time matches."""
        try:
            async with self.session_maker() as session:
                enabled = await self.reminder_repo.get_all_enabled(session)

                for rs in enabled:
                    try:
                        await self._maybe_send_digest(session, rs)
                    except Exception as e:
                        logger.error(
                            f"Error processing reminder for member {rs.member_id}: {e}"
                        )
        except Exception as e:
            logger.error(f"Error in _check_and_send_reminders: {e}")

    async def _maybe_send_digest(
        self, session: AsyncSession, rs: ReminderSettings
    ) -> None:
        """Send digest if current time/day matches settings."""
        import zoneinfo

        try:
            tz = zoneinfo.ZoneInfo(rs.timezone)
        except Exception:
            tz = zoneinfo.ZoneInfo("Europe/Moscow")

        now = datetime.now(tz)
        today = now.date()

        # Check if already sent today
        key = str(rs.member_id)
        if self._sent_today.get(key) == today:
            return

        # Check day of week (1=Mon..7=Sun; isoweekday() returns 1-7)
        if now.isoweekday() not in (rs.days_of_week or [1, 2, 3, 4, 5]):
            return

        # Check time (match hour and minute)
        if now.hour != rs.reminder_time.hour or now.minute != rs.reminder_time.minute:
            return

        # Time to send!
        member = rs.member
        if not member or not member.telegram_id:
            return

        await self._send_daily_digest(session, member, rs, today)
        self._sent_today[key] = today

        # Cleanup old entries
        self._sent_today = {
            k: v for k, v in self._sent_today.items() if v >= today
        }

    async def _send_daily_digest(
        self,
        session: AsyncSession,
        member: TeamMember,
        rs: ReminderSettings,
        today: date | None = None,
    ) -> None:
        """Build and send formatted daily digest."""
        if today is None:
            today = date.today()

        # Get all tasks for this member
        all_tasks = await self.task_repo.get_by_assignee(session, member.id)
        active_tasks = [t for t in all_tasks if t.status not in ("done", "cancelled")]

        digest_markup = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(
                text="📋 Открыть мои задачи",
                callback_data=TaskListCallback(
                    scope=TaskListScope.MY,
                    task_filter=TaskListFilter.ALL,
                    page=1,
                    department_token=ALL_DEPARTMENTS_TOKEN,
                ).pack(),
            )
        ]])

        if not active_tasks:
            text = (
                f"📊 Ежедневный дайджест — {today.strftime('%d.%m.%Y')}\n\n"
                "У тебя нет активных задач. Отличная работа! 🎉"
            )
            await self._send_safe(member.telegram_id, text, digest_markup)
            return

        sections = []
        sections.append(f"📊 Ежедневный дайджест — {today.strftime('%d.%m.%Y')}")

        # Overdue tasks
        if rs.include_overdue:
            overdue = [
                t for t in active_tasks
                if t.deadline and t.deadline < today
            ]
            if overdue:
                lines = ["\n🔴 Просроченные ({}):" .format(len(overdue))]
                for t in overdue:
                    dl = t.deadline.strftime("%d.%m") if t.deadline else ""
                    lines.append(f"  #{t.short_id} · {t.title} · 📅 был {dl} · ⚡ {t.priority}")
                sections.append("\n".join(lines))

        # Upcoming tasks (next 3 days)
        if rs.include_upcoming:
            upcoming_end = today + timedelta(days=3)
            upcoming = [
                t for t in active_tasks
                if t.deadline and today <= t.deadline <= upcoming_end
            ]
            if upcoming:
                lines = ["\n📅 Ближайшие (3 дня):"]
                for t in upcoming:
                    dl = t.deadline.strftime("%d.%m") if t.deadline else ""
                    lines.append(f"  #{t.short_id} · {t.title} · 📅 {dl} · ⚡ {t.priority}")
                sections.append("\n".join(lines))

        # In progress
        if rs.include_in_progress:
            in_progress = [t for t in active_tasks if t.status == "in_progress"]
            if in_progress:
                lines = ["\n🔄 В работе ({}):" .format(len(in_progress))]
                for t in in_progress:
                    lines.append(f"  #{t.short_id} · {t.title} · ⚡ {t.priority}")
                sections.append("\n".join(lines))

        # New tasks
        if rs.include_new:
            new_tasks = [t for t in active_tasks if t.status == "new"]
            if new_tasks:
                lines = ["\n🆕 Новые ({}):" .format(len(new_tasks))]
                for t in new_tasks:
                    lines.append(f"  #{t.short_id} · {t.title} · ⚡ {t.priority}")
                sections.append("\n".join(lines))

        # Completed yesterday
        yesterday = today - timedelta(days=1)
        completed_yesterday = [
            t for t in all_tasks
            if t.status == "done"
            and t.completed_at
            and t.completed_at.date() == yesterday
        ]
        total = len(active_tasks)
        done_count = len(completed_yesterday)

        sections.append(f"\nВсего активных: {total} | Завершено вчера: {done_count} 💪")

        text = "\n".join(sections)
        await self._send_safe(member.telegram_id, text, digest_markup)

    async def _check_overdue_tasks(self) -> None:
        """Notify subscribers about overdue tasks (hourly check)."""
        try:
            async with self.session_maker() as session:
                today = date.today()

                # Get overdue tasks
                stmt = (
                    select(Task)
                    .options(selectinload(Task.assignee))
                    .where(
                        Task.deadline < today,
                        Task.status.notin_(["done", "cancelled"]),
                    )
                )
                result = await session.execute(stmt)
                overdue_tasks = list(result.scalars().all())

                if not overdue_tasks:
                    return

                # Notify subscribers of task_overdue
                subs = await self.sub_repo.get_active_by_event(session, "task_overdue")
                if not subs:
                    return

                # Build summary
                lines = [f"⏰ Просроченные задачи ({len(overdue_tasks)}):"]
                for t in overdue_tasks[:15]:  # Limit to 15
                    assignee_name = t.assignee.full_name if t.assignee else "—"
                    dl = t.deadline.strftime("%d.%m") if t.deadline else ""
                    lines.append(
                        f"  #{t.short_id} · {t.title} · 👤 {assignee_name} · 📅 {dl}"
                    )
                if len(overdue_tasks) > 15:
                    lines.append(f"  ... и ещё {len(overdue_tasks) - 15}")

                text = "\n".join(lines)

                for sub in subs:
                    member = sub.member
                    if member and member.telegram_id:
                        await self._send_safe(member.telegram_id, text)

        except Exception as e:
            logger.error(f"Error in _check_overdue_tasks: {e}")

    async def _check_in_app_deadlines(self) -> None:
        """Create in-app notifications for deadline-related task events."""
        try:
            async with self.session_maker() as session:
                await self.in_app_notifications.create_deadline_notifications(session)
                await session.commit()
        except Exception as e:
            logger.error(f"Error in _check_in_app_deadlines: {e}")

    async def _cleanup_orphan_avatars(self) -> None:
        """Remove avatar files that don't belong to any active member (daily)."""
        try:
            from app.db.repositories import TeamMemberRepository

            avatar_dir = Path(__file__).resolve().parents[2] / "static" / "avatars"
            if not avatar_dir.exists():
                return

            async with self.session_maker() as session:
                member_repo = TeamMemberRepository()
                members = await member_repo.get_all_active(session)
                valid_ids = {str(m.id) for m in members}

            removed = 0
            for f in avatar_dir.iterdir():
                if not f.is_file() or f.name == ".gitkeep":
                    continue
                # Extract member UUID from filename (e.g. "uuid.webp" or "uuid_tg.webp")
                stem = f.stem.replace("_tg", "")
                if stem not in valid_ids:
                    f.unlink()
                    removed += 1

            if removed:
                logger.info("Avatar cleanup: removed %d orphan files", removed)

        except Exception as e:
            logger.error(f"Error in _cleanup_orphan_avatars: {e}")

    async def _send_safe(
        self, chat_id: int, text: str, reply_markup: InlineKeyboardMarkup | None = None
    ) -> None:
        """Send message, suppress errors."""
        try:
            await self.bot.send_message(chat_id, text, reply_markup=reply_markup)
        except Exception as e:
            logger.warning(f"Failed to send reminder to {chat_id}: {e}")
