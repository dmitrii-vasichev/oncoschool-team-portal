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
    waiting_for_update_payload = State()
    waiting_for_updates_task_id = State()
    waiting_for_blocker_payload = State()
    waiting_for_blocker_text = State()


def _parse_short_id(raw_value: str) -> int | None:
    try:
        return int(raw_value.strip().lstrip("#"))
    except ValueError:
        return None


def _parse_progress_payload(raw_text: str) -> tuple[str, int | None]:
    progress_percent = None
    percent_match = re.match(r"^(\d{1,3})\s*%\s*", raw_text)
    if percent_match:
        parsed_percent = int(percent_match.group(1))
        if parsed_percent <= 100:
            progress_percent = parsed_percent
            raw_text = raw_text[percent_match.end():].strip()
    return raw_text, progress_percent


async def _add_progress_update(
    *,
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    short_id: int,
    raw_text: str,
) -> bool:
    clean_text, progress_percent = _parse_progress_payload(raw_text)
    if not clean_text:
        await message.answer("❌ Текст обновления не может быть пустым")
        return False

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await message.answer(f"❌ Задача #{short_id} не найдена")
                return False

            try:
                task_update = await task_service.add_task_update(
                    session,
                    task=task,
                    member=member,
                    content=clean_text,
                    update_type="progress",
                    progress_percent=progress_percent,
                )
            except (PermissionError, ValueError) as e:
                await message.answer(f"❌ {e}")
                return False

            notification_service = NotificationService(bot)
            await notification_service.notify_task_update_added(
                session, task, task_update, member
            )

    progress_str = f"\n📊 Прогресс: {progress_percent}%" if progress_percent is not None else ""
    await message.answer(
        f"📝 Обновление добавлено к задаче #{short_id}:\n"
        f"{clean_text}{progress_str}"
    )
    return True


async def _show_updates_timeline(
    *,
    message: Message,
    session_maker: async_sessionmaker,
    short_id: int,
) -> bool:
    async with session_maker() as session:
        task = await task_service.get_task_by_short_id(session, short_id)
        if not task:
            await message.answer(f"❌ Задача #{short_id} не найдена")
            return False

        updates = await task_service.get_task_updates(session, task.id)

    if not updates:
        await message.answer(f"У задачи #{short_id} пока нет обновлений")
        return True

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
    return True


async def _add_blocker_update(
    *,
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    short_id: int,
    raw_text: str,
) -> bool:
    if not raw_text:
        await message.answer("❌ Описание блокера не может быть пустым")
        return False

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await message.answer(f"❌ Задача #{short_id} не найдена")
                return False

            try:
                task_update = await task_service.add_task_update(
                    session,
                    task=task,
                    member=member,
                    content=raw_text,
                    update_type="blocker",
                )
            except (PermissionError, ValueError) as e:
                await message.answer(f"❌ {e}")
                return False

            notification_service = NotificationService(bot)
            await notification_service.notify_task_update_added(
                session, task, task_update, member
            )

    await message.answer(f"🚫 Блокер добавлен к задаче #{short_id}:\n{raw_text}")
    return True


