import logging
import uuid

from aiogram import Bot
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup
from sqlalchemy.ext.asyncio import AsyncSession

from app.bot.callbacks import (
    ALL_DEPARTMENTS_TOKEN,
    TaskCardCallback,
    TaskListFilter,
    TaskListScope,
)
from app.db.models import DailyMetric, Meeting, Task, TaskUpdate, TeamMember
from app.db.repositories import NotificationSubscriptionRepository, TeamMemberRepository, TelegramTargetRepository
from app.services.activity_service import EMOJI_SYMBOLS
from app.services.task_urgency import is_task_urgent

logger = logging.getLogger(__name__)


# Past-tense Russian verbs for cross-notification, keyed by escalation action.
_ESCALATION_ACTION_VERBS: dict[str, str] = {
    "completed": "завершил(а)",
    "cancelled": "отменил(а)",
    "extended": "продлил(а)",
}


def resolve_counterpart_telegram_id(task, actor) -> int | None:
    """Return the telegram_id of the *other* party on a task.

    When the actor is the assignee, the counterpart is the author and vice
    versa. Returns None when there is no distinct counterpart or the
    counterpart has no telegram_id. Pure helper — works on any object exposing
    ``assignee``/``created_by`` (with ``.id``/``.telegram_id``) and
    ``assignee_id``/``created_by_id``; no DB access.
    """
    assignee = getattr(task, "assignee", None)
    author = getattr(task, "created_by", None)

    actor_id = getattr(actor, "id", None)
    assignee_id = getattr(task, "assignee_id", None) or getattr(assignee, "id", None)

    if actor_id is not None and assignee_id is not None and actor_id == assignee_id:
        counterpart = author
    else:
        counterpart = assignee

    if counterpart is None:
        return None
    counterpart_id = getattr(counterpart, "id", None)
    if actor_id is not None and counterpart_id is not None and counterpart_id == actor_id:
        return None
    return getattr(counterpart, "telegram_id", None)


def build_counterpart_message(actor, action: str, task) -> str:
    """Build the cross-notification DM text. Raises KeyError on unknown action."""
    verb = _ESCALATION_ACTION_VERBS[action]
    actor_name = getattr(actor, "full_name", None) or "Коллега"
    return (
        f"♻️ {actor_name} {verb} задачу:\n\n"
        f"#{task.short_id} · {task.title}"
    )


def _task_callback_markup(task: Task) -> InlineKeyboardMarkup:
    """Create inline keyboard with Telegram callback button for task card."""
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="📋 Открыть задачу",
            callback_data=TaskCardCallback(
                short_id=task.short_id,
                scope=TaskListScope.TEAM,
                task_filter=TaskListFilter.ALL,
                page=1,
                department_token=ALL_DEPARTMENTS_TOKEN,
            ).pack(),
        )
    ]])


