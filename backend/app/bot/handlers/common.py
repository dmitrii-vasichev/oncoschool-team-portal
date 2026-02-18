import logging

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, InlineKeyboardButton, InlineKeyboardMarkup, Message
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.bot.callbacks import TaskListCallback, TaskListFilter, TaskListScope
from app.db.models import TeamMember
from app.db.repositories import TeamMemberRepository
from app.services.permission_service import PermissionService
from app.services.web_login_service import web_login_service

logger = logging.getLogger(__name__)

router = Router()

VALID_ROLES = ("admin", "moderator", "member")


@router.message(Command("start"))
async def cmd_start(message: Message, member: TeamMember) -> None:
    if PermissionService.is_admin(member):
        role_emoji, role_text = "\U0001f451", "Администратор"
    elif PermissionService.is_moderator(member):
        role_emoji, role_text = "\U0001f6e1\ufe0f", "Модератор"
    else:
        role_emoji, role_text = "\U0001f464", "Участник"

    text = (
        f"Привет, {member.full_name}! Я бот-задачник Онкошколы.\n"
        f"Твоя роль: {role_emoji} {role_text}\n\n"
        "Выбери раздел ниже или используй /help для списка команд"
    )

    buttons = [[InlineKeyboardButton(
        text="\U0001f4cb Мои задачи",
        callback_data=TaskListCallback(
            scope=TaskListScope.MY,
            task_filter=TaskListFilter.ALL,
            page=1,
        ).pack(),
    )]]

    if PermissionService.is_moderator(member):
        buttons.append([InlineKeyboardButton(
            text="\U0001f4ca Все задачи",
            callback_data=TaskListCallback(
                scope=TaskListScope.TEAM,
                task_filter=TaskListFilter.ALL,
                page=1,
            ).pack(),
        )])

    reply_markup = InlineKeyboardMarkup(inline_keyboard=buttons)

    await message.answer(text, reply_markup=reply_markup)


@router.message(Command("app"))
async def cmd_app(message: Message, _member: TeamMember) -> None:
    await message.answer("Mini App отключен, используйте /tasks")


@router.message(Command("help"))
async def cmd_help(message: Message, member: TeamMember) -> None:
    is_mod = PermissionService.is_moderator(member)
    is_adm = PermissionService.is_admin(member)

    common_commands = (
        "<b>Команды:</b>\n\n"
        "/tasks — мои задачи\n"
        "/all — все задачи команды\n"
        "/new &lt;текст&gt; — создать задачу себе\n"
        "/done &lt;id&gt; — завершить задачу\n"
        "/update &lt;id&gt; &lt;текст&gt; — промежуточный апдейт\n"
        "/status &lt;id&gt; &lt;статус&gt; — изменить статус\n"
        "\U0001f3a4 Голосовое сообщение — создать задачу голосом\n"
        "/nextmeeting — следующая встреча\n"
        "/myreminder — мои настройки напоминаний"
    )

    text = common_commands

    if is_mod:
        mod_commands = (
            "\n\n<b>\U0001f6e1\ufe0f Модератор:</b>\n\n"
            "/assign @username &lt;текст&gt; — назначить задачу\n"
            "/meetings — предстоящие и прошедшие встречи\n"
            "/team — управление командой\n"
            "/subscribe — подписки на уведомления\n"
            "/aimodel — текущая AI-модель\n"
            "/stats — статистика"
        )
        text += mod_commands

    if is_adm:
        admin_commands = (
            "\n\n<b>\U0001f451 Администрирование:</b>\n\n"
            "/setrole @username admin|moderator|member — изменить роль\n"
            "/reminders — настройки напоминаний\n"
            "\u2699\ufe0f Настройки AI, напоминания — через веб-интерфейс"
        )
        text += admin_commands

    await message.answer(text, parse_mode="HTML")


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
