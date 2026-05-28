"""Bot handlers for acting on long-overdue (escalated) tasks via inline buttons.

The aiogram callback handlers here are intentionally thin glue. All reusable
logic lives in pure, importable helpers (``parse_escalation_callback``,
``build_escalation_dm_text``) that are unit-tested without a bot or DB.
"""

import logging

from aiogram import Bot, F, Router
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.bot.keyboards import (
    escalation_actions_keyboard,
    escalation_cancel_reason_keyboard,
    escalation_extend_keyboard,
)
from app.db.models import TeamMember
from app.services.notification_service import NotificationService
from app.services.task_service import TaskService

logger = logging.getLogger(__name__)

router = Router()

task_service = TaskService()

# Escalation callback prefix and the actions it carries.
_PREFIX = "esc"
_SIMPLE_ACTIONS = frozenset({"complete", "cancel", "extend", "back"})
_PAYLOAD_ACTIONS = frozenset({"extdays", "reason"})
_VALID_EXTEND_DAYS = frozenset({7, 14, 30})

# Human-readable terminal-state notice shown when a task is no longer actionable.
_NOT_ACTIONABLE = "Эта задача уже завершена или отменена — действие не требуется."


class EscalationFSM(StatesGroup):
    waiting_for_cancel_text = State()


# ──────────────────────────────────────────────────────────────────────────
#  Pure helpers (unit-tested)
# ──────────────────────────────────────────────────────────────────────────


def parse_escalation_callback(data: str) -> tuple[str, int, int | str | None]:
    """Parse an escalation callback_data string.

    Returns ``(action, short_id, payload)`` where ``payload`` is:
      - the extension days (int) for ``extdays``,
      - the cancellation reason (str) for ``reason``,
      - ``None`` for ``complete``/``cancel``/``extend``/``back``.

    Raises ``ValueError`` on a malformed or unrecognised string.
    """
    parts = data.split(":")
    if len(parts) < 3 or parts[0] != _PREFIX:
        raise ValueError(f"Not an escalation callback: {data!r}")

    action = parts[1]
    try:
        short_id = int(parts[2])
    except ValueError as exc:
        raise ValueError(f"Invalid short_id in callback: {data!r}") from exc

    if action in _SIMPLE_ACTIONS:
        return action, short_id, None

    if action == "extdays":
        if len(parts) != 4:
            raise ValueError(f"extdays callback missing days: {data!r}")
        try:
            days = int(parts[3])
        except ValueError as exc:
            raise ValueError(f"Invalid days in callback: {data!r}") from exc
        return action, short_id, days

    if action == "reason":
        if len(parts) != 4:
            raise ValueError(f"reason callback missing reason: {data!r}")
        return action, short_id, parts[3]

    raise ValueError(f"Unknown escalation action: {action!r}")


def build_escalation_dm_text(task_like, days_overdue: int, is_repeat: bool) -> str:
    """Build the escalation DM body.

    Pure and aiogram-free so the reminder job (Task 12) can reuse it. ``task_like``
    only needs ``short_id``, ``title`` and ``deadline`` (a date or None).
    """
    if is_repeat:
        intro = "⚠️ Прошла ещё неделя — задача всё ещё висит без движения"
    else:
        intro = f"⚠️ Задача висит уже {days_overdue} дней без движения"

    deadline = getattr(task_like, "deadline", None)
    if deadline is not None:
        deadline_line = (
            f"📅 Дедлайн был: {deadline.strftime('%d.%m.%Y')} "
            f"({days_overdue} дней назад)"
        )
    else:
        deadline_line = f"📅 Без дедлайна · {days_overdue} дней без движения"

    return (
        f"{intro}\n\n"
        f"#{task_like.short_id} · {task_like.title}\n"
        f"{deadline_line}\n\n"
        f"Что делаем?"
    )


# ──────────────────────────────────────────────────────────────────────────
#  Callback handlers (thin glue)
# ──────────────────────────────────────────────────────────────────────────


@router.callback_query(F.data.startswith("esc:complete:"))
async def cb_escalation_complete(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
) -> None:
    _, short_id, _ = parse_escalation_callback(callback.data)
    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if task is None or task.status in ("done", "cancelled"):
                await _finish_not_actionable(callback)
                return
            try:
                task = await task_service.complete_task(session, task, member)
            except PermissionError as exc:
                await callback.answer(str(exc), show_alert=True)
                return
            notification_service = NotificationService(bot)
            await notification_service.notify_escalation_action(
                session, task, member, "completed"
            )
    await callback.message.edit_text(f"✅ Задача #{short_id} завершена")
    await callback.answer()


