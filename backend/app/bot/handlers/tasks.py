import logging
import uuid

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.bot.filters import IsModeratorFilter
from app.bot.keyboards import task_actions_keyboard
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


def _format_task_line(task) -> str:
    """Format one task as a single line."""
    prio = PRIORITY_EMOJI.get(task.priority, "")
    source_icon = "🎤 " if task.source == "voice" else ""
    deadline_str = f" · 📅 {task.deadline.strftime('%d.%m')}" if task.deadline else ""
    updates_count = len(task.updates) if hasattr(task, "updates") and task.updates else 0
    updates_str = f" ({updates_count} обн.)" if updates_count > 0 else ""
    return f"{source_icon}#{task.short_id} · {task.title} · {prio} {task.priority}{deadline_str}{updates_str}"


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


# ── /tasks — Мои задачи ──


@router.message(Command("tasks"))
async def cmd_tasks(message: Message, member: TeamMember, session_maker: async_sessionmaker) -> None:
    async with session_maker() as session:
        tasks = await task_service.get_my_tasks(session, member.id)

    if not tasks:
        await message.answer("У тебя нет активных задач 🎉")
        return

    # Group by status
    grouped: dict[str, list] = {}
    for task in tasks:
        grouped.setdefault(task.status, []).append(task)

    status_order = ["in_progress", "review", "new"]
    lines = ["<b>📋 Мои задачи:</b>\n"]

    for status in status_order:
        if status not in grouped:
            continue
        emoji = STATUS_EMOJI.get(status, "")
        lines.append(f"\n{emoji} <b>{status}</b>:")
        for task in grouped[status]:
            lines.append(f"  {_format_task_line(task)}")

    total = len(tasks)
    lines.append(f"\nВсего: {total}")

    await message.answer("\n".join(lines), parse_mode="HTML")


# ── /all — Все задачи команды ──


@router.message(Command("all"))
async def cmd_all(message: Message, member: TeamMember, session_maker: async_sessionmaker) -> None:
    async with session_maker() as session:
        tasks = await task_service.get_all_active_tasks(session)

    if not tasks:
        await message.answer("Нет активных задач 🎉")
        return

    # Group by status
    grouped: dict[str, list] = {}
    for task in tasks:
        grouped.setdefault(task.status, []).append(task)

    status_order = ["in_progress", "review", "new"]
    lines = ["<b>📋 Все задачи команды:</b>\n"]

    for status in status_order:
        if status not in grouped:
            continue
        emoji = STATUS_EMOJI.get(status, "")
        lines.append(f"\n{emoji} <b>{status}</b>:")
        for task in grouped[status]:
            assignee_name = task.assignee.full_name if task.assignee else "—"
            lines.append(f"  {_format_task_line(task)} · 👤 {assignee_name}")

    total = len(tasks)
    lines.append(f"\nВсего: {total}")

    await message.answer("\n".join(lines), parse_mode="HTML")


# ── /new <текст> — Создать задачу себе ──


