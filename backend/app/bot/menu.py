from aiogram import Bot
from aiogram.types import (
    BotCommand,
    BotCommandScopeAllPrivateChats,
    BotCommandScopeChat,
    MenuButtonCommands,
    MenuButtonWebApp,
    WebAppInfo,
)

from app.config import settings


HELP_PRIVATE_COMMAND = BotCommand(command="help", description="Хелп и список команд")
PORTAL_MENU_BUTTON_TEXT = "Портал"

COMMON_PRIVATE_COMMANDS: list[BotCommand] = [
    BotCommand(command="tasks", description="Мои задачи"),
    BotCommand(command="all", description="Задачи отдела / компании"),
    BotCommand(command="new", description="Создать задачу: /new <текст>"),
    BotCommand(command="done", description="Завершить задачу: /done <id>"),
    BotCommand(command="status", description="Статус задачи: /status <id> <статус>"),
    BotCommand(command="update", description="Апдейт задачи: /update <id> <текст>"),
    BotCommand(command="updates", description="История апдейтов: /updates <id>"),
    BotCommand(command="blocker", description="Сообщить блокер: /blocker <id> <текст>"),
    BotCommand(command="nextmeeting", description="Следующая встреча"),
    BotCommand(command="myreminder", description="Мои напоминания"),
    BotCommand(command="start", description="Перезапустить бота"),
]

MODERATOR_EXTRA_COMMANDS: list[BotCommand] = [
    BotCommand(command="assign", description="Назначить задачу: /assign @user <текст>"),
    BotCommand(command="meetings", description="Список встреч"),
    BotCommand(command="stats", description="Статистика команды"),
    BotCommand(command="subscribe", description="Подписки на уведомления"),
    BotCommand(command="reminders", description="Напоминания для команды"),
    BotCommand(command="summary", description="Создать задачи из Zoom Summary"),
]

ADMIN_EXTRA_COMMANDS: list[BotCommand] = [
    BotCommand(command="aimodel", description="Настройки AI-модели"),
    BotCommand(command="setrole", description="Изменить роль: /setrole @user role"),
]


def build_private_commands(
    *,
    is_moderator: bool,
    is_admin: bool,
) -> list[BotCommand]:
    commands = list(COMMON_PRIVATE_COMMANDS)
    if is_moderator:
        commands.extend(MODERATOR_EXTRA_COMMANDS)
    if is_admin:
        commands.extend(ADMIN_EXTRA_COMMANDS)
    commands.append(HELP_PRIVATE_COMMAND)
    return commands


def build_private_menu_button() -> MenuButtonCommands | MenuButtonWebApp:
    """Use Telegram menu button for opening the web portal when URL is configured."""
    frontend_url = settings.NEXT_PUBLIC_FRONTEND_URL.strip().rstrip("/")
    if frontend_url.startswith(("http://", "https://")):
        return MenuButtonWebApp(
            text=PORTAL_MENU_BUTTON_TEXT,
            web_app=WebAppInfo(url=f"{frontend_url}/login"),
        )
    return MenuButtonCommands()


async def configure_global_menu(bot: Bot) -> None:
    commands = build_private_commands(is_moderator=False, is_admin=False)
    private_scope = BotCommandScopeAllPrivateChats()

    await bot.set_my_commands(commands=commands, scope=private_scope)
    await bot.set_chat_menu_button(menu_button=build_private_menu_button())


async def configure_chat_menu(
    bot: Bot,
    *,
    chat_id: int,
    is_moderator: bool,
    is_admin: bool,
) -> None:
    commands = build_private_commands(
        is_moderator=is_moderator,
        is_admin=is_admin,
    )
    chat_scope = BotCommandScopeChat(chat_id=chat_id)
    await bot.set_my_commands(commands=commands, scope=chat_scope)
    await bot.set_chat_menu_button(
        chat_id=chat_id,
        menu_button=build_private_menu_button(),
    )
