import logging
from html import escape

from aiogram import Bot, F, Router
from aiogram.filters import Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.bot.keyboards import (
    MENU_BTN_AI_MODEL,
    MENU_BTN_ALL_TASKS_COMPANY,
    MENU_BTN_ALL_TASKS_DEPARTMENT,
    MENU_BTN_ALL_TASKS_LEGACY,
    MENU_BTN_HELP,
    MENU_BTN_MEETINGS,
    MENU_BTN_MY_REMINDER,
    MENU_BTN_MY_TASKS,
    MENU_BTN_NEXT_MEETING,
    MENU_BTN_STATS,
    MENU_BTN_SUBSCRIBE,
    MENU_BTN_SUMMARY,
    MENU_BTN_TEAM_REMINDERS,
    main_menu_reply_keyboard,
)
from app.bot.menu import build_private_commands, configure_chat_menu
from app.db.models import TeamMember
from app.db.repositories import TeamMemberRepository
from app.services.permission_service import PermissionService
from app.services.web_login_service import web_login_service

logger = logging.getLogger(__name__)

router = Router()

VALID_ROLES = ("admin", "moderator", "member")


@router.message(Command("start"))
async def cmd_start(message: Message, member: TeamMember) -> None:
    is_admin = PermissionService.is_admin(member)
    is_moderator = PermissionService.is_moderator(member)

    if message.chat.type == "private":
        try:
            await configure_chat_menu(
                message.bot,
                chat_id=message.chat.id,
                is_moderator=is_moderator,
                is_admin=is_admin,
            )
        except Exception:
            logger.warning(
                "Failed to configure chat menu for chat_id=%s",
                message.chat.id,
                exc_info=True,
            )

    if is_admin:
        role_emoji, role_text = "\U0001f451", "Администратор"
    elif is_moderator:
        role_emoji, role_text = "\U0001f6e1\ufe0f", "Модератор"
    else:
        role_emoji, role_text = "\U0001f464", "Участник"

    text = (
        f"Привет, {member.full_name}! Я бот-задачник Онкошколы.\n"
        f"Твоя роль: {role_emoji} {role_text}\n\n"
        "Ниже закреплена постоянная клавиатура с быстрыми действиями.\n"
        "Кнопки «Мои задачи», «Хелп» и другие доступны сразу.\n"
        "Кнопка «Портал» рядом с полем ввода открывает веб-версию."
    )
    if message.chat.type == "private":
        await message.answer(
            text,
            reply_markup=main_menu_reply_keyboard(
                is_moderator=is_moderator,
                is_admin=is_admin,
            ),
        )
    else:
        await message.answer(
            f"Привет, {member.full_name}! Я бот-задачник Онкошколы.\n"
            f"Твоя роль: {role_emoji} {role_text}\n\n"
            "Используй /help для списка команд."
        )


@router.message(Command("help"))
async def cmd_help(message: Message, member: TeamMember) -> None:
    commands = build_private_commands(
        is_moderator=PermissionService.is_moderator(member),
        is_admin=PermissionService.is_admin(member),
    )

    lines = ["<b>Доступные команды:</b>", ""]
    for cmd in commands:
        lines.append(f"/{cmd.command} — {escape(cmd.description)}")

    lines.extend([
        "",
        "\U0001f3a4 Голосовое сообщение — создать задачу голосом",
        "\U0001f310 Портал — кнопка «Портал» рядом с полем ввода",
    ])

    await message.answer("\n".join(lines), parse_mode="HTML")


