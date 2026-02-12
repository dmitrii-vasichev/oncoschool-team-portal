import logging
import re

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.db.models import TeamMember
from app.services.notification_service import NotificationService
from app.services.permission_service import PermissionService
from app.services.task_service import TaskService

logger = logging.getLogger(__name__)

router = Router()

task_service = TaskService()

UPDATE_TYPE_EMOJI = {
    "progress": "📊",
    "status_change": "🔄",
    "comment": "💬",
    "blocker": "🚫",
    "completion": "✅",
}


class TaskUpdateFSM(StatesGroup):
    waiting_for_text = State()


# ── /update <id> [percent%] <текст> — промежуточный апдейт ──


@router.message(Command("update"))
async def cmd_update(
    message: Message, member: TeamMember, session_maker: async_sessionmaker, bot: Bot
) -> None:
    args = message.text.split(maxsplit=2)
    if len(args) < 3:
        await message.answer(
            "Использование: /update <id> <текст>\n\n"
            "Опционально: /update 42 50% Половина готова\n"
            "Пример: /update 42 Сделал дизайн-макет"
        )
        return

    try:
        short_id = int(args[1].strip().lstrip("#"))
    except ValueError:
        await message.answer("❌ ID задачи должен быть числом")
        return

    raw_text = args[2].strip()

    # Parse optional progress percent at the start: "50% text" or "50 % text"
    progress_percent = None
    percent_match = re.match(r"^(\d{1,3})\s*%\s*", raw_text)
    if percent_match:
        progress_percent = int(percent_match.group(1))
        if progress_percent > 100:
            progress_percent = None
        else:
            raw_text = raw_text[percent_match.end():].strip()

    if not raw_text:
        await message.answer("❌ Текст обновления не может быть пустым")
        return

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await message.answer(f"❌ Задача #{short_id} не найдена")
                return

            try:
                task_update = await task_service.add_task_update(
                    session,
                    task=task,
                    member=member,
                    content=raw_text,
                    update_type="progress",
                    progress_percent=progress_percent,
                )
            except PermissionError as e:
                await message.answer(f"❌ {e}")
                return
            except ValueError as e:
                await message.answer(f"❌ {e}")
                return

            # Notify subscribers
            notification_service = NotificationService(bot)
            await notification_service.notify_task_update_added(
                session, task, task_update, member
            )

    progress_str = f"\n📊 Прогресс: {progress_percent}%" if progress_percent is not None else ""
    await message.answer(
        f"📝 Обновление добавлено к задаче #{short_id}:\n"
        f"{raw_text}{progress_str}"
    )


# ── /updates <id> — timeline обновлений ──


@router.message(Command("updates"))
async def cmd_updates(
    message: Message, member: TeamMember, session_maker: async_sessionmaker
) -> None:
    args = message.text.split(maxsplit=1)
    if len(args) < 2:
        await message.answer("Использование: /updates <id задачи>\nПример: /updates 42")
        return

    try:
        short_id = int(args[1].strip().lstrip("#"))
    except ValueError:
        await message.answer("❌ ID задачи должен быть числом")
        return

    async with session_maker() as session:
        task = await task_service.get_task_by_short_id(session, short_id)
        if not task:
            await message.answer(f"❌ Задача #{short_id} не найдена")
            return

        updates = await task_service.get_task_updates(session, task.id)

    if not updates:
        await message.answer(f"У задачи #{short_id} пока нет обновлений")
        return

    lines = [f"<b>📋 Timeline задачи #{short_id}:</b>"]
    lines.append(f"<b>{task.title}</b>\n")

    for upd in updates:
        emoji = UPDATE_TYPE_EMOJI.get(upd.update_type, "📝")
        author_name = upd.author.full_name if upd.author else "—"
        time_str = upd.created_at.strftime("%d.%m %H:%M")
        progress_str = f" · {upd.progress_percent}%" if upd.progress_percent is not None else ""

        lines.append(
            f"{emoji} <b>{time_str}</b> · {author_name}{progress_str}\n"
            f"   {upd.content}"
        )

    lines.append(f"\nВсего обновлений: {len(updates)}")

    await message.answer("\n".join(lines), parse_mode="HTML")


