import logging
import uuid
from datetime import date

from aiogram import Bot, F, Router
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.bot.callbacks import (
    TaskBackToListCallback,
    TaskCardCallback,
    TaskListCallback,
    TaskListFilter,
    TaskListScope,
    TaskRefreshListCallback,
)
from app.bot.filters import IsModeratorFilter
from app.bot.keyboards import (
    TASK_FILTER_LABELS,
    task_actions_keyboard,
    task_card_keyboard,
    task_list_keyboard,
)
from app.db.models import TeamMember
from app.db.repositories import TaskRepository, TeamMemberRepository
from app.services.notification_service import NotificationService
from app.services.permission_service import PermissionService
from app.services.task_service import TaskService

logger = logging.getLogger(__name__)

router = Router()

task_service = TaskService()
task_repo = TaskRepository()
member_repo = TeamMemberRepository()
TASKS_PER_PAGE = 8
LEGACY_TASK_FILTER_ALIASES = {
    TaskListFilter.ACTIVE: TaskListFilter.ALL,
}

PRIORITY_EMOJI = {
    "urgent": "🔴",
    "high": "⚡",
    "medium": "🔵",
    "low": "⚪",
}

STATUS_EMOJI = {
    "new": "🆕",
    "in_progress": "▶️",
    "review": "👀",
    "done": "✅",
    "cancelled": "❌",
}


STATUS_USAGE_TEXT = (
    "Использование: /status <id> <статус>\n\n"
    "Статусы: new, in_progress, review, done, cancelled\n"
    "Пример: /status 42 in_progress"
)


class TaskCommandFSM(StatesGroup):
    waiting_new_text = State()
    waiting_done_id = State()
    waiting_status_payload = State()


def _parse_short_id(raw_value: str) -> int | None:
    try:
        return int(raw_value.strip().lstrip("#"))
    except ValueError:
        return None


async def _create_task_for_member(
    *,
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    raw_text: str,
) -> bool:
    parsed = TaskService.parse_task_text(raw_text)
    if not parsed["title"]:
        await message.answer("❌ Текст задачи не может быть пустым")
        return False

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.create_task(
                session,
                title=parsed["title"],
                creator=member,
                priority=parsed["priority"],
                deadline=parsed["deadline"],
                source="text",
            )

            notification_service = NotificationService(bot)
            await notification_service.notify_task_created(session, task, member)

    is_mod = PermissionService.is_moderator(member)
    prio = PRIORITY_EMOJI.get(task.priority, "")
    deadline_str = f"\n📅 Дедлайн: {task.deadline.strftime('%d.%m.%Y')}" if task.deadline else ""

    await message.answer(
        "✅ Задача создана:\n\n"
        f"#{task.short_id} · {task.title}\n"
        f"{prio} {task.priority}{deadline_str}",
        reply_markup=task_actions_keyboard(task.short_id, is_mod),
    )
    return True


async def _complete_task_by_short_id(
    *,
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    short_id: int,
) -> bool:
    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await message.answer(f"❌ Задача #{short_id} не найдена")
                return False

            if task.status == "done":
                await message.answer(f"Задача #{short_id} уже завершена")
                return False

            try:
                old_status = task.status
                task = await task_service.complete_task(session, task, member)
            except PermissionError as e:
                await message.answer(f"❌ {e}")
                return False

            notification_service = NotificationService(bot)
            await notification_service.notify_task_completed(session, task, member)
            await notification_service.notify_status_changed(
                session, task, member, old_status, "done"
            )

    await message.answer(f"✅ Задача #{task.short_id} завершена!\n{task.title}")
    return True


async def _update_task_status(
    *,
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    short_id: int,
    new_status: str,
) -> bool:
    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await message.answer(f"❌ Задача #{short_id} не найдена")
                return False

            old_status = task.status

            try:
                task = await task_service.update_status(session, task, member, new_status)
            except (PermissionError, ValueError) as e:
                await message.answer(f"❌ {e}")
                return False

            notification_service = NotificationService(bot)
            await notification_service.notify_status_changed(
                session, task, member, old_status, new_status
            )
            if new_status == "done":
                await notification_service.notify_task_completed(session, task, member)

    status_em = STATUS_EMOJI.get(new_status, "🔄")
    await message.answer(
        f"{status_em} Статус задачи #{task.short_id} изменён:\n"
        f"{old_status} → {new_status}\n"
        f"{task.title}"
    )
    return True


