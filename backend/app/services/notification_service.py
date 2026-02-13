import logging

from aiogram import Bot
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import Meeting, Task, TaskUpdate, TeamMember
from app.db.repositories import NotificationSubscriptionRepository, TeamMemberRepository

logger = logging.getLogger(__name__)


def _task_webapp_markup(task: Task) -> InlineKeyboardMarkup | None:
    """Create inline keyboard with WebAppInfo button for a task, if MINI_APP_URL is set."""
    if not settings.MINI_APP_URL:
        return None
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="📋 Открыть задачу",
            web_app=WebAppInfo(url=f"{settings.MINI_APP_URL}/tasks/{task.short_id}")
        )
    ]])


class NotificationService:
    def __init__(self, bot: Bot):
        self.bot = bot
        self.sub_repo = NotificationSubscriptionRepository()
        self.member_repo = TeamMemberRepository()

    async def notify_task_created(
        self, session: AsyncSession, task: Task, creator: TeamMember
    ) -> None:
        """Notify assignee (if != creator) + subscribers of task_created."""
        # Notify assignee if different from creator
        if task.assignee_id and task.assignee_id != creator.id:
            assignee = task.assignee if task.assignee else await self.member_repo.get_by_id(
                session, task.assignee_id
            )
            if assignee and assignee.telegram_id:
                source_icon = "🎤 " if task.source == "voice" else ""
                deadline_str = f"\n📅 Дедлайн: {task.deadline.strftime('%d.%m.%Y')}" if task.deadline else ""
                text = (
                    f"📌 Тебе назначена новая задача:\n\n"
                    f"{source_icon}#{task.short_id} · {task.title}\n"
                    f"⚡ {task.priority}{deadline_str}\n"
                    f"👤 От: {creator.full_name}"
                )
                await self._send_safe(assignee.telegram_id, text, _task_webapp_markup(task))

        # Notify subscribers of task_created event
        subs = await self.sub_repo.get_active_by_event(session, "task_created")
        for sub in subs:
            # Don't notify creator about their own action
            if sub.member_id == creator.id:
                continue
            # Don't duplicate notification to assignee
            if task.assignee_id and sub.member_id == task.assignee_id:
                continue
            member = sub.member
            if member and member.telegram_id:
                assignee_name = task.assignee.full_name if task.assignee else "—"
                source_icon = "🎤 " if task.source == "voice" else ""
                text = (
                    f"🆕 Новая задача:\n\n"
                    f"{source_icon}#{task.short_id} · {task.title}\n"
                    f"👤 Исполнитель: {assignee_name}\n"
                    f"📝 Создал: {creator.full_name}"
                )
                await self._send_safe(member.telegram_id, text, _task_webapp_markup(task))

    async def notify_status_changed(
        self, session: AsyncSession, task: Task, changed_by: TeamMember,
        old_status: str, new_status: str
    ) -> None:
        """
        Notify about status change.
        If member changed -> notify moderator subscribers.
        If moderator changed -> notify assignee.
        """
        from app.services.permission_service import PermissionService

        status_emoji = {
            "new": "🆕",
            "in_progress": "▶️",
            "review": "👀",
            "done": "✅",
            "cancelled": "❌",
        }
        emoji = status_emoji.get(new_status, "🔄")

        if PermissionService.is_moderator(changed_by):
            # Moderator changed -> notify assignee
            if task.assignee_id and task.assignee_id != changed_by.id:
                assignee = task.assignee if task.assignee else await self.member_repo.get_by_id(
                    session, task.assignee_id
                )
                if assignee and assignee.telegram_id:
                    text = (
                        f"{emoji} Статус задачи изменён:\n\n"
                        f"#{task.short_id} · {task.title}\n"
                        f"{old_status} → {new_status}\n"
                        f"👤 Изменил: {changed_by.full_name}"
                    )
                    await self._send_safe(assignee.telegram_id, text, _task_webapp_markup(task))
        else:
            # Member changed -> notify subscribers of task_status_changed
            subs = await self.sub_repo.get_active_by_event(session, "task_status_changed")
            for sub in subs:
                if sub.member_id == changed_by.id:
                    continue
                member = sub.member
                if member and member.telegram_id:
                    text = (
                        f"{emoji} Статус задачи изменён:\n\n"
                        f"#{task.short_id} · {task.title}\n"
                        f"{old_status} → {new_status}\n"
                        f"👤 Изменил: {changed_by.full_name}"
                    )
                    await self._send_safe(member.telegram_id, text, _task_webapp_markup(task))

    async def notify_task_completed(
        self, session: AsyncSession, task: Task, completed_by: TeamMember
    ) -> None:
        """Notify subscribers of task_completed."""
        subs = await self.sub_repo.get_active_by_event(session, "task_completed")
        for sub in subs:
            if sub.member_id == completed_by.id:
                continue
            member = sub.member
            if member and member.telegram_id:
                text = (
                    f"✅ Задача завершена:\n\n"
                    f"#{task.short_id} · {task.title}\n"
                    f"👤 Завершил: {completed_by.full_name}"
                )
                await self._send_safe(member.telegram_id, text, _task_webapp_markup(task))

    async def notify_task_assigned(
        self, session: AsyncSession, task: Task, assigned_by: TeamMember,
        new_assignee: TeamMember
    ) -> None:
        """Notify new assignee about reassignment."""
        if new_assignee.telegram_id and new_assignee.id != assigned_by.id:
            text = (
                f"🔄 Тебе переназначена задача:\n\n"
                f"#{task.short_id} · {task.title}\n"
                f"⚡ {task.priority}\n"
                f"👤 Назначил: {assigned_by.full_name}"
            )
            await self._send_safe(new_assignee.telegram_id, text, _task_webapp_markup(task))

    async def notify_task_update_added(
        self, session: AsyncSession, task: Task, task_update: TaskUpdate,
        added_by: TeamMember
    ) -> None:
        """Notify subscribers of task_update_added."""
        update_type_label = {
            "progress": "📊 Прогресс",
            "blocker": "🚫 Блокер",
            "comment": "💬 Комментарий",
        }
        type_label = update_type_label.get(task_update.update_type, "📝 Обновление")
        progress_str = f"\n📊 Прогресс: {task_update.progress_percent}%" if task_update.progress_percent is not None else ""

        subs = await self.sub_repo.get_active_by_event(session, "task_update_added")
        for sub in subs:
            if sub.member_id == added_by.id:
                continue
            member = sub.member
            if member and member.telegram_id:
                text = (
                    f"{type_label} к задаче:\n\n"
                    f"#{task.short_id} · {task.title}\n"
                    f"👤 {added_by.full_name}: {task_update.content}"
                    f"{progress_str}"
                )
                await self._send_safe(member.telegram_id, text, _task_webapp_markup(task))

    async def notify_meeting_created(
        self, session: AsyncSession, meeting: Meeting, creator: TeamMember,
        tasks_count: int
    ) -> None:
        """Notify subscribers of meeting_created."""
        subs = await self.sub_repo.get_active_by_event(session, "meeting_created")
        for sub in subs:
            if sub.member_id == creator.id:
                continue
            member = sub.member
            if member and member.telegram_id:
                text = (
                    f"📋 Новая встреча обработана:\n\n"
                    f"📌 {meeting.title or 'Без названия'}\n"
                    f"📝 Создал: {creator.full_name}\n"
                    f"📊 Задач создано: {tasks_count}"
                )
                await self._send_safe(member.telegram_id, text)

    async def _send_safe(
        self, chat_id: int, text: str, reply_markup: InlineKeyboardMarkup | None = None
    ) -> None:
        """Send message, suppress errors."""
        try:
            await self.bot.send_message(chat_id, text, reply_markup=reply_markup)
        except Exception as e:
            logger.warning(f"Failed to send notification to {chat_id}: {e}")
