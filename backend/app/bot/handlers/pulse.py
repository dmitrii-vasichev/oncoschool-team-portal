"""Bot handlers for Team Pulse reactions on the company digest (Task 13).

The aiogram callback handler here is thin glue. The reusable parsing logic
lives in the pure, importable ``parse_pulse_callback`` helper, which is unit
tested without a bot or DB (mirrors ``parse_escalation_callback``).
"""

import logging
import uuid

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.bot.handlers.task_updates import TaskUpdateFSM
from app.db.models import TeamMember
from app.db.repositories import NotificationSubscriptionRepository
from app.services.activity_service import ActivityService
from app.services.notification_service import NotificationService
from app.services.task_service import TaskService

logger = logging.getLogger(__name__)

router = Router()

activity_service = ActivityService()
task_service = TaskService()
sub_repo = NotificationSubscriptionRepository()

_PREFIX = "pulse"

# One-tap task-update actions carried on the personal morning digest.
_TASK_ACTIONS = frozenset({"done", "wip", "blk"})


# ──────────────────────────────────────────────────────────────────────────
#  Pure helper (unit-tested)
# ──────────────────────────────────────────────────────────────────────────


def parse_pulse_callback(data: str) -> tuple[str, str, str | None]:
    """Parse a ``pulse:*`` callback_data string into ``(action, arg, extra)``.

    Two forms are supported:
      - ``pulse:react:<emoji>:<event_id>`` (4 parts) -> ``("react", emoji, event_id)``;
      - ``pulse:done|wip|blk:<short_id>`` (3 parts) -> ``(action, short_id_str, None)``.

    Raises ``ValueError`` on a malformed or unrecognised string.
    """
    parts = data.split(":")
    if len(parts) < 3 or parts[0] != _PREFIX:
        raise ValueError(f"Not a pulse callback: {data!r}")
    action = parts[1]
    if action == "react":
        if len(parts) != 4:
            raise ValueError(f"Bad pulse react callback: {data!r}")
        return ("react", parts[2], parts[3])
    if action in _TASK_ACTIONS:
        if len(parts) != 3:
            raise ValueError(f"Bad pulse callback: {data!r}")
        return (action, parts[2], None)
    raise ValueError(f"Unknown pulse action: {action!r}")


# ──────────────────────────────────────────────────────────────────────────
#  Member-facing toggle: opt OUT of the personal Pulse digest block (Task 16)
# ──────────────────────────────────────────────────────────────────────────


@router.message(Command("pulse"))
async def cmd_pulse_toggle(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    """Toggle the personal Pulse digest block on/off (opt-OUT, ON by default)."""
    async with session_maker() as session:
        async with session.begin():
            subs = await sub_repo.get_by_member(session, member.id)
            current = True
            for s in subs:
                if s.event_type == "pulse_personal":
                    current = s.is_active
                    break
            new_state = not current
            await sub_repo.upsert(session, member.id, "pulse_personal", new_state)
    if new_state:
        await message.answer(
            "🔔 Блок Team Pulse в ежедневном дайджесте включён."
        )
    else:
        await message.answer(
            "🔕 Блок Team Pulse в дайджесте выключен. Включить снова — /pulse"
        )


# ──────────────────────────────────────────────────────────────────────────
#  Callback handler (thin glue)
# ──────────────────────────────────────────────────────────────────────────


@router.callback_query(F.data.startswith("pulse:react:"))
async def cb_pulse_react(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
) -> None:
    try:
        _, emoji, event_id_str = parse_pulse_callback(callback.data)
        event_id = uuid.UUID(event_id_str)
    except (ValueError, AttributeError):
        await callback.answer("Некорректная реакция", show_alert=False)
        return

    async with session_maker() as session:
        async with session.begin():
            try:
                result = await activity_service.toggle_reaction(
                    session, event_id, member, emoji
                )
            except ValueError:
                await callback.answer("Событие не найдено", show_alert=False)
                return
            if result["actor_id_to_ping"] is not None:
                await NotificationService(bot).notify_reaction(
                    session, result["event"], member, emoji
                )

    await callback.answer("👏 Спасибо!" if result["added"] else "Реакция снята")


# ──────────────────────────────────────────────────────────────────────────
#  One-tap task-update handlers (thin glue over TaskService / the blocker FSM)
# ──────────────────────────────────────────────────────────────────────────


def _parse_pulse_short_id(data: str) -> int | None:
    """Extract the integer short_id from a one-tap pulse callback, or ``None``."""
    try:
        _, short_id_str, _ = parse_pulse_callback(data or "")
        return int(short_id_str)
    except (ValueError, AttributeError):
        return None


@router.callback_query(F.data.startswith("pulse:done:"))
async def cb_pulse_done(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
) -> None:
    short_id = _parse_pulse_short_id(callback.data)
    if short_id is None:
        await callback.answer("Некорректная задача", show_alert=False)
        return

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if task is None or task.status in ("done", "cancelled"):
                await callback.answer("Задача недоступна", show_alert=False)
                return
            try:
                await task_service.complete_task(session, task, member)
            except PermissionError as exc:
                await callback.answer(str(exc), show_alert=True)
                return
    await callback.answer("✅ Готово")


@router.callback_query(F.data.startswith("pulse:wip:"))
async def cb_pulse_wip(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
) -> None:
    short_id = _parse_pulse_short_id(callback.data)
    if short_id is None:
        await callback.answer("Некорректная задача", show_alert=False)
        return

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if task is None or task.status in ("done", "cancelled", "in_progress"):
                await callback.answer("Задача недоступна", show_alert=False)
                return
            try:
                await task_service.update_status(session, task, member, "in_progress")
            except PermissionError as exc:
                await callback.answer(str(exc), show_alert=True)
                return
    await callback.answer("⏳ В работе")


@router.callback_query(F.data.startswith("pulse:blk:"))
async def cb_pulse_blk(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    short_id = _parse_pulse_short_id(callback.data)
    if short_id is None:
        await callback.answer("Некорректная задача", show_alert=False)
        return

    # Reuse the existing blocker FSM (app.bot.handlers.task_updates):
    # the next text message is captured by ``fsm_receive_blocker_text`` which
    # creates the blocker TaskUpdate (and emits the ``blocker_raised`` event).
    await state.set_state(TaskUpdateFSM.waiting_for_blocker_text)
    await state.update_data(task_short_id=short_id)
    await callback.message.answer(
        f"🚫 Опишите блокер для задачи #{short_id}. /cancel для отмены"
    )
    await callback.answer()