@router.message(Command("new"))
async def cmd_new(message: Message, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    args = message.text.split(maxsplit=1)
    if len(args) < 2:
        await message.answer("Использование: /new <текст задачи>\n\nМодификаторы: !urgent !high !low @ДД.ММ")
        return

    raw_text = args[1].strip()
    parsed = TaskService.parse_task_text(raw_text)

    if not parsed["title"]:
        await message.answer("❌ Текст задачи не может быть пустым")
        return

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

            # Notify subscribers
            notification_service = NotificationService(bot)
            await notification_service.notify_task_created(session, task, member)

    is_mod = PermissionService.is_moderator(member)
    prio = PRIORITY_EMOJI.get(task.priority, "")
    deadline_str = f"\n📅 Дедлайн: {task.deadline.strftime('%d.%m.%Y')}" if task.deadline else ""

    await message.answer(
        f"✅ Задача создана:\n\n"
        f"#{task.short_id} · {task.title}\n"
        f"{prio} {task.priority}{deadline_str}",
        reply_markup=task_actions_keyboard(task.short_id, is_mod),
    )


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
async def cmd_done(message: Message, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    args = message.text.split(maxsplit=1)
    if len(args) < 2:
        await message.answer("Использование: /done <id задачи>\nПример: /done 42")
        return

    try:
        short_id = int(args[1].strip().lstrip("#"))
    except ValueError:
        await message.answer("❌ ID задачи должен быть числом")
        return

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await message.answer(f"❌ Задача #{short_id} не найдена")
                return

            if task.status == "done":
                await message.answer(f"Задача #{short_id} уже завершена")
                return

            try:
                old_status = task.status
                task = await task_service.complete_task(session, task, member)
            except PermissionError as e:
                await message.answer(f"❌ {e}")
                return

            # Notify
            notification_service = NotificationService(bot)
            await notification_service.notify_task_completed(session, task, member)
            await notification_service.notify_status_changed(
                session, task, member, old_status, "done"
            )

    await message.answer(f"✅ Задача #{task.short_id} завершена!\n{task.title}")


# ── /status <id> <статус> — Изменить статус ──


@router.message(Command("status"))
async def cmd_status(message: Message, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    args = message.text.split(maxsplit=2)
    if len(args) < 3:
        await message.answer(
            "Использование: /status <id> <статус>\n\n"
            "Статусы: new, in_progress, review, done, cancelled\n"
            "Пример: /status 42 in_progress"
        )
        return

    try:
        short_id = int(args[1].strip().lstrip("#"))
    except ValueError:
        await message.answer("❌ ID задачи должен быть числом")
        return

    new_status = args[2].strip().lower()

    async with session_maker() as session:
        async with session.begin():
            task = await task_service.get_task_by_short_id(session, short_id)
            if not task:
                await message.answer(f"❌ Задача #{short_id} не найдена")
                return

            old_status = task.status

            try:
                task = await task_service.update_status(session, task, member, new_status)
            except (PermissionError, ValueError) as e:
                await message.answer(f"❌ {e}")
                return

            # Notify
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


# ── Callback handlers для inline кнопок ──


@router.callback_query(F.data.startswith("task_done:"))
async def cb_task_done(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    short_id = int(callback.data.split(":")[1])

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
    await callback.message.edit_text(
        f"✅ Задача #{task.short_id} завершена!\n{task.title}"
    )


@router.callback_query(F.data.startswith("task_inprogress:"))
async def cb_task_inprogress(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    short_id = int(callback.data.split(":")[1])

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

    is_mod = PermissionService.is_moderator(member)
    await callback.answer("▶️ Задача в работе!")
    await callback.message.edit_text(
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=task_actions_keyboard(task.short_id, is_mod),
    )


@router.callback_query(F.data.startswith("task_review:"))
async def cb_task_review(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    short_id = int(callback.data.split(":")[1])

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

    is_mod = PermissionService.is_moderator(member)
    await callback.answer("👀 Задача на ревью!")
    await callback.message.edit_text(
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=task_actions_keyboard(task.short_id, is_mod),
    )


@router.callback_query(F.data.startswith("task_cancel:"))
async def cb_task_cancel(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    if not PermissionService.is_moderator(member):
        await callback.answer("Только модератор может отменять задачи", show_alert=True)
        return

    short_id = int(callback.data.split(":")[1])

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
    await callback.message.edit_text(
        f"❌ Задача #{task.short_id} отменена\n{task.title}"
    )


@router.callback_query(F.data.startswith("task_reassign:"))
async def cb_task_reassign(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker) -> None:
    if not PermissionService.is_moderator(member):
        await callback.answer("Только модератор может переназначать задачи", show_alert=True)
        return

    short_id = int(callback.data.split(":")[1])

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
        InlineKeyboardButton(text="↩️ Назад", callback_data=f"task_back:{short_id}")
    ])

    await callback.answer()
    await callback.message.edit_text(
        f"🔄 Переназначить задачу #{short_id}:\n{task.title}\n\nВыбери исполнителя:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
    )


@router.callback_query(F.data.startswith("reassign:"))
async def cb_do_reassign(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker, bot: Bot) -> None:
    if not PermissionService.is_moderator(member):
        await callback.answer("Только модератор", show_alert=True)
        return

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
    await callback.message.edit_text(
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=task_actions_keyboard(task.short_id, True),
    )


@router.callback_query(F.data.startswith("task_back:"))
async def cb_task_back(callback: CallbackQuery, member: TeamMember, session_maker: async_sessionmaker) -> None:
    short_id = int(callback.data.split(":")[1])

    async with session_maker() as session:
        task = await task_service.get_task_by_short_id(session, short_id)

    if not task:
        await callback.answer(f"Задача #{short_id} не найдена", show_alert=True)
        return

    is_mod = PermissionService.is_moderator(member)
    await callback.answer()
    await callback.message.edit_text(
        _format_task_detail(task),
        parse_mode="HTML",
        reply_markup=task_actions_keyboard(task.short_id, is_mod),
    )


# Callback: noop (for pagination counter etc.)
@router.callback_query(F.data == "noop")
async def cb_noop(callback: CallbackQuery) -> None:
    await callback.answer()