def _format_task_detail(task) -> str:
    """Format task details."""
    prio = PRIORITY_EMOJI.get(task.priority, "")
    status_em = STATUS_EMOJI.get(task.status, "")
    source_icon = "🎤 " if task.source == "voice" else ""
    assignee_name = task.assignee.full_name if task.assignee else "—"
    creator_name = task.created_by.full_name if task.created_by else "—"
    deadline_str = task.deadline.strftime("%d.%m.%Y") if task.deadline else "—"

    text = (
        f"{source_icon}<b>#{task.short_id} · {task.title}</b>\n\n"
        f"{status_em} Статус: {task.status}\n"
        f"{prio} Приоритет: {task.priority}\n"
        f"👤 Исполнитель: {assignee_name}\n"
        f"📝 Создал: {creator_name}\n"
        f"📅 Дедлайн: {deadline_str}\n"
        f"📆 Создана: {task.created_at.strftime('%d.%m.%Y %H:%M')}"
    )
    if task.description:
        text += f"\n\n📋 {task.description}"
    return text


def _normalize_task_filter(task_filter: TaskListFilter) -> TaskListFilter:
    """Map legacy filter values to current UI filter set."""
    return LEGACY_TASK_FILTER_ALIASES.get(task_filter, task_filter)


def _is_task_overdue(task) -> bool:
    if not task.deadline:
        return False
    if task.status in ("done", "cancelled"):
        return False
    return task.deadline < date.today()


def _filter_tasks(tasks: list, task_filter: TaskListFilter) -> list:
    normalized = _normalize_task_filter(task_filter)
    if normalized == TaskListFilter.ALL:
        return list(tasks)
    if normalized in (TaskListFilter.NEW, TaskListFilter.IN_PROGRESS, TaskListFilter.REVIEW):
        return [task for task in tasks if task.status == normalized.value]
    if normalized == TaskListFilter.OVERDUE:
        return [task for task in tasks if _is_task_overdue(task)]
    if normalized in (TaskListFilter.DONE, TaskListFilter.CANCELLED):
        return [task for task in tasks if task.status == normalized.value]
    return list(tasks)