@router.callback_query(F.data.startswith("esc:extend:"))
async def cb_escalation_extend(callback: CallbackQuery) -> None:
    _, short_id, _ = parse_escalation_callback(callback.data)
    await callback.message.edit_reply_markup(
        reply_markup=escalation_extend_keyboard(short_id)
    )
    await callback.answer()


@router.callback_query(F.data.startswith("esc:extdays:"))
async def cb_escalation_extend_days(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
) -> None:
    _, short_id, days = parse_escalation_callback(callback.data)
    if days not in _VALID_EXTEND_DAYS:
        await callback.answer("Недопустимый срок продления", show_alert=True)
        return
    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if task is None or task.status in ("done", "cancelled"):
                await _finish_not_actionable(callback)
                return
            try:
                task = await task_service.extend_deadline(
                    session, task, member, days
                )
            except (PermissionError, ValueError) as exc:
                await callback.answer(str(exc), show_alert=True)
                return
            new_deadline = task.deadline
            notification_service = NotificationService(bot)
            await notification_service.notify_escalation_action(
                session, task, member, "extended"
            )
    deadline_str = new_deadline.strftime("%d.%m.%Y") if new_deadline else "—"
    await callback.message.edit_text(f"⏰ Продлено до {deadline_str}")
    await callback.answer()


@router.callback_query(F.data.startswith("esc:cancel:"))
async def cb_escalation_cancel(callback: CallbackQuery) -> None:
    _, short_id, _ = parse_escalation_callback(callback.data)
    await callback.message.edit_reply_markup(
        reply_markup=escalation_cancel_reason_keyboard(short_id)
    )
    await callback.answer()


@router.callback_query(F.data.startswith("esc:reason:"))
async def cb_escalation_reason(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    _, short_id, reason = parse_escalation_callback(callback.data)

    if reason == "other":
        await state.set_state(EscalationFSM.waiting_for_cancel_text)
        await state.update_data(esc_short_id=short_id)
        await callback.message.edit_text(
            "Опиши причину одним сообщением (или /cancel чтобы отменить действие)"
        )
        await callback.answer()
        return

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if task is None or task.status in ("done", "cancelled"):
                await _finish_not_actionable(callback)
                return
            try:
                task = await task_service.cancel_task(
                    session, task, member, reason=reason
                )
            except (PermissionError, ValueError) as exc:
                await callback.answer(str(exc), show_alert=True)
                return
            notification_service = NotificationService(bot)
            await notification_service.notify_escalation_action(
                session, task, member, "cancelled"
            )
    await callback.message.edit_text(f"❌ Задача #{short_id} отменена")
    await callback.answer()


@router.callback_query(F.data.startswith("esc:back:"))
async def cb_escalation_back(callback: CallbackQuery) -> None:
    _, short_id, _ = parse_escalation_callback(callback.data)
    await callback.message.edit_reply_markup(
        reply_markup=escalation_actions_keyboard(short_id)
    )
    await callback.answer()


@router.message(EscalationFSM.waiting_for_cancel_text)
async def fsm_escalation_cancel_text(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    data = await state.get_data()
    short_id = data.get("esc_short_id")
    await state.clear()

    reason_text = (message.text or "").strip()
    if not reason_text:
        await message.answer("❌ Причина не может быть пустой. Действие отменено.")
        return

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if task is None or task.status in ("done", "cancelled"):
                await message.answer(_NOT_ACTIONABLE)
                return
            try:
                task = await task_service.cancel_task(
                    session, task, member, reason="other", reason_text=reason_text
                )
            except (PermissionError, ValueError) as exc:
                await message.answer(f"❌ {exc}")
                return
            notification_service = NotificationService(bot)
            await notification_service.notify_escalation_action(
                session, task, member, "cancelled"
            )
    await message.answer(f"❌ Задача #{short_id} отменена")


async def _finish_not_actionable(callback: CallbackQuery) -> None:
    """Edit the message to a terminal-state notice and ack the callback."""
    await callback.message.edit_text(_NOT_ACTIONABLE)
    await callback.answer()
