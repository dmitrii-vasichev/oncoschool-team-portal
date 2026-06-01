import logging
import re
from collections import Counter
from datetime import date, datetime, time, timedelta, timezone
from html import escape
from pathlib import Path
from zoneinfo import ZoneInfo

from aiogram import Bot
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from app.bot.callbacks import (
    ALL_DEPARTMENTS_TOKEN,
    TaskCardCallback,
    TaskListCallback,
    TaskListFilter,
    TaskListScope,
)
from app.bot.handlers.escalation import build_escalation_dm_text
from app.bot.keyboards import (
    build_pulse_reaction_keyboard,
    build_pulse_task_action_rows,
    escalation_actions_keyboard,
)
from app.config import settings
from app.db.models import ActivityEvent, ReminderSettings, Task, TeamMember
from app.db.repositories import (
    AppSettingsRepository,
    NotificationSubscriptionRepository,
    ReminderSettingsRepository,
    TaskRepository,
)
from app.services.activity_service import ActivityService
from app.services.in_app_notification_service import InAppNotificationService
from app.services.notification_service import NotificationService
from app.services.permission_service import PermissionService
from app.services.pulse_digest import (
    build_company_digest,
    build_personal_pulse_text,
)
from app.services.task_urgency import is_task_urgent

logger = logging.getLogger(__name__)