def _paginate_tasks(tasks: list, page: int) -> tuple[list, int, int]:
    total_pages = max(1, (len(tasks) + TASKS_PER_PAGE - 1) // TASKS_PER_PAGE)
    safe_page = min(max(1, page), total_pages)
    start = (safe_page - 1) * TASKS_PER_PAGE
    end = start + TASKS_PER_PAGE
    return tasks[start:end], safe_page, total_pages


def _scope_title(scope: TaskListScope) -> str:
    return "Мои задачи" if scope == TaskListScope.MY else "Все задачи команды"


def _format_list_caption(
    scope: TaskListScope,
    task_filter: TaskListFilter,
    page: int,
    total_pages: int,
    total_tasks: int,
    page_tasks_count: int,
) -> str:
    filter_label = TASK_FILTER_LABELS.get(task_filter, task_filter.value)
    lines = [
        f"<b>📋 {_scope_title(scope)}</b>",
        f"Фильтр: <b>{filter_label}</b>",
        f"Страница: {page}/{total_pages} · Всего: {total_tasks}",
        "",
    ]
    if page_tasks_count:
        lines.append("Выбери задачу из списка ниже:")
    else:
        lines.append("По этому фильтру задач нет.")
    return "\n".join(lines)


async def _load_scope_tasks(
    session_maker: async_sessionmaker,
    scope: TaskListScope,
    member: TeamMember,
) -> list:
    async with session_maker() as session:
        if scope == TaskListScope.MY:
            return await task_service.get_my_tasks(session, member.id)
        return await task_service.get_all_active_tasks(session)


async def _build_task_list_view(
    session_maker: async_sessionmaker,
    scope: TaskListScope,
    member: TeamMember,
    task_filter: TaskListFilter,
    page: int,
) -> tuple[str, InlineKeyboardMarkup]:
    normalized_filter = _normalize_task_filter(task_filter)
    tasks = await _load_scope_tasks(session_maker, scope, member)
    filtered_tasks = _filter_tasks(tasks, normalized_filter)
    page_tasks, safe_page, total_pages = _paginate_tasks(filtered_tasks, page)

    text = _format_list_caption(
        scope=scope,
        task_filter=normalized_filter,
        page=safe_page,
        total_pages=total_pages,
        total_tasks=len(filtered_tasks),
        page_tasks_count=len(page_tasks),
    )
    keyboard = task_list_keyboard(
        page_tasks,
        scope=scope,
        current_filter=normalized_filter,
        page=safe_page,
        total_pages=total_pages,
    )
    return text, keyboard


async def _safe_edit_text(
    message: Message,
    text: str,
    reply_markup: InlineKeyboardMarkup | None = None,
    parse_mode: str | None = None,
) -> None:
    try:
        await message.edit_text(
            text=text,
            parse_mode=parse_mode,
            reply_markup=reply_markup,
        )
    except TelegramBadRequest as exc:
        if "message is not modified" not in str(exc).lower():
            raise
        if reply_markup is None:
            return
        try:
            await message.edit_reply_markup(reply_markup=reply_markup)
        except TelegramBadRequest as markup_exc:
            if "message is not modified" not in str(markup_exc).lower():
                raise


def _extract_list_context_from_markup(
    markup: InlineKeyboardMarkup | None,
) -> tuple[TaskListScope, TaskListFilter, int] | None:
    if not markup:
        return None

    for row in markup.inline_keyboard:
        for button in row:
            data = button.callback_data or ""
            if data.startswith("tback:"):
                try:
                    parsed = TaskBackToListCallback.unpack(data)
                except ValueError:
                    continue
                return (
                    parsed.scope,
                    _normalize_task_filter(parsed.task_filter),
                    max(1, parsed.page),
                )

            # Back callback from reassignment flow may carry list context.
            if data.startswith("task_back:"):
                parts = data.split(":")
                if len(parts) >= 5:
                    try:
                        scope = TaskListScope(parts[2])
                        task_filter = _normalize_task_filter(TaskListFilter(parts[3]))
                        page = max(1, int(parts[4]))
                    except (TypeError, ValueError):
                        continue
                    return (scope, task_filter, page)
    return None


def _task_back_callback_data(
    short_id: int,
    context: tuple[TaskListScope, TaskListFilter, int] | None = None,
) -> str:
    if not context:
        return f"task_back:{short_id}"
    scope, task_filter, page = context
    return f"task_back:{short_id}:{scope.value}:{task_filter.value}:{page}"


def _parse_task_back_callback_data(
    callback_data: str,
) -> tuple[int, tuple[TaskListScope, TaskListFilter, int] | None]:
    parts = callback_data.split(":")
    short_id = int(parts[1])
    if len(parts) < 5:
        return short_id, None

    try:
        scope = TaskListScope(parts[2])
        task_filter = _normalize_task_filter(TaskListFilter(parts[3]))
        page = max(1, int(parts[4]))
    except (TypeError, ValueError):
        return short_id, None

    return short_id, (scope, task_filter, page)


def _task_detail_keyboard(
    task_id: int,
    is_moderator: bool,
    context: tuple[TaskListScope, TaskListFilter, int] | None = None,
) -> InlineKeyboardMarkup:
    if not context:
        return task_actions_keyboard(task_id, is_moderator)
    scope, task_filter, page = context
    return task_card_keyboard(
        task_id=task_id,
        is_moderator=is_moderator,
        scope=scope,
        current_filter=task_filter,
        page=page,
    )


# ── /tasks — Мои задачи ──


@router.message(Command("tasks"))
async def cmd_tasks(message: Message, member: TeamMember, session_maker: async_sessionmaker) -> None:
    text, keyboard = await _build_task_list_view(
        session_maker=session_maker,
        scope=TaskListScope.MY,
        member=member,
        task_filter=TaskListFilter.ALL,
        page=1,
    )
    await message.answer(text, parse_mode="HTML", reply_markup=keyboard)


# ── /all — Все задачи команды ──


@router.message(Command("all"))
async def cmd_all(message: Message, member: TeamMember, session_maker: async_sessionmaker) -> None:
    text, keyboard = await _build_task_list_view(
        session_maker=session_maker,
        scope=TaskListScope.TEAM,
        member=member,
        task_filter=TaskListFilter.ALL,
        page=1,
    )
    await message.answer(text, parse_mode="HTML", reply_markup=keyboard)


@router.callback_query(TaskListCallback.filter())
async def cb_task_list(
    callback: CallbackQuery,
    callback_data: TaskListCallback,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    text, keyboard = await _build_task_list_view(
        session_maker=session_maker,
        scope=callback_data.scope,
        member=member,
        task_filter=callback_data.task_filter,
        page=callback_data.page,
    )
    await _safe_edit_text(callback.message, text, reply_markup=keyboard, parse_mode="HTML")
    await callback.answer()


@router.callback_query(TaskRefreshListCallback.filter())
async def cb_task_list_refresh(
    callback: CallbackQuery,
    callback_data: TaskRefreshListCallback,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    text, keyboard = await _build_task_list_view(
        session_maker=session_maker,
        scope=callback_data.scope,
        member=member,
        task_filter=callback_data.task_filter,
        page=callback_data.page,
    )
    await _safe_edit_text(callback.message, text, reply_markup=keyboard, parse_mode="HTML")
    await callback.answer("Обновлено")


@router.callback_query(TaskCardCallback.filter())
async def cb_task_card_open(
    callback: CallbackQuery,
    callback_data: TaskCardCallback,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    normalized_filter = _normalize_task_filter(callback_data.task_filter)

    async with session_maker() as session:
        task = await task_service.get_task_by_short_id(session, callback_data.short_id)

    if not task:
        await callback.answer("Задача уже недоступна", show_alert=True)
        text, keyboard = await _build_task_list_view(
            session_maker=session_maker,
            scope=callback_data.scope,
            member=member,
            task_filter=normalized_filter,
            page=callback_data.page,
        )
        await _safe_edit_text(callback.message, text, reply_markup=keyboard, parse_mode="HTML")
        return

    is_mod = PermissionService.is_moderator(member)
    await _safe_edit_text(
        callback.message,
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=task_card_keyboard(
            task_id=task.short_id,
            is_moderator=is_mod,
            scope=callback_data.scope,
            current_filter=normalized_filter,
            page=max(1, callback_data.page),
        ),
    )
    await callback.answer()


@router.callback_query(TaskBackToListCallback.filter())
async def cb_task_back_to_list(
    callback: CallbackQuery,
    callback_data: TaskBackToListCallback,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    text, keyboard = await _build_task_list_view(
        session_maker=session_maker,
        scope=callback_data.scope,
        member=member,
        task_filter=callback_data.task_filter,
        page=callback_data.page,
    )
    await _safe_edit_text(callback.message, text, reply_markup=keyboard, parse_mode="HTML")
    await callback.answer()


# ── /new <текст> — Создать задачу себе ──


@router.message(Command("new"))
async def cmd_new(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    args = (message.text or "").split(maxsplit=1)
    if len(args) < 2:
        await state.set_state(TaskCommandFSM.waiting_new_text)
        await message.answer(
            "📝 Введите текст новой задачи.\n"
            "Модификаторы: !urgent !high !low @ДД.ММ\n"
            "Для отмены отправьте /cancel"
        )
        return

    await state.clear()
    await _create_task_for_member(
        message=message,
        member=member,
        session_maker=session_maker,
        bot=bot,
        raw_text=args[1].strip(),
    )


@router.message(TaskCommandFSM.waiting_new_text, Command("cancel"))
async def fsm_cancel_new(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("❌ Создание задачи отменено")


@router.message(TaskCommandFSM.waiting_new_text)
async def fsm_new_text(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    raw_text = message.text.strip() if message.text else ""
    if not raw_text:
        await message.answer("❌ Текст задачи не может быть пустым. Попробуйте ещё раз или /cancel")
        return

    if await _create_task_for_member(
        message=message,
        member=member,
        session_maker=session_maker,
        bot=bot,
        raw_text=raw_text,
    ):
        await state.clear()


# ── /assign @username <текст> — Назначить задачу (МОДЕРАТОР) ──


@router.message(Command("assign"), IsModeratorFilter())
async def cmd_assign(message: Message, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    args = message.text.split(maxsplit=2)
    if len(args) < 3:
        await message.answer(
            "Использование: /assign @username <текст задачи>\n\n"
            "Модификаторы: !urgent !high !low @ДД.ММ"
        )
        return

    username_raw = args[1].strip()
    raw_text = args[2].strip()

    # Strip @ from username
    username = username_raw.lstrip("@")

    async with session_maker() as session:
        async with session.begin():
            # Find assignee by username
            members = await member_repo.get_all_active(session)
            assignee = None
            for m in members:
                if m.telegram_username and m.telegram_username.lower() == username.lower():
                    assignee = m
                    break

            if not assignee:
                await message.answer(f"❌ Пользователь @{username} не найден в команде")
                return

            parsed = TaskService.parse_task_text(raw_text)

            if not parsed["title"]:
                await message.answer("❌ Текст задачи не может быть пустым")
                return

            task = await task_service.create_task(
                session,
                title=parsed["title"],
                creator=member,
                assignee_id=assignee.id,
                priority=parsed["priority"],
                deadline=parsed["deadline"],
                source="text",
            )

            # Notify
            notification_service = NotificationService(bot)
            await notification_service.notify_task_created(session, task, member)

    prio = PRIORITY_EMOJI.get(task.priority, "")
    deadline_str = f"\n📅 Дедлайн: {task.deadline.strftime('%d.%m.%Y')}" if task.deadline else ""

    await message.answer(
        f"✅ Задача назначена:\n\n"
        f"#{task.short_id} · {task.title}\n"
        f"👤 Исполнитель: {assignee.full_name}\n"
        f"{prio} {task.priority}{deadline_str}",
        reply_markup=task_actions_keyboard(task.short_id, True),
    )


# ── /done <id> — Завершить задачу ──


@router.message(Command("done"))
async def cmd_done(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    args = (message.text or "").split(maxsplit=1)
    if len(args) < 2:
        await state.set_state(TaskCommandFSM.waiting_done_id)
        await message.answer(
            "✅ Введите ID задачи для завершения.\n"
            "Пример: 42\n"
            "Для отмены отправьте /cancel"
        )
        return

    await state.clear()

    short_id = _parse_short_id(args[1])
    if short_id is None:
        await message.answer("❌ ID задачи должен быть числом")
        return

    await _complete_task_by_short_id(
        message=message,
        member=member,
        session_maker=session_maker,
        bot=bot,
        short_id=short_id,
    )


@router.message(TaskCommandFSM.waiting_done_id, Command("cancel"))
async def fsm_cancel_done(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("❌ Завершение задачи отменено")


@router.message(TaskCommandFSM.waiting_done_id)
async def fsm_done_id(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    raw_id = message.text.strip() if message.text else ""
    short_id = _parse_short_id(raw_id)
    if short_id is None:
        await message.answer("❌ ID задачи должен быть числом. Попробуйте ещё раз или /cancel")
        return

    if await _complete_task_by_short_id(
        message=message,
        member=member,
        session_maker=session_maker,
        bot=bot,
        short_id=short_id,
    ):
        await state.clear()


# ── /status <id> <статус> — Изменить статус ──


@router.message(Command("status"))
async def cmd_status(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    args = (message.text or "").split(maxsplit=2)
    if len(args) < 3:
        await state.set_state(TaskCommandFSM.waiting_status_payload)
        await message.answer(f"{STATUS_USAGE_TEXT}\n\nДля отмены отправьте /cancel")
        return

    await state.clear()

    short_id = _parse_short_id(args[1])
    if short_id is None:
        await message.answer("❌ ID задачи должен быть числом")
        return

    new_status = args[2].strip().lower()
    await _update_task_status(
        message=message,
        member=member,
        session_maker=session_maker,
        bot=bot,
        short_id=short_id,
        new_status=new_status,
    )


@router.message(TaskCommandFSM.waiting_status_payload, Command("cancel"))
async def fsm_cancel_status(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("❌ Смена статуса отменена")


@router.message(TaskCommandFSM.waiting_status_payload)
async def fsm_status_payload(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
    bot: Bot,
    state: FSMContext,
) -> None:
    raw_payload = message.text.strip() if message.text else ""
    parts = raw_payload.split(maxsplit=1)
    if len(parts) < 2:
        await message.answer(
            "❌ Нужны ID и статус.\n"
            "Пример: 42 in_progress\n"
            "Допустимые статусы: new, in_progress, review, done, cancelled\n"
            "Для отмены: /cancel"
        )
        return

    short_id = _parse_short_id(parts[0])
    if short_id is None:
        await message.answer("❌ ID задачи должен быть числом. Попробуйте ещё раз или /cancel")
        return

    new_status = parts[1].strip().lower()
    if not new_status:
        await message.answer("❌ Укажите статус после ID. Попробуйте ещё раз или /cancel")
        return

    if await _update_task_status(
        message=message,
        member=member,
        session_maker=session_maker,
        bot=bot,
        short_id=short_id,
        new_status=new_status,
    ):
        await state.clear()


# ── Callback handlers для inline кнопок ──


@router.callback_query(F.data.startswith("task_done:"))
async def cb_task_done(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    short_id = int(callback.data.split(":")[1])
    context = _extract_list_context_from_markup(callback.message.reply_markup)

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
                return

            if task.status == "done":
                await callback.answer("Задача уже завершена", show_alert=True)
                return

            try:
                old_status = task.status
                task = await task_service.complete_task(session, task, member)
            except PermissionError:
                await callback.answer("Нет прав на завершение этой задачи", show_alert=True)
                return

            notification_service = NotificationService(bot)
            await notification_service.notify_task_completed(session, task, member)
            await notification_service.notify_status_changed(
                session, task, member, old_status, "done"
            )

    await callback.answer("✅ Задача завершена!")
    await _safe_edit_text(
        callback.message,
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=_task_detail_keyboard(
            task_id=task.short_id,
            is_moderator=PermissionService.is_moderator(member),
            context=context,
        ),
    )


@router.callback_query(F.data.startswith("task_inprogress:"))
async def cb_task_inprogress(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    short_id = int(callback.data.split(":")[1])
    context = _extract_list_context_from_markup(callback.message.reply_markup)

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
                return

            old_status = task.status
            try:
                task = await task_service.update_status(session, task, member, "in_progress")
            except (PermissionError, ValueError):
                await callback.answer("Нет прав на изменение этой задачи", show_alert=True)
                return

            notification_service = NotificationService(bot)
            await notification_service.notify_status_changed(
                session, task, member, old_status, "in_progress"
            )

    await callback.answer("▶️ Задача в работе!")
    await _safe_edit_text(
        callback.message,
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=_task_detail_keyboard(
            task_id=task.short_id,
            is_moderator=PermissionService.is_moderator(member),
            context=context,
        ),
    )


@router.callback_query(F.data.startswith("task_review:"))
async def cb_task_review(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    short_id = int(callback.data.split(":")[1])
    context = _extract_list_context_from_markup(callback.message.reply_markup)

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
                return

            old_status = task.status
            try:
                task = await task_service.update_status(session, task, member, "review")
            except (PermissionError, ValueError):
                await callback.answer("Нет прав на изменение этой задачи", show_alert=True)
                return

            notification_service = NotificationService(bot)
            await notification_service.notify_status_changed(
                session, task, member, old_status, "review"
            )

    await callback.answer("👀 Задача на ревью!")
    await _safe_edit_text(
        callback.message,
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=_task_detail_keyboard(
            task_id=task.short_id,
            is_moderator=PermissionService.is_moderator(member),
            context=context,
        ),
    )


@router.callback_query(F.data.startswith("task_cancel:"))
async def cb_task_cancel(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    if not PermissionService.is_moderator(member):
        await callback.answer("Только модератор может отменять задачи", show_alert=True)
        return

    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    short_id = int(callback.data.split(":")[1])
    context = _extract_list_context_from_markup(callback.message.reply_markup)

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
                return

            old_status = task.status
            task = await task_service.update_status(session, task, member, "cancelled")

            notification_service = NotificationService(bot)
            await notification_service.notify_status_changed(
                session, task, member, old_status, "cancelled"
            )

    await callback.answer("❌ Задача отменена!")
    await _safe_edit_text(
        callback.message,
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=_task_detail_keyboard(
            task_id=task.short_id,
            is_moderator=True,
            context=context,
        ),
    )


@router.callback_query(F.data.startswith("task_reassign:"))
async def cb_task_reassign(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker) -> None:
    if not PermissionService.is_moderator(member):
        await callback.answer("Только модератор может переназначать задачи", show_alert=True)
        return

    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    short_id = int(callback.data.split(":")[1])
    context = _extract_list_context_from_markup(callback.message.reply_markup)

    # Show team members list for reassignment
    async with session_maker() as session:
        members = await member_repo.get_all_active(session)
        task = await task_service.get_task_by_short_id(session, short_id)

    if not task:
        await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
        return

    buttons = []
    for m in members:
        label = f"{'✓ ' if m.id == task.assignee_id else ''}{m.full_name}"
        buttons.append([
            InlineKeyboardButton(
                text=label,
                callback_data=f"reassign:{short_id}:{m.id}",
            )
        ])
    buttons.append([
        InlineKeyboardButton(
            text="↩️ Назад",
            callback_data=_task_back_callback_data(short_id, context),
        )
    ])

    await callback.answer()
    await _safe_edit_text(
        callback.message,
        f"🔄 Переназначить задачу #{short_id}:\n{task.title}\n\nВыбери исполнителя:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


@router.callback_query(F.data.startswith("reassign:"))
async def cb_do_reassign(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    if not PermissionService.is_moderator(member):
        await callback.answer("Только модератор", show_alert=True)
        return

    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    context = _extract_list_context_from_markup(callback.message.reply_markup)
    parts = callback.data.split(":")
    short_id = int(parts[1])
    new_assignee_id = uuid.UUID(parts[2])

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
                return

            task = await task_service.assign_task(session, task, member, new_assignee_id)

            new_assignee = await member_repo.get_by_id(session, new_assignee_id)
            notification_service = NotificationService(bot)
            await notification_service.notify_task_assigned(
                session, task, member, new_assignee
            )

    await callback.answer("🔄 Задача переназначена!")
    await _safe_edit_text(
        callback.message,
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=_task_detail_keyboard(
            task_id=task.short_id,
            is_moderator=True,
            context=context,
        ),
    )


@router.callback_query(F.data.startswith("task_back:"))
async def cb_task_back(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker) -> None:
    if not callback.message:
        await callback.answer("Сообщение больше недоступно", show_alert=True)
        return

    try:
        short_id, context = _parse_task_back_callback_data(callback.data)
    except (IndexError, ValueError):
        await callback.answer("Некорректный callback", show_alert=True)
        return

    async with session_maker() as session:
        task = await task_service.get_task_by_short_id(session, short_id)

    if not task:
        await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
        return

    is_mod = PermissionService.is_moderator(member)
    await callback.answer()
    await _safe_edit_text(
        callback.message,
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=_task_detail_keyboard(
            task_id=task.short_id,
            is_moderator=is_mod,
            context=context,
        ),
    )


# Callback: noop (for pagination counter etc.)
@router.callback_query(F.data == "noop")
async def cb_noop(callback: CallbackQuery) -> None:
    await callback.answer()
