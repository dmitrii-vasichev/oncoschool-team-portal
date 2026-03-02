import logging
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.bot.filters import IsModeratorFilter
from app.config import settings
from app.db.models import Meeting, Task, TaskUpdate, TeamMember
from app.db.repositories import MeetingRepository, TeamMemberRepository
from app.services.permission_service import PermissionService
from app.services.zoom_service import sanitize_zoom_join_url

logger = logging.getLogger(__name__)

router = Router()

meeting_repo = MeetingRepository()
member_repo = TeamMemberRepository()

TIMEZONE = ZoneInfo(settings.TIMEZONE)

# ── Helpers ──

MONTH_NAMES_RU = {
    1: "января", 2: "февраля", 3: "марта", 4: "апреля",
    5: "мая", 6: "июня", 7: "июля", 8: "августа",
    9: "сентября", 10: "октября", 11: "ноября", 12: "декабря",
}

DAY_NAMES_RU = {
    0: "Понедельник", 1: "Вторник", 2: "Среда", 3: "Четверг",
    4: "Пятница", 5: "Суббота", 6: "Воскресенье",
}

DAY_NAMES_SHORT_RU = {
    0: "Пн", 1: "Вт", 2: "Ср", 3: "Чт", 4: "Пт", 5: "Сб", 6: "Вс",
}


def _format_meeting_date_short(dt: datetime) -> str:
    """Format as 'Пн, 17 февраля'."""
    local = dt.astimezone(TIMEZONE) if dt.tzinfo else dt.replace(tzinfo=timezone.utc).astimezone(TIMEZONE)
    day_name = DAY_NAMES_SHORT_RU[local.weekday()]
    month_name = MONTH_NAMES_RU[local.month]
    return f"{day_name}, {local.day} {month_name}"


def _format_meeting_time(dt: datetime) -> str:
    """Format time as '15:00 МСК'."""
    local = dt.astimezone(TIMEZONE) if dt.tzinfo else dt.replace(tzinfo=timezone.utc).astimezone(TIMEZONE)
    return f"{local.strftime('%H:%M')} МСК"


def _format_meeting_date_full(dt: datetime) -> str:
    """Format as 'Понедельник, 17 февраля 2026'."""
    local = dt.astimezone(TIMEZONE) if dt.tzinfo else dt.replace(tzinfo=timezone.utc).astimezone(TIMEZONE)
    day_name = DAY_NAMES_RU[local.weekday()]
    month_name = MONTH_NAMES_RU[local.month]
    return f"{day_name}, {local.day} {month_name} {local.year}"


def _time_until(dt: datetime) -> str:
    """Human-readable time until a date, e.g. 'через 2 дня'."""
    now = datetime.now(timezone.utc)
    target = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    delta = target - now

    if delta.total_seconds() < 0:
        return "уже началась"

    hours = delta.total_seconds() / 3600
    if hours < 1:
        minutes = int(delta.total_seconds() / 60)
        return f"через {minutes} мин"
    if hours < 24:
        return f"через {int(hours)} ч"
    days = delta.days
    if days == 1:
        return "завтра"
    if days < 5:
        return f"через {days} дня"
    return f"через {days} дней"


def _zoom_short_url(url: str | None) -> str | None:
    """Extract short Zoom URL for display."""
    if not url:
        return None
    # Show just the domain/path, not full URL
    if "zoom.us" in url:
        # Extract the join part
        parts = url.split("zoom.us")
        if len(parts) > 1:
            return f"zoom.us{parts[1][:30]}"
    return url[:40]


# ── /meetings command ──