DAYS_RU = {1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб", 7: "Вс"}
TASK_STATUS_LABELS = {
    "new": "Новая",
    "in_progress": "В работе",
    "review": "На согласовании",
    "done": "Готово",
    "cancelled": "Отменена",
}
TASK_OVERDUE_NOTIFICATIONS_KEY = "task_overdue_notifications"
DEFAULT_TASK_OVERDUE_INTERVAL_HOURS = 1
DEFAULT_TASK_OVERDUE_DAILY_TIME_MSK = "09:00"
ALLOWED_TASK_OVERDUE_INTERVAL_HOURS = {1, 24}
DIGEST_SECTION_ORDER_DEFAULT = ("overdue", "upcoming", "in_progress", "new")
ALLOWED_DIGEST_SECTION_KEYS = set(DIGEST_SECTION_ORDER_DEFAULT)
TASK_LINE_FIELD_ORDER_DEFAULT = ("number", "title", "deadline", "priority")
ALLOWED_TASK_LINE_FIELD_KEYS = set(TASK_LINE_FIELD_ORDER_DEFAULT)
OVERDUE_REPORT_TOP_ASSIGNEES = 5
OVERDUE_REPORT_TOP_TASKS = 5

# Long-overdue escalation thresholds (code constants, not app_settings).
OVERDUE_ESCALATION_DAYS = 30
OVERDUE_ESCALATION_REPEAT_DAYS = 7
OVERDUE_AUTOCANCEL_DAYS = 60

# app_settings key holding the company Pulse digest target chat:
# {"chat_id": int, "thread_id": int | None}.
PULSE_CHAT_KEY = "pulse_chat_id"


def normalize_digest_sections_order(value: object | None) -> list[str]:
    """Normalize digest section order to known keys with deterministic fallback."""
    if not isinstance(value, (list, tuple)):
        return list(DIGEST_SECTION_ORDER_DEFAULT)

    ordered: list[str] = []
    seen: set[str] = set()
    for raw_key in value:
        if not isinstance(raw_key, str):
            continue
        key = raw_key.strip()
        if key not in ALLOWED_DIGEST_SECTION_KEYS or key in seen:
            continue
        ordered.append(key)
        seen.add(key)

    for key in DIGEST_SECTION_ORDER_DEFAULT:
        if key not in seen:
            ordered.append(key)

    return ordered


def normalize_task_line_fields_order(value: object | None) -> list[str]:
    """Normalize digest task line fields order to known keys with fallback."""
    if not isinstance(value, (list, tuple)):
        return list(TASK_LINE_FIELD_ORDER_DEFAULT)

    ordered: list[str] = []
    seen: set[str] = set()
    for raw_key in value:
        if not isinstance(raw_key, str):
            continue
        key = raw_key.strip()
        if key not in ALLOWED_TASK_LINE_FIELD_KEYS or key in seen:
            continue
        ordered.append(key)
        seen.add(key)

    for key in TASK_LINE_FIELD_ORDER_DEFAULT:
        if key not in seen:
            ordered.append(key)

    return ordered


def normalize_upcoming_days(value: object | None) -> int:
    """Normalize upcoming deadline window to supported range [0, 7]."""
    try:
        days = int(value) if value is not None else 3
    except (TypeError, ValueError):
        return 3
    return max(0, min(days, 7))


def _task_deadline(task: Task) -> date | None:
    value = getattr(task, "deadline", None)
    return value if isinstance(value, date) else None


def _task_title(task: Task) -> str:
    title = str(getattr(task, "title", "") or "").strip()
    return title or "Без названия"


def _task_assignee_name(task: Task) -> str:
    assignee = getattr(task, "assignee", None)
    full_name = str(getattr(assignee, "full_name", "") or "").strip()
    return full_name or "Не назначен"


def _days_overdue(task: Task, today: date) -> int:
    deadline = _task_deadline(task)
    if deadline is None:
        return 0
    return max(0, (today - deadline).days)


def _format_ru_count(value: int, forms: tuple[str, str, str]) -> str:
    last_two = value % 100
    last_one = value % 10
    if 11 <= last_two <= 14:
        form = forms[2]
    elif last_one == 1:
        form = forms[0]
    elif 2 <= last_one <= 4:
        form = forms[1]
    else:
        form = forms[2]
    return f"{value} {form}"


def build_close_candidates_section(tasks: list[Task], today: date) -> str | None:
    """Build the per-user 'close candidates' digest block (Task 14).

    Tasks are those the member is assignee or author of, overdue 14+ days and
    not done/cancelled (caller is responsible for the query). Returns None when
    the list is empty, otherwise an HTML block. Titles are HTML-escaped.
    """
    if not tasks:
        return None

    lines = ["\n🧹 <b>Кандидаты на закрытие (≥14 дней без движения):</b>"]
    for task in tasks:
        days = _days_overdue(task, today)
        overdue_age = _format_ru_count(days, ("день", "дня", "дней"))
        lines.append(
            f"#{task.short_id} {escape(_task_title(task))} — {overdue_age}"
        )
    lines.append("Проверь — может уже сделано или больше не актуально.")
    return "\n".join(lines)


def build_moderator_escalation_block(
    stuck_tasks: list[Task],
    autocancelled_tasks: list[Task],
    today: date,
) -> str | None:
    """Build the moderator 'needs decision' digest block (Task 15).

    Returns None when both lists are empty. Stuck tasks are 30+ days overdue
    with an escalation DM already sent; auto-cancelled tasks were cancelled by
    the auto-inactivity job today. Titles and assignee names are HTML-escaped.
    """
    if not stuck_tasks and not autocancelled_tasks:
        return None

    lines = ["\n👁 <b>Контроль: задачи, требующие решения</b>"]
    if stuck_tasks:
        lines.append("≥30 дней без реакции:")
        for task in stuck_tasks:
            days = _days_overdue(task, today)
            overdue_age = _format_ru_count(days, ("день", "дня", "дней"))
            assignee_name = escape(_task_assignee_name(task))
            lines.append(f"  #{task.short_id} @{assignee_name} — {overdue_age}")
    if autocancelled_tasks:
        lines.append("Авто-отменено за сегодня (≥60 дней):")
        for task in autocancelled_tasks:
            lines.append(f"  #{task.short_id} — «{escape(_task_title(task))}»")
    return "\n".join(lines)


def _overdue_task_sort_key(task: Task, today: date) -> tuple[int, date, str]:
    deadline = _task_deadline(task)
    return (
        -_days_overdue(task, today),
        deadline or date.max,
        _task_title(task).casefold(),
    )


def build_overdue_tasks_report_text(
    overdue_tasks: list[Task],
    *,
    today: date | None = None,
) -> str:
    """Build a readable Telegram report for overdue task subscriptions."""
    report_date = today or date.today()
    tasks = [task for task in overdue_tasks if _days_overdue(task, report_date) > 0]

    lines = [f"⏰ Просроченные задачи: {len(tasks)}"]
    if not tasks:
        return "\n".join(lines)

    more_than_week = sum(1 for task in tasks if _days_overdue(task, report_date) > 7)
    three_to_seven = sum(
        1 for task in tasks if 3 <= _days_overdue(task, report_date) <= 7
    )
    one_to_two = sum(1 for task in tasks if 1 <= _days_overdue(task, report_date) <= 2)

    lines.extend([
        "",
        "По давности:",
        f"🔴 Больше 7 дней: {more_than_week}",
        f"🟠 3-7 дней: {three_to_seven}",
        f"🟡 1-2 дня: {one_to_two}",
        "",
        "По ответственным:",
    ])

    assignee_counts = Counter(_task_assignee_name(task) for task in tasks)
    assignee_rows = sorted(
        assignee_counts.items(),
        key=lambda item: (-item[1], item[0] == "Не назначен", item[0].casefold()),
    )
    for assignee_name, count in assignee_rows[:OVERDUE_REPORT_TOP_ASSIGNEES]:
        lines.append(f"👤 {assignee_name} — {count}")
    if len(assignee_rows) > OVERDUE_REPORT_TOP_ASSIGNEES:
        hidden = len(assignee_rows) - OVERDUE_REPORT_TOP_ASSIGNEES
        hidden_text = _format_ru_count(
            hidden,
            ("исполнитель", "исполнителя", "исполнителей"),
        )
        lines.append(f"... и ещё {hidden_text}")

    lines.extend(["", "Давно просрочены:"])
    sorted_tasks = sorted(
        tasks,
        key=lambda task: _overdue_task_sort_key(task, report_date),
    )
    for index, task in enumerate(sorted_tasks[:OVERDUE_REPORT_TOP_TASKS], start=1):
        deadline = _task_deadline(task)
        days = _days_overdue(task, report_date)
        overdue_age = _format_ru_count(days, ("день", "дня", "дней"))
        deadline_text = deadline.strftime("%d.%m") if deadline else "—"
        lines.extend([
            "",
            f"{index}. {_task_title(task)}",
            f"👤 {_task_assignee_name(task)}",
            f"📅 {deadline_text} · просрочено на {overdue_age}",
        ])

    if len(sorted_tasks) > OVERDUE_REPORT_TOP_TASKS:
        shown_count = OVERDUE_REPORT_TOP_TASKS
        total_count = len(sorted_tasks)
        lines.extend([
            "",
            f"Показаны {shown_count} самых давних из {total_count}.",
        ])

    return "\n".join(lines)


def build_overdue_tasks_report_keyboard() -> InlineKeyboardMarkup:
    """Build the action keyboard for the overdue task subscription report."""
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="📋 Показать все просроченные",
            callback_data=TaskListCallback(
                scope=TaskListScope.TEAM,
                task_filter=TaskListFilter.OVERDUE,
                page=1,
                department_token=ALL_DEPARTMENTS_TOKEN,
            ).pack(),
        )
    ]])


