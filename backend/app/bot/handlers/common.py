from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

from app.db.models import TeamMember
from app.services.permission_service import PermissionService

router = Router()


@router.message(Command("start"))
async def cmd_start(message: Message, member: TeamMember) -> None:
    role_emoji = "\U0001f451" if PermissionService.is_moderator(member) else "\U0001f464"
    role_text = "Модератор" if PermissionService.is_moderator(member) else "Участник"

    await message.answer(
        f"Привет, {member.full_name}! Я бот-задачник Онкошколы.\n"
        f"Твоя роль: {role_emoji} {role_text}\n\n"
        f"/help — список команд"
    )


@router.message(Command("help"))
async def cmd_help(message: Message, member: TeamMember) -> None:
    is_mod = PermissionService.is_moderator(member)

    common_commands = (
        "<b>Команды:</b>\n\n"
        "/tasks — мои задачи\n"
        "/all — все задачи команды\n"
        "/new &lt;текст&gt; — создать задачу себе\n"
        "/done &lt;id&gt; — завершить задачу\n"
        "/update &lt;id&gt; &lt;текст&gt; — промежуточный апдейт\n"
        "/status &lt;id&gt; &lt;статус&gt; — изменить статус\n"
        "\U0001f3a4 Голосовое сообщение — создать задачу голосом"
    )

    if is_mod:
        mod_commands = (
            "\n\n<b>Модератор:</b>\n\n"
            "/assign @username &lt;текст&gt; — назначить задачу\n"
            "/summary — обработать Zoom Summary\n"
            "/meetings — история встреч\n"
            "/team — управление командой\n"
            "/setrole @username &lt;роль&gt; — назначить роль\n"
            "/reminders — настройки напоминаний\n"
            "/subscribe — подписки на уведомления\n"
            "/aimodel — текущая AI-модель\n"
            "/stats — статистика"
        )
        text = common_commands + mod_commands
    else:
        text = common_commands

    await message.answer(text, parse_mode="HTML")