@router.message(Command("meetings"), IsModeratorFilter())
async def cmd_meetings(
    message: Message, member: TeamMember, session_maker: async_sessionmaker
) -> None:
    """Show upcoming and recent meetings (moderator only)."""
    async with session_maker() as session:
        upcoming = await meeting_repo.get_upcoming(session, limit=5)
        past = await meeting_repo.get_past(session, limit=5)

        # Count tasks per past meeting
        past_task_counts = {}
        if past:
            for m in past:
                count_stmt = select(func.count(Task.id)).where(Task.meeting_id == m.id)
                result = await session.execute(count_stmt)
                past_task_counts[m.id] = result.scalar_one()

    lines = []

    # Upcoming meetings
    if upcoming:
        lines.append("<b>📋 Предстоящие встречи:</b>\n")
        for m in upcoming:
            title = m.title or "Без названия"
            lines.append(f"📹 <b>{title}</b>")
            if m.meeting_date:
                date_str = _format_meeting_date_short(m.meeting_date)
                time_str = _format_meeting_time(m.meeting_date)
                lines.append(f"📅 {date_str} · {time_str}")
            if m.zoom_join_url:
                safe_zoom_url = sanitize_zoom_join_url(
                    m.zoom_join_url,
                    zoom_meeting_id=m.zoom_meeting_id,
                )
                lines.append(f"🔗 {_zoom_short_url(safe_zoom_url)}")
            lines.append("")
    else:
        lines.append("📋 Нет предстоящих встреч.\n")

    # Separator
    lines.append("───────────\n")

    # Past meetings
    if past:
        lines.append("<b>✅ Последние завершённые:</b>")
        for m in past:
            title = m.title or "Без названия"
            date_str = ""
            if m.meeting_date:
                local = m.meeting_date.astimezone(TIMEZONE) if m.meeting_date.tzinfo else m.meeting_date.replace(tzinfo=timezone.utc).astimezone(TIMEZONE)
                date_str = f" — {local.strftime('%d.%m')}"
            task_count = past_task_counts.get(m.id, 0)
            task_str = f" ({task_count} задач)" if task_count > 0 else ""
            lines.append(f"• {title}{date_str}{task_str}")

    lines.append("\n<i>Все встречи → веб-интерфейс</i>")

    keyboard = None
    if settings.NEXT_PUBLIC_FRONTEND_URL:
        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton(text="🌐 Открыть в браузере", url=f"{settings.NEXT_PUBLIC_FRONTEND_URL}/meetings")]
            ]
        )

    await message.answer("\n".join(lines), parse_mode="HTML", reply_markup=keyboard)


# ── /nextmeeting command ──

@router.message(Command("nextmeeting"))
async def cmd_nextmeeting(
    message: Message, member: TeamMember, session_maker: async_sessionmaker
) -> None:
    """Show the next upcoming meeting."""
    is_moderator = PermissionService.is_moderator(member)

    async with session_maker() as session:
        if is_moderator:
            upcoming = await meeting_repo.get_upcoming(session, limit=1)
        elif member.department_id:
            upcoming = await meeting_repo.get_upcoming_for_department(
                session,
                department_id=member.department_id,
                limit=1,
            )
        else:
            upcoming = []

    if not upcoming:
        if is_moderator:
            await message.answer("📋 Нет запланированных встреч.")
        else:
            await message.answer("📋 В вашем отделе нет запланированных встреч.")
        return

    m = upcoming[0]
    title = m.title or "Без названия"

    if is_moderator:
        lines = ["<b>📹 Следующая встреча:</b>\n"]
    else:
        lines = ["<b>📹 Следующая встреча отдела:</b>\n"]
    lines.append(f"<b>{title}</b>")

    if m.meeting_date:
        lines.append(f"📅 {_format_meeting_date_full(m.meeting_date)}")
        lines.append(f"⏰ {_format_meeting_time(m.meeting_date)} ({_time_until(m.meeting_date)})")

    if m.zoom_join_url:
        safe_zoom_url = sanitize_zoom_join_url(
            m.zoom_join_url,
            zoom_meeting_id=m.zoom_meeting_id,
        )
        lines.append(f"🔗 Подключиться: {safe_zoom_url}")

    await message.answer("\n".join(lines), parse_mode="HTML")


# ── /stats command ──