@router.message(StateFilter(None), F.chat.type == "private", F.text == MENU_BTN_MY_TASKS)
async def menu_btn_my_tasks(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    from app.bot.handlers.tasks import cmd_tasks

    await cmd_tasks(message, member, session_maker)


@router.message(StateFilter(None), F.chat.type == "private", F.text == MENU_BTN_HELP)
async def menu_btn_help(message: Message, member: TeamMember) -> None:
    await cmd_help(message, member)


@router.message(StateFilter(None), F.chat.type == "private", F.text == MENU_BTN_ALL_TASKS_DEPARTMENT)
@router.message(StateFilter(None), F.chat.type == "private", F.text == MENU_BTN_ALL_TASKS_COMPANY)
@router.message(StateFilter(None), F.chat.type == "private", F.text == MENU_BTN_ALL_TASKS_LEGACY)
async def menu_btn_all_tasks(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    from app.bot.handlers.tasks import cmd_all

    await cmd_all(message, member, session_maker)


@router.message(StateFilter(None), F.chat.type == "private", F.text == MENU_BTN_NEXT_MEETING)
async def menu_btn_next_meeting(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    from app.bot.handlers.meetings import cmd_nextmeeting

    await cmd_nextmeeting(message, member, session_maker)


@router.message(StateFilter(None), F.chat.type == "private", F.text == MENU_BTN_MY_REMINDER)
async def menu_btn_my_reminder(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    from app.bot.handlers.settings import cmd_myreminder

    await cmd_myreminder(message, member, session_maker)


@router.message(StateFilter(None), F.chat.type == "private", F.text == MENU_BTN_MEETINGS)
async def menu_btn_meetings(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    if not PermissionService.is_moderator(member):
        await message.answer("⛔ Эта кнопка доступна только модератору.")
        return

    from app.bot.handlers.meetings import cmd_meetings

    await cmd_meetings(message, member, session_maker)


@router.message(StateFilter(None), F.chat.type == "private", F.text == MENU_BTN_STATS)
async def menu_btn_stats(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    if not PermissionService.is_moderator(member):
        await message.answer("⛔ Эта кнопка доступна только модератору.")
        return

    from app.bot.handlers.meetings import cmd_stats

    await cmd_stats(message, member, session_maker)


@router.message(StateFilter(None), F.chat.type == "private", F.text == MENU_BTN_SUBSCRIBE)
async def menu_btn_subscribe(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    if not PermissionService.is_moderator(member):
        await message.answer("⛔ Эта кнопка доступна только модератору.")
        return

    from app.bot.handlers.settings import cmd_subscribe

    await cmd_subscribe(message, member, session_maker)


@router.message(StateFilter(None), F.chat.type == "private", F.text == MENU_BTN_SUMMARY)
async def menu_btn_summary(
    message: Message,
    member: TeamMember,
    state: FSMContext,
) -> None:
    if not PermissionService.is_moderator(member):
        await message.answer("⛔ Эта кнопка доступна только модератору.")
        return

    from app.bot.handlers.summary import cmd_summary

    await cmd_summary(message, state)


@router.message(StateFilter(None), F.chat.type == "private", F.text == MENU_BTN_AI_MODEL)
async def menu_btn_ai_model(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    if not PermissionService.is_admin(member):
        await message.answer("⛔ Эта кнопка доступна только администратору.")
        return

    from app.bot.handlers.settings import cmd_aimodel

    await cmd_aimodel(message, member, session_maker)


@router.message(StateFilter(None), F.chat.type == "private", F.text == MENU_BTN_TEAM_REMINDERS)
async def menu_btn_team_reminders(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    if not PermissionService.is_moderator(member):
        await message.answer("⛔ Эта кнопка доступна только модератору.")
        return

    from app.bot.handlers.settings import cmd_reminders

    await cmd_reminders(message, member, session_maker)


@router.message(Command("setrole"))
async def cmd_setrole(
    message: Message,
    member: TeamMember,
    session_maker: async_sessionmaker,
) -> None:
    if not PermissionService.is_admin(member):
        await message.answer("\u26d4 Только администратор может менять роли.")
        return

    args = message.text.split(maxsplit=2)
    if len(args) < 3:
        await message.answer(
            "\u2753 Использование: /setrole @username роль\n"
            "Роли: admin, moderator, member"
        )
        return

    username = args[1].lstrip("@")
    new_role = args[2].lower().strip()

    if new_role not in VALID_ROLES:
        await message.answer(
            f"\u274c Неверная роль: <code>{new_role}</code>\n"
            f"Допустимые: admin, moderator, member",
            parse_mode="HTML",
        )
        return

    member_repo = TeamMemberRepository()
    async with session_maker() as session:
        async with session.begin():
            target = await member_repo.get_by_telegram_username(session, username)
            if not target:
                await message.answer(f"\u274c Участник @{username} не найден.")
                return

            if target.role == new_role:
                await message.answer(
                    f"Роль @{username} уже <b>{new_role}</b>.",
                    parse_mode="HTML",
                )
                return

            old_role = target.role
            target.role = new_role

    role_labels = {"admin": "\U0001f451 Администратор", "moderator": "\U0001f6e1\ufe0f Модератор", "member": "\U0001f464 Участник"}
    await message.answer(
        f"\u2705 Роль @{username} изменена:\n"
        f"{role_labels.get(old_role, old_role)} → {role_labels.get(new_role, new_role)}",
    )


# ── Web Login via Telegram confirmation ──


async def send_web_login_confirmation(
    bot: Bot, telegram_id: int, request_id: str
) -> int | None:
    """Send login confirmation request to user in Telegram.

    Returns the message_id of the sent message, or None on failure.
    """
    text = (
        "\U0001f510 <b>Запрос на вход в веб-портал</b>\n\n"
        "Кто-то запрашивает вход в Task Manager Онкошколы через ваш аккаунт.\n\n"
        "Если это вы — нажмите кнопку ниже. Запрос действителен 5 минут."
    )
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text="\u2705 Подтвердить вход",
                callback_data=f"web_login_confirm:{request_id}",
            ),
            InlineKeyboardButton(
                text="\u274c Отклонить",
                callback_data=f"web_login_reject:{request_id}",
            ),
        ]
    ])

    try:
        msg = await bot.send_message(
            chat_id=telegram_id, text=text, reply_markup=keyboard, parse_mode="HTML"
        )
        # Store message_id so we can edit the message later
        login_request = web_login_service.get_request(request_id)
        if login_request:
            login_request.message_id = msg.message_id
        return msg.message_id
    except Exception:
        logger.exception("Failed to send web login confirmation to tg_id=%s", telegram_id)
        return None


@router.callback_query(F.data.startswith("web_login_confirm:"))
async def on_web_login_confirm(callback: CallbackQuery) -> None:
    """User confirmed web login from Telegram."""
    request_id = callback.data.split(":", 1)[1]
    login_request = web_login_service.get_request(request_id)

    if login_request is None:
        await callback.answer("\u274c Запрос не найден или истёк", show_alert=True)
        return

    # Security: only the target user can confirm
    if callback.from_user.id != login_request.telegram_id:
        await callback.answer("\u26d4 Этот запрос не для вас", show_alert=True)
        return

    if login_request.status != "pending":
        await callback.answer("\u26a0\ufe0f Запрос уже обработан", show_alert=True)
        return

    web_login_service.confirm_request(request_id)
    await callback.answer("\u2705 Вход подтверждён!")

    # Edit the original message — remove keyboard, show confirmation
    try:
        await callback.message.edit_text(
            "\u2705 Вход в веб-портал подтверждён.\nМожете вернуться в браузер.",
        )
    except Exception:
        pass


@router.callback_query(F.data.startswith("web_login_reject:"))
async def on_web_login_reject(callback: CallbackQuery) -> None:
    """User rejected web login from Telegram."""
    request_id = callback.data.split(":", 1)[1]
    login_request = web_login_service.get_request(request_id)

    if login_request is None:
        await callback.answer("\u274c Запрос не найден или истёк", show_alert=True)
        return

    # Security: only the target user can reject
    if callback.from_user.id != login_request.telegram_id:
        await callback.answer("\u26d4 Этот запрос не для вас", show_alert=True)
        return

    web_login_service.delete_request(request_id)
    await callback.answer("\u274c Запрос на вход отклонён")

    try:
        await callback.message.edit_text("\u274c Запрос на вход отклонён.")
    except Exception:
        pass