# ── /blocker <id> <текст> — отметить блокер ──


@router.message(Command("blocker"))
async def cmd_blocker(
    message: Message, member: TeamMember, session_maker: async_sessionmaker, bot: Bot
) -> None:
    args = message.text.split(maxsplit=2)
    if len(args) < 3:
        await message.answer(
            "Использование: /blocker <id> <описание блокера>\n"
            "Пример: /blocker 42 Жду доступ к серверу"
        )
        return

    try:
        short_id = int(args[1].strip().lstrip("#"))
    except ValueError:
        await message.answer("❌ ID задачи должен быть числом")
        return

    raw_text = args[2].strip()

    if not raw_text:
        await message.answer("❌ Описание блокера не может быть пустым")
        return

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await message.answer(f"❌ Задача #{short_id} не найдена")
                return

            try:
                task_update = await task_service.add_task_update(
                    session,
                    task=task,
                    member=member,
                    content=raw_text,
                    update_type="blocker",
                )
            except PermissionError as e:
                await message.answer(f"❌ {e}")
                return

            # Notify subscribers
            notification_service = NotificationService(bot)
            await notification_service.notify_task_update_added(
                session, task, task_update, member
            )

    await message.answer(
        f"🚫 Блокер добавлен к задаче #{short_id}:\n{raw_text}"
    )


# ── Inline-кнопка "📝 Апдейт" → FSM → текст → TaskUpdate ──


@router.callback_query(F.data.startswith("task_update:"))
async def cb_task_update_start(
    callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker,
    state: FSMContext
) -> None:
    short_id = int(callback.data.split(":")[1])

    async with session_maker() as session:
        task = await task_service.get_task_by_short_id(session, short_id)
        if not task:
            await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
            return

        if not PermissionService.can_add_task_update(member, task):
            await callback.answer("Нет прав на добавление обновления", show_alert=True)
            return

    await state.set_state(TaskUpdateFSM.waiting_for_text)
    await state.update_data(task_short_id=short_id)

    await callback.answer()
    await callback.message.answer(
        f"📝 Введи текст обновления для задачи #{short_id}:\n\n"
        f"Можно указать прогресс в начале: <code>50% Текст обновления</code>\n"
        f"Для отмены отправь /cancel",
        parse_mode="HTML",
    )


@router.message(TaskUpdateFSM.waiting_for_text, Command("cancel"))
async def fsm_cancel(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("❌ Отменено")


@router.message(TaskUpdateFSM.waiting_for_text)
async def fsm_receive_update_text(
    message: Message, member: TeamMember, session_maker: async_sessionmaker,
    bot: Bot, state: FSMContext
) -> None:
    data = await state.get_data()
    short_id = data["task_short_id"]
    raw_text = message.text.strip() if message.text else ""

    if not raw_text:
        await message.answer("❌ Текст обновления не может быть пустым. Попробуй ещё раз или /cancel")
        return

    # Parse optional progress percent
    progress_percent = None
    percent_match = re.match(r"^(\d{1,3})\s*%\s*", raw_text)
    if percent_match:
        progress_percent = int(percent_match.group(1))
        if progress_percent > 100:
            progress_percent = None
        else:
            raw_text = raw_text[percent_match.end():].strip()

    if not raw_text:
        await message.answer("❌ Текст обновления не может быть пустым. Попробуй ещё раз или /cancel")
        return

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await state.clear()
                await message.answer(f"❌ Задача #{short_id} не найдена")
                return

            try:
                task_update = await task_service.add_task_update(
                    session,
                    task=task,
                    member=member,
                    content=raw_text,
                    update_type="progress",
                    progress_percent=progress_percent,
                )
            except PermissionError as e:
                await state.clear()
                await message.answer(f"❌ {e}")
                return

            # Notify subscribers
            notification_service = NotificationService(bot)
            await notification_service.notify_task_update_added(
                session, task, task_update, member
            )

    await state.clear()
    progress_str = f"\n📊 Прогресс: {progress_percent}%" if progress_percent is not None else ""
    await message.answer(
        f"📝 Обновление добавлено к задаче #{short_id}:\n"
        f"{raw_text}{progress_str}"
    )