@router.message(Command("stats"), IsModeratorFilter())
async def cmd_stats(
    message: Message, member: TeamMember, session_maker: async_sessionmaker
) -> None:
    """Show team statistics (moderator only)."""
    async with session_maker() as session:
        today = date.today()

        # Task counts by status
        status_stmt = select(Task.status, func.count(Task.id)).group_by(Task.status)
        status_result = await session.execute(status_stmt)
        status_counts = dict(status_result.all())

        total = sum(status_counts.values())
        new_count = status_counts.get("new", 0)
        in_progress = status_counts.get("in_progress", 0)
        review = status_counts.get("review", 0)
        done = status_counts.get("done", 0)
        cancelled = status_counts.get("cancelled", 0)

        # Overdue
        overdue_stmt = select(func.count(Task.id)).where(
            Task.deadline < today,
            Task.status.notin_(["done", "cancelled"]),
        )
        overdue_result = await session.execute(overdue_stmt)
        overdue = overdue_result.scalar_one()

        # Tasks by source
        source_stmt = select(Task.source, func.count(Task.id)).group_by(Task.source)
        source_result = await session.execute(source_stmt)
        source_counts = dict(source_result.all())

        # Total meetings
        meeting_stmt = select(func.count(Meeting.id))
        meeting_result = await session.execute(meeting_stmt)
        total_meetings = meeting_result.scalar_one()

        # Active members
        members_stmt = select(func.count(TeamMember.id)).where(
            TeamMember.is_active.is_(True)
        )
        members_result = await session.execute(members_stmt)
        total_members = members_result.scalar_one()

        # Members who haven't updated in >3 days
        all_active = await member_repo.get_all_active(session)
        inactive_members = []
        for m in all_active:
            last_update_stmt = (
                select(TaskUpdate.created_at)
                .where(TaskUpdate.author_id == m.id)
                .order_by(TaskUpdate.created_at.desc())
                .limit(1)
            )
            last_result = await session.execute(last_update_stmt)
            last_update = last_result.scalar_one_or_none()

            # Check if has assigned tasks but no recent updates
            has_tasks_stmt = select(func.count(Task.id)).where(
                Task.assignee_id == m.id,
                Task.status.notin_(["done", "cancelled"]),
            )
            has_tasks_result = await session.execute(has_tasks_stmt)
            active_tasks = has_tasks_result.scalar_one()

            if active_tasks > 0:
                if last_update is None:
                    inactive_members.append(m.full_name)
                else:
                    days_since = (
                        datetime.now(timezone.utc) - last_update.replace(tzinfo=timezone.utc)
                        if last_update.tzinfo is None
                        else datetime.now(timezone.utc) - last_update
                    ).days
                    if days_since > 3:
                        inactive_members.append(m.full_name)

    # Source icons
    source_icons = {
        "text": "\U0001f4ac",
        "voice": "\U0001f3a4",
        "summary": "\U0001f4cb",
        "web": "\U0001f310",
    }

    text = (
        f"<b>📊 Статистика команды</b>\n\n"
        f"<b>Задачи ({total}):</b>\n"
        f"  🆕 Новые: {new_count}\n"
        f"  ▶️ В работе: {in_progress}\n"
        f"  👀 На согласовании: {review}\n"
        f"  ✅ Готово: {done}\n"
        f"  ❌ Отменено: {cancelled}\n"
        f"  🔴 Просрочено: {overdue}\n\n"
        f"<b>По источникам:</b>\n"
    )

    for source, count in sorted(source_counts.items(), key=lambda x: -x[1]):
        icon = source_icons.get(source, "\U0001f4c4")
        text += f"  {icon} {source}: {count}\n"

    text += (
        f"\n<b>Команда:</b>\n"
        f"  👥 Участников: {total_members}\n"
        f"  📋 Встреч: {total_meetings}\n"
    )

    if inactive_members:
        text += (
            f"\n<b>⚠️ Не обновлялись &gt;3 дней:</b>\n"
            + "\n".join(f"  • {name}" for name in inactive_members)
        )

    await message.answer(text, parse_mode="HTML")
