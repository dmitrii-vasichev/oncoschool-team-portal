import logging
from datetime import date, datetime, timedelta, timezone

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.bot.filters import IsModeratorFilter
from app.db.models import Meeting, Task, TaskUpdate, TeamMember
from app.db.repositories import MeetingRepository, TeamMemberRepository

logger = logging.getLogger(__name__)

router = Router()

meeting_repo = MeetingRepository()
member_repo = TeamMemberRepository()


@router.message(Command("meetings"), IsModeratorFilter())
async def cmd_meetings(
    message: Message, member: TeamMember, session_maker: async_sessionmaker
) -> None:
    """Show recent meetings list (moderator only)."""
    async with session_maker() as session:
        meetings = await meeting_repo.get_all(session)

    if not meetings:
        await message.answer("📋 Встречи пока не создавались.")
        return

    lines = ["<b>📋 Последние встречи:</b>\n"]
    for m in meetings[:10]:
        date_str = (
            m.meeting_date.strftime("%d.%m.%Y")
            if m.meeting_date
            else m.created_at.strftime("%d.%m.%Y")
        )
        title = m.title or "Без названия"
        lines.append(f"• <b>{title}</b> — {date_str}")

    if len(meetings) > 10:
        lines.append(f"\n<i>Показано 10 из {len(meetings)}. Все встречи — в веб-интерфейсе.</i>")

    await message.answer("\n".join(lines), parse_mode="HTML")


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
        "text": "💬",
        "voice": "🎤",
        "summary": "📋",
        "web": "🌐",
    }

    text = (
        f"<b>📊 Статистика команды</b>\n\n"
        f"<b>Задачи ({total}):</b>\n"
        f"  🆕 Новые: {new_count}\n"
        f"  ▶️ В работе: {in_progress}\n"
        f"  👀 Ревью: {review}\n"
        f"  ✅ Готово: {done}\n"
        f"  ❌ Отменено: {cancelled}\n"
        f"  🔴 Просрочено: {overdue}\n\n"
        f"<b>По источникам:</b>\n"
    )

    for source, count in sorted(source_counts.items(), key=lambda x: -x[1]):
        icon = source_icons.get(source, "📄")
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