@router.message(TaskUpdateFSM.waiting_for_text, Command("cancel"))
@router.message(TaskUpdateFSM.waiting_for_update_payload, Command("cancel"))
@router.message(TaskUpdateFSM.waiting_for_updates_task_id, Command("cancel"))
@router.message(TaskUpdateFSM.waiting_for_blocker_payload, Command("cancel"))
@router.message(TaskUpdateFSM.waiting_for_blocker_text, Command("cancel"))
async def fsm_cancel(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("❌ Отменено")


# ── /update <id> [percent%] <текст> — промежуточный апдейт ──


@router.message(Command("update"))
async def cmd_update(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    args = (message.text or "").split(maxsplit=2)
    if len(args) < 2:
        await state.set_state(TaskUpdateFSM.waiting_for_update_payload)
        await message.answer(
            "📝 Введите обновление в формате:\n"
            "<id> <текст>\n\n"
            "Можно указать прогресс: 42 50% Половина готова\n"
            "Для отмены отправьте /cancel"
        )
        return

    if len(args) == 2:
        short_id = _parse_short_id(args[1])
        if short_id is None:
            await message.answer("❌ ID задачи должен быть числом")
            return

        await state.set_state(TaskUpdateFSM.waiting_for_text)
        await state.update_data(task_short_id=short_id)
        await message.answer(
            f"📝 Введите текст обновления для задачи #{short_id}.\n"
            "Можно начать с процента: 50% Сделал половину\n"
            "Для отмены отправьте /cancel"
        )
        return

    await state.clear()

    short_id = _parse_short_id(args[1])
    if short_id is None:
        await message.answer("❌ ID задачи должен быть числом")
        return

    await _add_progress_update(
        message=message,
        member=member,
        session_maker=session_maker,
        bot=bot,
        short_id=short_id,
        raw_text=args[2].strip(),
    )


@router.message(TaskUpdateFSM.waiting_for_update_payload)
async def fsm_receive_update_payload(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    payload = message.text.strip() if message.text else ""
    parts = payload.split(maxsplit=1)
    if len(parts) < 2:
        await message.answer("❌ Введите ID и текст обновления. Пример: 42 Сделал дизайн или /cancel")
        return

    short_id = _parse_short_id(parts[0])
    if short_id is None:
        await message.answer("❌ ID задачи должен быть числом. Попробуйте ещё раз или /cancel")
        return

    if await _add_progress_update(
        message=message,
        member=member,
        session_maker=session_maker,
        bot=bot,
        short_id=short_id,
        raw_text=parts[1].strip(),
    ):
        await state.clear()


# ── /updates <id> — timeline обновлений ──


@router.message(Command("updates"))
async def cmd_updates(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    state: FSMContext,
) -> None:
    args = (message.text or "").split(maxsplit=1)
    if len(args) < 2:
        await state.set_state(TaskUpdateFSM.waiting_for_updates_task_id)
        await message.answer(
            "📚 Введите ID задачи, чтобы показать историю апдейтов.\n"
            "Пример: 42\n"
            "Для отмены отправьте /cancel"
        )
        return

    await state.clear()

    short_id = _parse_short_id(args[1])
    if short_id is None:
        await message.answer("❌ ID задачи должен быть числом")
        return

    await _show_updates_timeline(
        message=message,
        session_maker=session_maker,
        short_id=short_id,
    )


@router.message(TaskUpdateFSM.waiting_for_updates_task_id)
async def fsm_receive_updates_task_id(
    message: Message,
    session_maker: async_sessionmaker,
    state: FSMContext,
) -> None:
    short_id = _parse_short_id(message.text or "")
    if short_id is None:
        await message.answer("❌ ID задачи должен быть числом. Попробуйте ещё раз или /cancel")
        return

    if await _show_updates_timeline(
        message=message,
        session_maker=session_maker,
        short_id=short_id,
    ):
        await state.clear()


# ── /blocker <id> <текст> — отметить блокер ──


@router.message(Command("blocker"))
async def cmd_blocker(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    args = (message.text or "").split(maxsplit=2)
    if len(args) < 2:
        await state.set_state(TaskUpdateFSM.waiting_for_blocker_payload)
        await message.answer(
            "🚫 Введите блокер в формате:\n"
            "<id> <описание>\n"
            "Пример: 42 Жду доступ к серверу\n"
            "Для отмены отправьте /cancel"
        )
        return

    if len(args) == 2:
        short_id = _parse_short_id(args[1])
        if short_id is None:
            await message.answer("❌ ID задачи должен быть числом")
            return

        await state.set_state(TaskUpdateFSM.waiting_for_blocker_text)
        await state.update_data(task_short_id=short_id)
        await message.answer(
            f"🚫 Введите описание блокера для задачи #{short_id}.\n"
            "Для отмены отправьте /cancel"
        )
        return

    await state.clear()

    short_id = _parse_short_id(args[1])
    if short_id is None:
        await message.answer("❌ ID задачи должен быть числом")
        return

    await _add_blocker_update(
        message=message,
        member=member,
        session_maker=session_maker,
        bot=bot,
        short_id=short_id,
        raw_text=args[2].strip(),
    )


@router.message(TaskUpdateFSM.waiting_for_blocker_payload)
async def fsm_receive_blocker_payload(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    payload = message.text.strip() if message.text else ""
    parts = payload.split(maxsplit=1)
    if len(parts) < 2:
        await message.answer("❌ Введите ID и текст блокера. Пример: 42 Жду доступ или /cancel")
        return

    short_id = _parse_short_id(parts[0])
    if short_id is None:
        await message.answer("❌ ID задачи должен быть числом. Попробуйте ещё раз или /cancel")
        return

    if await _add_blocker_update(
        message=message,
        member=member,
        session_maker=session_maker,
        bot=bot,
        short_id=short_id,
        raw_text=parts[1].strip(),
    ):
        await state.clear()


@router.message(TaskUpdateFSM.waiting_for_blocker_text)
async def fsm_receive_blocker_text(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    data = await state.get_data()
    short_id = data.get("task_short_id")
    if not isinstance(short_id, int):
        await state.clear()
        await message.answer("❌ Контекст блокера потерян. Вызовите /blocker заново")
        return

    raw_text = message.text.strip() if message.text else ""
    if not raw_text:
        await message.answer("❌ Описание блокера не может быть пустым. Попробуйте ещё раз или /cancel")
        return

    if await _add_blocker_update(
        message=message,
        member=member,
        session_maker=session_maker,
        bot=bot,
        short_id=short_id,
        raw_text=raw_text,
    ):
        await state.clear()


# ── Inline-кнопка "📝 Апдейт" → FSM → текст → TaskUpdate ──


@router.callback_query(F.data.startswith("task_update:"))
async def cb_task_update_start(
    callback: CallbackQuery,
    member: TeamMember,
    session_maker: async_sessionmaker,
    state: FSMContext,
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
        "Можно указать прогресс в начале: <code>50% Текст обновления</code>\n"
        "Для отмены отправь /cancel",
        parse_mode="HTML",
    )

@router.message(TaskUpdateFSM.waiting_for_text)
async def fsm_receive_update_text(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    data = await state.get_data()
    short_id = data.get("task_short_id")
    if not isinstance(short_id, int):
        await state.clear()
        await message.answer("❌ Контекст обновления потерян. Вызовите /update заново")
        return

    raw_text = message.text.strip() if message.text else ""
    if not raw_text:
        await message.answer("❌ Текст обновления не может быть пустым. Попробуй ещё раз или /cancel")
        return

    if await _add_progress_update(
        message=message,
        member=member,
        session_maker=session_maker,
        bot=bot,
        short_id=short_id,
        raw_text=raw_text,
    ):
        await state.clear()