class NotificationService:
    def __init__(self, bot: Bot):
        self.bot = bot
        self.sub_repo = NotificationSubscriptionRepository()
        self.member_repo = TeamMemberRepository()
        self.target_repo = TelegramTargetRepository()

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
                details = []
                if is_task_urgent(task.priority):
                    details.append("Срочно")
                if task.deadline:
                    details.append(f"📅 Дедлайн: {task.deadline.strftime('%d.%m.%Y')}")
                text = "\n".join(
                    [
                        "📌 Тебе назначена новая задача:",
                        "",
                        f"{source_icon}#{task.short_id} · {task.title}",
                        *details,
                        f"👤 От: {creator.full_name}",
                    ]
                )
                await self._send_safe(assignee.telegram_id, text, _task_callback_markup(task))

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
                await self._send_safe(member.telegram_id, text, _task_callback_markup(task))

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
                    await self._send_safe(assignee.telegram_id, text, _task_callback_markup(task))
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
                    await self._send_safe(member.telegram_id, text, _task_callback_markup(task))

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
                await self._send_safe(member.telegram_id, text, _task_callback_markup(task))

    async def notify_escalation_action(
        self, session: AsyncSession, task: Task, actor: TeamMember, action: str
    ) -> None:
        """DM the counterpart (author/assignee) when one party acts on an
        escalated task. No-op when there is no distinct counterpart with a
        telegram_id. ``action`` ∈ {"completed", "cancelled", "extended"}.
        """
        counterpart_telegram_id = resolve_counterpart_telegram_id(task, actor)
        if counterpart_telegram_id is None:
            return
        text = build_counterpart_message(actor, action, task)
        await self._send_safe(
            counterpart_telegram_id, text, _task_callback_markup(task)
        )

    async def notify_reaction(self, session, event, reactor, emoji) -> None:
        """Ping the event author that someone reacted."""
        actor = await self.member_repo.get_by_id(session, event.actor_id)
        if not actor or not actor.telegram_id:
            return
        symbol = EMOJI_SYMBOLS.get(emoji, "👏")
        title = event.payload.get("task_title")
        what = f"твою задачу «{title}»" if title else "твою активность"
        await self._send_safe(
            actor.telegram_id, f"{symbol} {reactor.full_name} отметил {what}"
        )

    async def notify_kudos(self, session, event, giver) -> None:
        """Ping the kudos recipient that a colleague thanked them."""
        recipient_id = (event.payload or {}).get("recipient_id")
        if not recipient_id:
            return
        recipient = await self.member_repo.get_by_id(session, uuid.UUID(recipient_id))
        if not recipient or not recipient.telegram_id:
            return
        message = (event.payload or {}).get("message") or ""
        await self._send_safe(
            recipient.telegram_id, f"🙌 {giver.full_name} поблагодарил(а) тебя: «{message}»"
        )

    async def notify_task_assigned(
        self, session: AsyncSession, task: Task, assigned_by: TeamMember,
        new_assignee: TeamMember
    ) -> None:
        """Notify new assignee about reassignment."""
        if new_assignee.telegram_id and new_assignee.id != assigned_by.id:
            details = ["Срочно"] if is_task_urgent(task.priority) else []
            text = "\n".join(
                [
                    "🔄 Тебе переназначена задача:",
                    "",
                    f"#{task.short_id} · {task.title}",
                    *details,
                    f"👤 Назначил: {assigned_by.full_name}",
                ]
            )
            await self._send_safe(new_assignee.telegram_id, text, _task_callback_markup(task))

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
                await self._send_safe(member.telegram_id, text, _task_callback_markup(task))

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

    async def notify_report_collected(
        self,
        session: AsyncSession,
        metric: DailyMetric,
        prev_metric: DailyMetric | None,
        frontend_url: str = "http://localhost:3000",
    ) -> None:
        """Send report notification to Telegram targets of type 'report:getcourse'."""
        from decimal import Decimal

        def _delta(current, previous) -> str:
            if previous is None:
                return ""
            diff = current - previous
            if diff > 0:
                return f" \u2191{diff}"
            elif diff < 0:
                return f" \u2193{abs(diff)}"
            return " \u2192"

        def _money(value: Decimal) -> str:
            return f"{value:,.0f}\u20bd".replace(",", " ")

        date_str = metric.metric_date.strftime("%d.%m.%Y")
        prev = prev_metric

        lines = [
            f"\U0001f4ca \u041e\u0442\u0447\u0451\u0442 GetCourse \u0437\u0430 {date_str}",
            "",
            f"\U0001f464 \u041d\u043e\u0432\u044b\u0435 \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u0438: {metric.users_count}{_delta(metric.users_count, prev.users_count if prev else None)}",
            f"\U0001f4b3 \u041f\u043b\u0430\u0442\u0435\u0436\u0438: {metric.payments_count} \u043d\u0430 {_money(metric.payments_sum)}{_delta(metric.payments_sum, prev.payments_sum if prev else None)}",
            f"\U0001f4e6 \u0417\u0430\u043a\u0430\u0437\u044b: {metric.orders_count} \u043d\u0430 {_money(metric.orders_sum)}{_delta(metric.orders_sum, prev.orders_sum if prev else None)}",
        ]

        text = "\n".join(lines)
        markup = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(
                text="\U0001f4ca \u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0434\u0430\u0448\u0431\u043e\u0440\u0434",
                url=f"{frontend_url}/reports",
            )
        ]])

        targets = await self.target_repo.get_active_by_type(session, "report:getcourse")
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
                    "Failed to send report notification to chat %s: %s",
                    target.chat_id,
                    e,
                )

    async def _send_safe(
        self, chat_id: int, text: str, reply_markup: InlineKeyboardMarkup | None = None
    ) -> None:
        """Send message, suppress errors."""
        try:
            await self.bot.send_message(chat_id, text, reply_markup=reply_markup)
        except Exception as e:
            logger.warning(f"Failed to send notification to {chat_id}: {e}")