class ReminderService:
    """Daily digest reminders via APScheduler."""

    def __init__(self, bot: Bot, session_maker: async_sessionmaker):
        self.bot = bot
        self.session_maker = session_maker
        self.scheduler = AsyncIOScheduler()
        self.reminder_repo = ReminderSettingsRepository()
        self.task_repo = TaskRepository()
        self.sub_repo = NotificationSubscriptionRepository()
        self.app_settings_repo = AppSettingsRepository()
        self.in_app_notifications = InAppNotificationService()
        self.activity_service = ActivityService()
        self._task_overdue_interval_hours = DEFAULT_TASK_OVERDUE_INTERVAL_HOURS
        self._task_overdue_daily_time_msk = DEFAULT_TASK_OVERDUE_DAILY_TIME_MSK
        # Track which members got digest today (member_id -> date)
        self._sent_today: dict[str, date] = {}
        # Guard against double-posting the company Pulse digest on the same day
        # (e.g. scheduler restart). Stores the local date of the last send.
        self._company_digest_sent_on: date | None = None

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
        # Check one-off task reminders every minute
        self.scheduler.add_job(
            self._check_task_reminders,
            "interval",
            minutes=1,
            id="check_task_reminders",
            replace_existing=True,
        )
        # Check overdue tasks by configured interval.
        self.set_task_overdue_schedule(
            DEFAULT_TASK_OVERDUE_INTERVAL_HOURS,
            DEFAULT_TASK_OVERDUE_DAILY_TIME_MSK,
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
        # Escalation DMs for tasks 30+ days overdue (daily at 09:00).
        self.scheduler.add_job(
            self._check_and_send_escalation_dms,
            "cron",
            hour=9,
            minute=0,
            id="escalation_dms",
            replace_existing=True,
        )
        # Auto-cancel tasks 60+ days overdue and inactive (daily at 03:00).
        self.scheduler.add_job(
            self._daily_autocancel_job,
            "cron",
            hour=3,
            minute=0,
            id="autocancel_inactive_tasks",
            replace_existing=True,
        )
        # Post the company Pulse digest of yesterday's activity (daily at 09:05).
        self.scheduler.add_job(
            self._send_company_pulse_digest,
            "cron",
            hour=9,
            minute=5,
            id="pulse_company_digest",
            replace_existing=True,
        )
        # Monthly recognition milestones (1st of month, 09:10).
        self.scheduler.add_job(
            self._monthly_milestones_job,
            "cron",
            day=1, hour=9, minute=10,
            id="monthly_milestones",
            replace_existing=True,
        )
        self.scheduler.start()
        logger.info("ReminderService scheduler started")

    def stop(self) -> None:
        """Stop the scheduler."""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("ReminderService scheduler stopped")

    @staticmethod
    def normalize_task_overdue_interval_hours(value: object | None) -> int:
        """Normalize configured interval to supported values."""
        try:
            candidate = int(value) if value is not None else DEFAULT_TASK_OVERDUE_INTERVAL_HOURS
        except (TypeError, ValueError):
            return DEFAULT_TASK_OVERDUE_INTERVAL_HOURS
        if candidate not in ALLOWED_TASK_OVERDUE_INTERVAL_HOURS:
            return DEFAULT_TASK_OVERDUE_INTERVAL_HOURS
        return candidate

    @classmethod
    def interval_from_app_settings(cls, raw_value: dict | None) -> int:
        """Extract interval from app_settings JSON payload."""
        if not isinstance(raw_value, dict):
            return DEFAULT_TASK_OVERDUE_INTERVAL_HOURS
        return cls.normalize_task_overdue_interval_hours(raw_value.get("interval_hours"))

    @staticmethod
    def normalize_task_overdue_daily_time_msk(value: object | None) -> str:
        """Normalize daily time string to HH:MM in Moscow timezone."""
        raw = str(value or "").strip()
        match = re.fullmatch(r"(\d{1,2}):(\d{2})", raw)
        if not match:
            return DEFAULT_TASK_OVERDUE_DAILY_TIME_MSK
        hour = int(match.group(1))
        minute = int(match.group(2))
        if not (0 <= hour < 24 and 0 <= minute < 60):
            return DEFAULT_TASK_OVERDUE_DAILY_TIME_MSK
        return f"{hour:02d}:{minute:02d}"

    @classmethod
    def daily_time_from_app_settings(cls, raw_value: dict | None) -> str:
        """Extract daily HH:MM time from app_settings JSON payload."""
        if not isinstance(raw_value, dict):
            return DEFAULT_TASK_OVERDUE_DAILY_TIME_MSK
        return cls.normalize_task_overdue_daily_time_msk(raw_value.get("daily_time_msk"))

    def _build_task_overdue_trigger(
        self, interval_hours: int, daily_time_msk: str
    ) -> tuple[str, dict[str, int | str]]:
        if interval_hours == 24:
            hour, minute = (int(value) for value in daily_time_msk.split(":"))
            trigger_kwargs: dict[str, int | str] = {
                "hour": hour,
                "minute": minute,
                "timezone": settings.TIMEZONE,
            }
            return "cron", trigger_kwargs
        trigger_kwargs = {
            "minute": 0,
            "timezone": settings.TIMEZONE,
        }
        return "cron", trigger_kwargs

    def set_task_overdue_schedule(
        self,
        interval_hours: int,
        daily_time_msk: str | None = None,
    ) -> tuple[int, str]:
        """
        Reconfigure overdue checks.
        Supported interval values: 1, 24 hours.
        For 24h, daily_time_msk defines HH:MM trigger.
        """
        normalized = self.normalize_task_overdue_interval_hours(interval_hours)
        normalized_time = self.normalize_task_overdue_daily_time_msk(daily_time_msk)
        trigger, trigger_kwargs = self._build_task_overdue_trigger(
            normalized,
            normalized_time,
        )
        self.scheduler.add_job(
            self._check_overdue_tasks,
            trigger,
            id="check_overdue",
            replace_existing=True,
            **trigger_kwargs,
        )
        self._task_overdue_interval_hours = normalized
        self._task_overdue_daily_time_msk = normalized_time
        logger.info(
            "ReminderService overdue schedule set: interval=%s hour(s), daily_time_msk=%s",
            normalized,
            normalized_time,
        )
        return normalized, normalized_time

    @classmethod
    def schedule_from_app_settings(cls, raw_value: dict | None) -> tuple[int, str]:
        """Extract interval + daily time from app_settings JSON payload."""
        return (
            cls.interval_from_app_settings(raw_value),
            cls.daily_time_from_app_settings(raw_value),
        )

    async def refresh_task_overdue_schedule_from_settings(self) -> tuple[int, str]:
        """Load overdue schedule from app settings and apply to scheduler."""
        interval = DEFAULT_TASK_OVERDUE_INTERVAL_HOURS
        daily_time_msk = DEFAULT_TASK_OVERDUE_DAILY_TIME_MSK
        try:
            async with self.session_maker() as session:
                setting = await self.app_settings_repo.get(
                    session,
                    TASK_OVERDUE_NOTIFICATIONS_KEY,
                )
            interval, daily_time_msk = self.schedule_from_app_settings(
                setting.value if setting else None
            )
        except Exception as e:
            logger.error(
                "Failed to load overdue schedule from app settings, using default: %s",
                e,
            )
        return self.set_task_overdue_schedule(interval, daily_time_msk)

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

    async def _check_task_reminders(self) -> None:
        """Send one-off task reminders when their trigger time has come."""
        try:
            async with self.session_maker() as session:
                now_utc = datetime.utcnow()
                stmt = (
                    select(Task)
                    .options(selectinload(Task.assignee))
                    .where(
                        Task.reminder_at.is_not(None),
                        Task.reminder_sent_at.is_(None),
                        Task.reminder_at <= now_utc,
                        Task.status.notin_(["done", "cancelled"]),
                    )
                )
                result = await session.execute(stmt)
                due_tasks = list(result.scalars().all())
                if not due_tasks:
                    return

                touched = False
                for task in due_tasks:
                    assignee = task.assignee
                    if not assignee or not assignee.telegram_id:
                        logger.warning(
                            "Skip task reminder for #%s: assignee/telegram_id missing",
                            task.short_id,
                        )
                        task.reminder_sent_at = now_utc
                        touched = True
                        continue

                    sent = await self._send_task_reminder(task, assignee)
                    if sent:
                        task.reminder_sent_at = datetime.utcnow()
                        touched = True

                if touched:
                    await session.commit()
        except Exception as e:
            logger.error(f"Error in _check_task_reminders: {e}")

    async def _send_task_reminder(self, task: Task, member: TeamMember) -> bool:
        """Send a single task reminder message to assignee."""
        reminder_dt_utc = task.reminder_at
        if reminder_dt_utc is None:
            return False

        try:
            tz = ZoneInfo(settings.TIMEZONE)
        except Exception:
            tz = ZoneInfo("Europe/Moscow")
        reminder_local = reminder_dt_utc.replace(tzinfo=ZoneInfo("UTC")).astimezone(tz)

        text_lines = [
            "⏰ Напоминание по задаче",
            "",
            f"#{task.short_id} · {task.title}",
            f"Статус: {TASK_STATUS_LABELS.get(task.status, task.status)}",
            f"Время: {reminder_local.strftime('%d.%m.%Y %H:%M')}",
        ]
        if task.reminder_comment:
            text_lines.append("")
            text_lines.append(f"💬 Комментарий: {task.reminder_comment}")

        markup = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(
                text="📋 Открыть задачу",
                callback_data=TaskCardCallback(
                    short_id=task.short_id,
                    scope=TaskListScope.MY,
                    task_filter=TaskListFilter.ALL,
                    page=1,
                    department_token=ALL_DEPARTMENTS_TOKEN,
                ).pack(),
            )
        ]])

        try:
            await self.bot.send_message(
                member.telegram_id,
                "\n".join(text_lines),
                reply_markup=markup,
            )
            return True
        except Exception as e:
            logger.warning(
                "Failed to send task reminder #%s to %s: %s",
                task.short_id,
                member.telegram_id,
                e,
            )
            return False

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

    async def _is_pulse_personal_enabled(
        self, session: AsyncSession, member_id
    ) -> bool:
        """Personal Pulse block is opt-OUT: ON unless an explicit
        ``pulse_personal`` subscription is ``is_active=False``.

        Note: this gate is for the PERSONAL daily digest only. The company
        Pulse digest (the group post in ``_send_company_pulse_digest``) has no
        per-member opt-out by design.
        """
        subs = await self.sub_repo.get_by_member(session, member_id)
        for s in subs:
            if s.event_type == "pulse_personal":
                return s.is_active
        return True

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

        # Personal Pulse block (Task 15) is opt-OUT (Task 16): ON by default,
        # off only when the member has a pulse_personal subscription with
        # is_active=False. When opted out, skip the Pulse queries entirely (no
        # double query) so the digest is exactly what it was before Task 15.
        pulse_enabled = await self._is_pulse_personal_enabled(session, member.id)

        # Personal Pulse block (Task 15): "what changed about you" in the last
        # 24h (events on the member's OWN tasks by others) + a weekly recap of
        # how many tasks they personally closed. Computed once, appended to both
        # the no-tasks and normal digest paths below.
        pulse_text: str | None = None
        if pulse_enabled:
            now_utc = datetime.now(timezone.utc)
            changed_cutoff = now_utc - timedelta(hours=24)
            changed_events = list(
                (
                    await session.execute(
                        select(ActivityEvent)
                        .join(Task, ActivityEvent.task_id == Task.id)
                        .where(
                            Task.assignee_id == member.id,
                            ActivityEvent.actor_id != member.id,
                            ActivityEvent.created_at >= changed_cutoff,
                        )
                        .order_by(ActivityEvent.created_at.desc())
                    )
                ).scalars().all()
            )
            week_cutoff = now_utc - timedelta(days=7)
            completed_week_count = (
                await session.execute(
                    select(func.count())
                    .select_from(ActivityEvent)
                    .where(
                        ActivityEvent.actor_id == member.id,
                        ActivityEvent.event_type == "task_completed",
                        ActivityEvent.created_at >= week_cutoff,
                    )
                )
            ).scalar() or 0
            pulse_text = build_personal_pulse_text(changed_events, completed_week_count)

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

        # Moderator-only escalation block is team-wide and must be available
        # even when the moderator personally has no active tasks (Task 15).
        moderator_block: str | None = None
        if getattr(member, "role", None) and PermissionService.is_moderator(member):
            moderator_block = await self._build_moderator_escalation_block(
                session, today
            )

        header = f"📊 <b>Ежедневный дайджест — {today.strftime('%d.%m.%Y')}</b>"

        if not active_tasks:
            # Edge case: a moderator with no personal tasks but a non-empty
            # escalation block still gets a digest (header + block).
            if moderator_block:
                text = "\n".join([header, moderator_block])
            else:
                text = (
                    f"{header}\n\n"
                    "У тебя нет активных задач. Отличная работа! 🎉"
                )
            # Personal Pulse block (Task 15): no one-tap action buttons here
            # since there are no active tasks to act on. Skipped entirely when
            # the member has opted out (Task 16; pulse_text stays None).
            if pulse_enabled and pulse_text:
                text = text + "\n\n" + pulse_text
            await self._send_safe(
                member.telegram_id,
                text,
                digest_markup,
                parse_mode="HTML",
            )
            return

        sections = []
        sections.append(header)
        section_blocks: dict[str, str] = {}
        task_line_fields_order = normalize_task_line_fields_order(
            getattr(rs, "task_line_fields_order", None)
        )
        upcoming_days = normalize_upcoming_days(getattr(rs, "upcoming_days", 3))
        task_line_field_flags = {
            "number": bool(getattr(rs, "task_line_show_number", True)),
            "title": bool(getattr(rs, "task_line_show_title", True)),
            "deadline": bool(getattr(rs, "task_line_show_deadline", True)),
            "priority": bool(getattr(rs, "task_line_show_priority", True)),
        }

        # Prioritized partition (for de-duplication across sections):
        # 1) overdue, 2) upcoming, 3) remaining in_progress/new.
        overdue = [t for t in active_tasks if t.deadline and t.deadline < today]
        upcoming_end = today + timedelta(days=upcoming_days)
        upcoming = [
            t
            for t in active_tasks
            if t.deadline and today <= t.deadline <= upcoming_end
        ]
        prioritized_keys = {
            self._task_unique_key(t)
            for t in [*overdue, *upcoming]
        }
        remaining_active_tasks = [
            t
            for t in active_tasks
            if self._task_unique_key(t) not in prioritized_keys
        ]

        # Overdue tasks
        if rs.include_overdue:
            if overdue:
                lines = ["\n<b>🔴 Просроченные ({}):</b>".format(len(overdue))]
                for t in overdue:
                    lines.append(
                        escape(
                            self._format_digest_task_line(
                                task=t,
                                field_flags=task_line_field_flags,
                                field_order=task_line_fields_order,
                                overdue_deadline=True,
                            )
                        )
                    )
                section_blocks["overdue"] = "\n".join(lines)

        # Upcoming tasks by configurable deadline window.
        if rs.include_upcoming:
            if upcoming:
                if upcoming_days == 0:
                    lines = ["\n<b>⏰ Дедлайны сегодня ({})</b>".format(len(upcoming))]
                    for t in upcoming:
                        lines.append(
                            escape(
                                self._format_digest_task_line(
                                    task=t,
                                    field_flags=task_line_field_flags,
                                    field_order=task_line_fields_order,
                                    overdue_deadline=False,
                                )
                            )
                        )
                else:
                    lines = ["\n<b>📅 Ближайшие по дедлайну ({} дн.):</b>".format(upcoming_days)]
                    for t in upcoming:
                        lines.append(
                            escape(
                                self._format_digest_task_line(
                                    task=t,
                                    field_flags=task_line_field_flags,
                                    field_order=task_line_fields_order,
                                    overdue_deadline=False,
                                )
                            )
                        )
                section_blocks["upcoming"] = "\n".join(lines)

        # In progress
        if rs.include_in_progress:
            in_progress = [
                t for t in remaining_active_tasks if t.status == "in_progress"
            ]
            if in_progress:
                lines = ["\n<b>🔄 В работе ({}):</b>".format(len(in_progress))]
                for t in in_progress:
                    lines.append(
                        escape(
                            self._format_digest_task_line(
                                task=t,
                                field_flags=task_line_field_flags,
                                field_order=task_line_fields_order,
                                overdue_deadline=False,
                            )
                        )
                    )
                section_blocks["in_progress"] = "\n".join(lines)

        # New tasks
        if rs.include_new:
            new_tasks = [t for t in remaining_active_tasks if t.status == "new"]
            if new_tasks:
                lines = ["\n<b>🆕 Новые ({}):</b>".format(len(new_tasks))]
                for t in new_tasks:
                    lines.append(
                        escape(
                            self._format_digest_task_line(
                                task=t,
                                field_flags=task_line_field_flags,
                                field_order=task_line_fields_order,
                                overdue_deadline=False,
                            )
                        )
                    )
                section_blocks["new"] = "\n".join(lines)

        section_order = normalize_digest_sections_order(
            getattr(rs, "digest_sections_order", None)
        )
        for section_key in section_order:
            block = section_blocks.get(section_key)
            if block:
                sections.append(block)

        # Close-candidates section (Task 14). Gated on the existing overdue flag
        # (Task 16: reuse include_overdue, no new settings column).
        if rs.include_overdue:
            close_candidates = await self._fetch_close_candidate_tasks(
                session, member, today
            )
            close_section = build_close_candidates_section(close_candidates, today)
            if close_section:
                sections.append(close_section)

        # Moderator escalation block (Task 15), team-wide, moderators only.
        if moderator_block:
            sections.append(moderator_block)

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

        sections.append(
            f"\n<b>Всего активных:</b> {total} | <b>Завершено вчера:</b> {done_count} 💪"
        )

        text = "\n".join(sections)

        # Personal Pulse block (Task 15): append the "what changed" + weekly
        # recap text, and the one-tap action rows (only present here because the
        # member has active tasks). The action rows extend the existing markup
        # so the "📋 Открыть мои задачи" button stays at the top. Both are
        # skipped when the member has opted out (Task 16), making the digest
        # identical to its pre-Task-15 form.
        if pulse_enabled and pulse_text:
            text = text + "\n\n" + pulse_text
        if pulse_enabled:
            digest_markup.inline_keyboard.extend(
                build_pulse_task_action_rows(active_tasks)
            )

        await self._send_safe(
            member.telegram_id,
            text,
            digest_markup,
            parse_mode="HTML",
        )

    async def _fetch_close_candidate_tasks(
        self, session: AsyncSession, member: TeamMember, today: date
    ) -> list[Task]:
        """Tasks the member is assignee OR author of, 14+ days overdue, active.

        The standard digest only loads assigned tasks, so this runs an explicit
        query to also pick up authored tasks. Results are deduped by id.
        """
        # Overdue by >= 14 days (inclusive), matching the frontend candidate view.
        threshold = today - timedelta(days=14)
        stmt = (
            select(Task)
            .where(
                or_(
                    Task.assignee_id == member.id,
                    Task.created_by_id == member.id,
                ),
                Task.deadline <= threshold,
                Task.status.notin_(["done", "cancelled"]),
            )
            .order_by(Task.deadline.asc())
        )
        result = await session.execute(stmt)
        tasks = result.scalars().all()
        # Defensive: only treat a genuine sequence as task rows. Some unit tests
        # exercise the digest with a mocked session whose execute() returns a
        # non-iterable stand-in; in that case there are simply no candidates.
        if not isinstance(tasks, (list, tuple)):
            return []
        seen: set[str] = set()
        deduped: list[Task] = []
        for task in tasks:
            key = self._task_unique_key(task)
            if key in seen:
                continue
            seen.add(key)
            deduped.append(task)
        return deduped

    async def _build_moderator_escalation_block(
        self, session: AsyncSession, today: date
    ) -> str | None:
        """Build the team-wide moderator escalation block (Task 15).

        Two queries: tasks stuck 30+ days with an escalation DM already sent,
        and tasks auto-cancelled by the inactivity job earlier today.
        """
        threshold_30 = today - timedelta(days=30)
        stuck_stmt = (
            select(Task)
            .options(selectinload(Task.assignee))
            .where(
                Task.status.notin_(["done", "cancelled"]),
                Task.deadline < threshold_30,
                Task.escalation_dm_sent_at.is_not(None),
            )
            .order_by(Task.deadline.asc())
            .limit(20)
        )
        today_start = datetime.combine(today, time.min, tzinfo=timezone.utc)
        auto_stmt = (
            select(Task)
            .where(
                Task.status == "cancelled",
                Task.cancellation_reason == "auto_inactivity",
                Task.last_activity_at >= today_start,
            )
            .order_by(Task.last_activity_at.asc())
        )
        stuck_tasks = list((await session.execute(stuck_stmt)).scalars().all())
        autocancelled_tasks = list((await session.execute(auto_stmt)).scalars().all())
        return build_moderator_escalation_block(stuck_tasks, autocancelled_tasks, today)

    async def _member_no_overdue(self, session, member, month_start, month_end) -> bool:
        """True iff the member had >=1 task with a deadline in [month_start, month_end)
        and none of those tasks went overdue (cancelled tasks are ignored)."""
        tasks = (await session.execute(
            select(Task).where(
                Task.assignee_id == member.id,
                Task.deadline >= month_start,
                Task.deadline < month_end,
            )
        )).scalars().all()
        considered = 0
        for t in tasks:
            if t.status == "cancelled":
                continue
            if t.status == "done":
                if t.completed_at is not None and t.completed_at.date() > t.deadline:
                    return False
                considered += 1
            else:
                return False
        return considered > 0

    async def _run_monthly_milestones(
        self, session, *, period, start_utc, end_utc, month_start, month_end
    ) -> list[tuple]:
        """Award the team monthly recap + per-member no-overdue milestones.

        Returns a list of (member_id, dm_text) to DM after the transaction commits.
        """
        dm_targets: list[tuple] = []

        count = (await session.execute(
            select(func.count())
            .select_from(ActivityEvent)
            .where(
                ActivityEvent.event_type == "task_completed",
                ActivityEvent.created_at >= start_utc,
                ActivityEvent.created_at < end_utc,
            )
        )).scalar_one()
        if count > 0 and await self.activity_service.claim_milestone(session, f"team_month:{period}"):
            await self.activity_service.record(
                session, event_type="milestone_team", actor=None,
                extra={"kind": "month", "count": int(count), "period": period},
            )

        members = (await session.execute(
            select(TeamMember).where(TeamMember.is_active.is_(True))
        )).scalars().all()
        for mem in members:
            if not await self._member_no_overdue(session, mem, month_start, month_end):
                continue
            if await self.activity_service.claim_milestone(session, f"no_overdue:{mem.id}:{period}", member_id=mem.id):
                await self.activity_service.record(
                    session, event_type="milestone_personal", actor=mem,
                    extra={"kind": "no_overdue", "period": period},
                )
                dm_targets.append((mem.id, "🛡️ Поздравляем! Месяц без единой просрочки. Так держать!"))
        return dm_targets

    async def _monthly_milestones_job(self) -> None:
        """Monthly job (1st of month): team recap + personal no-overdue, then DMs."""
        try:
            try:
                tz = ZoneInfo(settings.TIMEZONE)
            except Exception:
                tz = ZoneInfo("Europe/Moscow")
            today_local = datetime.now(tz).date()
            first_this = today_local.replace(day=1)
            month_start = (first_this - timedelta(days=1)).replace(day=1)
            month_end = first_this
            period = month_start.strftime("%Y-%m")
            start_utc = datetime(month_start.year, month_start.month, 1, tzinfo=tz).astimezone(timezone.utc)
            end_utc = datetime(month_end.year, month_end.month, 1, tzinfo=tz).astimezone(timezone.utc)

            async with self.session_maker() as session:
                async with session.begin():
                    dm_targets = await self._run_monthly_milestones(
                        session, period=period, start_utc=start_utc, end_utc=end_utc,
                        month_start=month_start, month_end=month_end,
                    )

            if dm_targets:
                ns = NotificationService(self.bot)
                async with self.session_maker() as session:
                    for member_id, text in dm_targets:
                        member = await session.get(TeamMember, member_id)
                        if member:
                            await ns.notify_milestone(member, text)
        except Exception as e:
            logger.error(f"Error in _monthly_milestones_job: {e}")

    @staticmethod
    def _task_unique_key(task: Task) -> str:
        task_id = getattr(task, "id", None)
        if task_id is not None:
            return f"id:{task_id}"
        short_id = getattr(task, "short_id", None)
        if short_id is not None:
            return f"short_id:{short_id}"
        return f"title:{getattr(task, 'title', '')}"

    @staticmethod
    def _format_digest_task_line(
        task: Task,
        field_flags: dict[str, bool],
        field_order: list[str],
        overdue_deadline: bool,
        deadline_icon: str = "📅",
    ) -> str:
        parts: list[str] = []
        for field_key in field_order:
            if not field_flags.get(field_key, False):
                continue
            if field_key == "number":
                parts.append(f"#{task.short_id}")
            elif field_key == "title":
                parts.append(task.title)
            elif field_key == "deadline":
                if not task.deadline:
                    continue
                deadline_value = task.deadline.strftime("%d.%m")
                parts.append(f"{deadline_icon} {deadline_value}")
            elif field_key == "priority":
                if is_task_urgent(task.priority):
                    parts.append("Срочно")

        if not parts:
            parts.append(task.title)

        return "  " + " · ".join(parts)

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

                text = build_overdue_tasks_report_text(overdue_tasks, today=today)
                reply_markup = build_overdue_tasks_report_keyboard()

                for sub in subs:
                    member = sub.member
                    if member and member.telegram_id:
                        await self._send_safe(
                            member.telegram_id,
                            text,
                            reply_markup=reply_markup,
                        )

        except Exception as e:
            logger.error(f"Error in _check_overdue_tasks: {e}")

    async def _check_and_send_escalation_dms(self) -> None:
        """Daily job: DM assignee+author about tasks 30+ days overdue.

        Two cohorts:
          - first-time: crossed 30 days overdue and never got an escalation DM;
          - repeat: a DM was already sent 7+ days ago and there has been no
            activity since (last_activity_at < escalation_dm_sent_at).
        Each qualifying task gets a DM to both the assignee and the author
        (deduped by telegram_id) and has escalation_dm_sent_at advanced to now.
        """
        try:
            today = date.today()
            now = datetime.now(timezone.utc)
            deadline_threshold = today - timedelta(days=OVERDUE_ESCALATION_DAYS)
            repeat_threshold = now - timedelta(days=OVERDUE_ESCALATION_REPEAT_DAYS)

            async with self.session_maker() as session:
                base_options = (
                    selectinload(Task.assignee),
                    selectinload(Task.created_by),
                )
                first_time_stmt = (
                    select(Task)
                    .options(*base_options)
                    .where(
                        Task.status.notin_(["done", "cancelled"]),
                        Task.deadline < deadline_threshold,
                        Task.escalation_dm_sent_at.is_(None),
                    )
                )
                repeat_stmt = (
                    select(Task)
                    .options(*base_options)
                    .where(
                        Task.status.notin_(["done", "cancelled"]),
                        Task.deadline < deadline_threshold,
                        Task.escalation_dm_sent_at.is_not(None),
                        Task.escalation_dm_sent_at < repeat_threshold,
                        Task.last_activity_at < Task.escalation_dm_sent_at,
                    )
                )

                first_time = list(
                    (await session.execute(first_time_stmt)).scalars().all()
                )
                repeat = list((await session.execute(repeat_stmt)).scalars().all())

                if not first_time and not repeat:
                    return

                for is_repeat, task in (
                    [(False, t) for t in first_time] + [(True, t) for t in repeat]
                ):
                    days = _days_overdue(task, today)
                    text = build_escalation_dm_text(task, days, is_repeat=is_repeat)
                    keyboard = escalation_actions_keyboard(task.short_id)
                    recipient_ids: set[int] = set()
                    for member in (task.assignee, task.created_by):
                        tg_id = getattr(member, "telegram_id", None)
                        if tg_id is not None:
                            recipient_ids.add(tg_id)
                    for tg_id in recipient_ids:
                        await self._send_safe(tg_id, text, reply_markup=keyboard)
                    task.escalation_dm_sent_at = now

                await session.commit()
        except Exception as e:
            logger.error(f"Error in _check_and_send_escalation_dms: {e}")

    async def _daily_autocancel_job(self) -> None:
        """Daily job: auto-cancel tasks 60+ days overdue with no recent activity.

        Qualifying tasks (status not done/cancelled, deadline 60+ days past, and
        last_activity_at 60+ days ago) are set to cancelled with
        cancellation_reason='auto_inactivity'. We intentionally do NOT create a
        TaskUpdate: TaskUpdate.author_id is NOT NULL and there is no system
        member to attribute the action to, so the cancellation_reason field is
        the system-of-record for auto-cancellation. Both assignee and author get
        a plain DM (no keyboard).
        """
        try:
            today = date.today()
            now = datetime.now(timezone.utc)
            deadline_threshold = today - timedelta(days=OVERDUE_AUTOCANCEL_DAYS)
            activity_threshold = now - timedelta(days=OVERDUE_AUTOCANCEL_DAYS)

            async with self.session_maker() as session:
                stmt = (
                    select(Task)
                    .options(
                        selectinload(Task.assignee),
                        selectinload(Task.created_by),
                    )
                    .where(
                        Task.status.notin_(["done", "cancelled"]),
                        Task.deadline < deadline_threshold,
                        Task.last_activity_at < activity_threshold,
                    )
                )
                tasks = list((await session.execute(stmt)).scalars().all())
                if not tasks:
                    return

                for task in tasks:
                    task.status = "cancelled"
                    task.cancellation_reason = "auto_inactivity"
                    task.last_activity_at = now
                    text = (
                        f"Задача #{task.short_id} · {_task_title(task)} "
                        f"автоматически отменена (60 дней без движения). "
                        f"Если она всё ещё актуальна — создай новую."
                    )
                    recipient_ids: set[int] = set()
                    for member in (task.assignee, task.created_by):
                        tg_id = getattr(member, "telegram_id", None)
                        if tg_id is not None:
                            recipient_ids.add(tg_id)
                    for tg_id in recipient_ids:
                        await self._send_safe(tg_id, text)

                await session.commit()
        except Exception as e:
            logger.error(f"Error in _daily_autocancel_job: {e}")

    async def _send_company_pulse_digest(self) -> None:
        """Daily job: post the redacted company Pulse digest of yesterday.

        Reads the target chat from ``app_settings["pulse_chat_id"]`` and queries
        all of yesterday's :class:`ActivityEvent` rows (the builder filters event
        types itself). The window is the previous full calendar day in the
        configured timezone, converted to UTC for the query. No-ops when the chat
        is not configured or there is nothing shareable to send.
        """
        try:
            try:
                tz = ZoneInfo(settings.TIMEZONE)
            except Exception:
                tz = ZoneInfo("Europe/Moscow")

            today_local = datetime.now(tz).date()
            # Skip if we already posted today (guards scheduler restarts).
            if self._company_digest_sent_on == today_local:
                return

            yesterday_local = today_local - timedelta(days=1)
            start_local = datetime(
                yesterday_local.year,
                yesterday_local.month,
                yesterday_local.day,
                tzinfo=tz,
            )
            end_local = datetime(
                today_local.year,
                today_local.month,
                today_local.day,
                tzinfo=tz,
            )
            start_utc = start_local.astimezone(timezone.utc)
            end_utc = end_local.astimezone(timezone.utc)

            async with self.session_maker() as session:
                setting = await self.app_settings_repo.get(session, PULSE_CHAT_KEY)
                value = setting.value if setting is not None else None
                if not isinstance(value, dict):
                    return
                chat_id = value.get("chat_id")
                if chat_id is None:
                    return
                thread_id = value.get("thread_id")

                stmt = (
                    select(ActivityEvent)
                    .where(
                        ActivityEvent.created_at >= start_utc,
                        ActivityEvent.created_at < end_utc,
                    )
                    .order_by(ActivityEvent.created_at.desc())
                )
                events = list((await session.execute(stmt)).scalars().all())

            text = build_company_digest(events, settings.TIMEZONE)
            if text is None:
                return

            keyboard = build_pulse_reaction_keyboard(events)

            try:
                await self.bot.send_message(
                    chat_id=chat_id,
                    text=text,
                    message_thread_id=thread_id,
                    parse_mode="HTML",
                    reply_markup=keyboard,
                )
                self._company_digest_sent_on = today_local
            except Exception as e:
                logger.warning(f"Failed to send company Pulse digest to {chat_id}: {e}")
        except Exception as e:
            logger.error(f"Error in _send_company_pulse_digest: {e}")

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
        self,
        chat_id: int,
        text: str,
        reply_markup: InlineKeyboardMarkup | None = None,
        parse_mode: str | None = None,
    ) -> None:
        """Send message, suppress errors."""
        try:
            send_kwargs: dict[str, object] = {
                "chat_id": chat_id,
                "text": text,
                "reply_markup": reply_markup,
            }
            if parse_mode:
                send_kwargs["parse_mode"] = parse_mode
            await self.bot.send_message(**send_kwargs)
        except Exception as e:
            logger.warning(f"Failed to send reminder to {chat_id}: {e}")
