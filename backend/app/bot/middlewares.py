import asyncio
import hashlib
import io
import json
import logging
import time
from pathlib import Path
from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware, Bot
from aiogram.types import TelegramObject, Update

from app.bot.keyboards import main_menu_reply_keyboard
from app.bot.menu import (
    build_private_commands,
    build_private_menu_button,
    configure_chat_menu,
)
from app.config import settings
from app.db.database import async_session
from app.db.repositories import TeamMemberRepository

logger = logging.getLogger(__name__)

AVATAR_CHECK_INTERVAL = 86400  # 24 hours
UI_SYNC_COOLDOWN_SECONDS = 5
AVATARS_DIR = Path(__file__).resolve().parents[2] / "static" / "avatars"
INT32_MAX = 2_147_483_647


class AuthMiddleware(BaseMiddleware):
    """
    Middleware для авторизации пользователей.
    - Ищет telegram_id в team_members
    - Если не найден — отказ (участники добавляются только через веб-интерфейс)
    - Добавляет member и db session в data
    - Автоматически подтягивает фото профиля из Telegram
    """

    def __init__(self, storage_service=None):
        self.member_repo = TeamMemberRepository()
        self._avatar_last_checked: dict[int, float] = {}
        self._ui_sync_last_attempt: dict[int, float] = {}
        self.storage_service = storage_service
        self._current_ui_version = self._resolve_ui_version()
        logger.info(
            "Telegram UI version resolved: %s (mode=%s)",
            self._current_ui_version,
            "manual" if settings.BOT_UI_VERSION > 0 else "auto",
        )

    def _needs_avatar_check(self, telegram_id: int, avatar_url: str | None) -> bool:
        """Check if we should fetch avatar for this user."""
        # Don't overwrite custom uploaded avatars (local or Supabase)
        if avatar_url and not avatar_url.endswith("_tg.webp"):
            if avatar_url.startswith("/static/avatars/") or "supabase.co" in avatar_url:
                return False
        # Rate limit: once per 24h
        last_checked = self._avatar_last_checked.get(telegram_id, 0)
        return (time.time() - last_checked) > AVATAR_CHECK_INTERVAL

    async def _fetch_and_save_avatar(
        self, bot: Bot, telegram_id: int, member_id: str
    ) -> str | None:
        """Download Telegram profile photo and save to Supabase (or local)."""
        try:
            photos = await bot.get_user_profile_photos(telegram_id, limit=1)
            if not photos.photos:
                logger.info("No profile photo for tg_id=%s", telegram_id)
                return None

            # Largest size is last in the list
            photo = photos.photos[0][-1]
            file = await bot.get_file(photo.file_id)
            if not file.file_path:
                return None

            bio = io.BytesIO()
            await bot.download_file(file.file_path, bio)
            bio.seek(0)

            from PIL import Image

            img = Image.open(bio)
            img = img.convert("RGB")
            img = img.resize((256, 256), Image.LANCZOS)

            buf = io.BytesIO()
            img.save(buf, "WEBP", quality=85)
            image_bytes = buf.getvalue()

            if self.storage_service:
                url = await self.storage_service.upload(
                    f"{member_id}_tg.webp", image_bytes
                )
                logger.info("Avatar uploaded to Supabase for tg_id=%s: %s", telegram_id, url)
                return url
            else:
                AVATARS_DIR.mkdir(parents=True, exist_ok=True)
                save_path = AVATARS_DIR / f"{member_id}_tg.webp"
                save_path.write_bytes(image_bytes)
                local_url = f"/static/avatars/{member_id}_tg.webp"
                logger.info("Avatar saved locally for tg_id=%s: %s", telegram_id, local_url)
                return local_url
        except Exception:
            logger.warning("Failed to fetch avatar for tg_id=%s", telegram_id, exc_info=True)
            return None

    @staticmethod
    def _should_update_avatar(avatar_url: str | None) -> bool:
        """Return True if this avatar can be overwritten by a Telegram photo."""
        if not avatar_url:
            return True
        # Telegram auto-fetched photos can always be refreshed
        if avatar_url.endswith("_tg.webp"):
            return True
        # Custom uploads (local or Supabase) must NOT be overwritten
        if avatar_url.startswith("/static/avatars/") or "supabase.co" in avatar_url:
            return False
        return True

    async def _update_avatar_bg(
        self, bot: Bot, telegram_id: int, member_id: str, current_avatar: str | None
    ) -> None:
        """Background task: fetch avatar and update DB if changed."""
        avatar_url = await self._fetch_and_save_avatar(bot, telegram_id, member_id)
        if not avatar_url:
            return
        # Only update if actually different
        if avatar_url == current_avatar:
            return
        try:
            async with async_session() as session:
                async with session.begin():
                    member = await self.member_repo.get_by_telegram_id(session, telegram_id)
                    if member and self._should_update_avatar(member.avatar_url):
                        member.avatar_url = avatar_url
        except Exception:
            logger.warning("Failed to save avatar to DB for tg_id=%s", telegram_id, exc_info=True)

    @staticmethod
    def _commands_signature(is_moderator: bool, is_admin: bool) -> list[tuple[str, str]]:
        return [
            (command.command, command.description)
            for command in build_private_commands(
                is_moderator=is_moderator,
                is_admin=is_admin,
            )
        ]

    @staticmethod
    def _reply_keyboard_signature(is_moderator: bool, is_admin: bool) -> list[list[str]]:
        keyboard = main_menu_reply_keyboard(
            is_moderator=is_moderator,
            is_admin=is_admin,
        )
        return [[button.text for button in row] for row in keyboard.keyboard]

    def _compute_ui_version(self) -> int:
        signature = {
            "commands": {
                "member": self._commands_signature(False, False),
                "moderator": self._commands_signature(True, False),
                "admin": self._commands_signature(True, True),
            },
            "reply_keyboard": {
                "member": self._reply_keyboard_signature(False, False),
                "moderator": self._reply_keyboard_signature(True, False),
                "admin": self._reply_keyboard_signature(True, True),
            },
            "menu_button": build_private_menu_button().model_dump(exclude_none=True),
        }
        payload = json.dumps(
            signature,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        return self._normalize_ui_version(int(digest[:8], 16))

    @staticmethod
    def _normalize_ui_version(value: int) -> int:
        """Keep UI version inside signed int32 range used by DB column."""
        if value <= 0:
            return 0
        normalized = value & INT32_MAX
        # Avoid 0 for positive inputs so version comparison keeps working.
        return normalized or 1

    def _resolve_ui_version(self) -> int:
        if settings.BOT_UI_VERSION > 0:
            normalized = self._normalize_ui_version(settings.BOT_UI_VERSION)
            if normalized != settings.BOT_UI_VERSION:
                logger.warning(
                    "BOT_UI_VERSION=%s exceeds int32; normalized to %s",
                    settings.BOT_UI_VERSION,
                    normalized,
                )
            return normalized
        return self._compute_ui_version()

    @staticmethod
    def _extract_chat_context(update: Update, event: TelegramObject) -> tuple[int | None, str | None, str | None]:
        """Return (chat_id, chat_type, text) for message/callback events."""
        if isinstance(update, Update):
            if update.message:
                return (
                    update.message.chat.id,
                    update.message.chat.type,
                    update.message.text,
                )
            if update.callback_query and update.callback_query.message:
                msg = update.callback_query.message
                return (
                    msg.chat.id,
                    msg.chat.type,
                    msg.text,
                )

        if hasattr(event, "chat") and event.chat:
            return (
                event.chat.id,
                event.chat.type,
                getattr(event, "text", None),
            )

        return None, None, None

    @staticmethod
    def _should_suppress_ui_sync_notice(text: str | None) -> bool:
        """Avoid sending an extra sync message when /start already refreshes UI."""
        if not text:
            return False

        stripped = text.strip()
        command = stripped.split(maxsplit=1)[0].lower()
        return command.startswith("/start")

    def _can_sync_ui_now(self, telegram_id: int) -> bool:
        now = time.time()
        last_attempt = self._ui_sync_last_attempt.get(telegram_id, 0)
        if (now - last_attempt) < UI_SYNC_COOLDOWN_SECONDS:
            return False
        self._ui_sync_last_attempt[telegram_id] = now
        return True

    async def _sync_private_ui(
        self,
        bot: Bot,
        *,
        chat_id: int,
        telegram_id: int,
        is_moderator: bool,
        is_admin: bool,
        suppress_notice: bool,
    ) -> None:
        if not self._can_sync_ui_now(telegram_id):
            return

        try:
            await configure_chat_menu(
                bot,
                chat_id=chat_id,
                is_moderator=is_moderator,
                is_admin=is_admin,
            )
        except Exception:
            logger.warning(
                "Failed to configure menu during ui sync for chat_id=%s",
                chat_id,
                exc_info=True,
            )

        if suppress_notice:
            return

        try:
            await bot.send_message(
                chat_id=chat_id,
                text="🔄 Обновил меню кнопок.",
                reply_markup=main_menu_reply_keyboard(
                    is_moderator=is_moderator,
                    is_admin=is_admin,
                ),
            )
        except Exception:
            logger.warning(
                "Failed to send reply keyboard during ui sync for chat_id=%s",
                chat_id,
                exc_info=True,
            )

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        update: Update = data.get("event_update") or event
        chat_id, chat_type, message_text = self._extract_chat_context(update, event)
        is_private_chat = chat_type == "private"
        suppress_ui_sync_notice = self._should_suppress_ui_sync_notice(message_text)

        # Извлекаем user из события
        user = None

        if hasattr(event, "from_user") and event.from_user:
            user = event.from_user
        elif isinstance(update, Update):
            if update.message and update.message.from_user:
                user = update.message.from_user
            elif update.callback_query and update.callback_query.from_user:
                user = update.callback_query.from_user

        if not user:
            return await handler(event, data)

        needs_ui_sync = False
        is_admin = False
        is_moderator = False

        async with async_session() as session:
            async with session.begin():
                member = await self.member_repo.get_by_telegram_id(session, user.id)

                if not member:
                    # Не авторегистрируем — участники добавляются через веб-интерфейс
                    if hasattr(event, "answer"):
                        await event.answer(
                            "\u26d4 Вы не зарегистрированы в системе.\n"
                            "Обратитесь к администратору для добавления в команду."
                        )
                    return

                if not member.is_active:
                    if isinstance(update, Update) and update.callback_query:
                        await update.callback_query.answer(
                            "⛔ Ваш доступ к системе отключён. Обратитесь к администратору.",
                            show_alert=True,
                        )
                    elif hasattr(event, "answer"):
                        await event.answer(
                            "⛔ Ваш доступ к системе отключён. Обратитесь к администратору."
                        )
                    return

                # Обновляем username если изменился
                updated = False
                if member.telegram_username != user.username:
                    member.telegram_username = user.username
                    updated = True
                # Проверяем: если в ADMIN_TELEGRAM_IDS, но роль не admin — повысить
                if (
                    user.id in settings.ADMIN_TELEGRAM_IDS
                    and member.role != "admin"
                ):
                    member.role = "admin"
                    member.bot_ui_version = 0
                    updated = True

                is_admin = member.role == "admin"
                is_moderator = is_admin or member.role == "moderator"

                if is_private_chat and (member.bot_ui_version or 0) < self._current_ui_version:
                    member.bot_ui_version = self._current_ui_version
                    needs_ui_sync = True
                    updated = True

                if updated:
                    await session.flush()

            data["member"] = member
            data["session_maker"] = async_session

        bot_instance: Bot | None = data.get("bot")

        # Fetch Telegram avatar in background (non-blocking)
        if bot_instance and self._needs_avatar_check(user.id, member.avatar_url):
            self._avatar_last_checked[user.id] = time.time()
            logger.info(
                "Starting avatar fetch for tg_id=%s (current=%s)",
                user.id, member.avatar_url,
            )
            asyncio.create_task(
                self._update_avatar_bg(bot_instance, user.id, str(member.id), member.avatar_url)
            )

        result = await handler(event, data)

        if (
            needs_ui_sync
            and bot_instance
            and is_private_chat
            and chat_id is not None
        ):
            await self._sync_private_ui(
                bot_instance,
                chat_id=chat_id,
                telegram_id=user.id,
                is_moderator=is_moderator,
                is_admin=is_admin,
                suppress_notice=suppress_ui_sync_notice,
            )

        return result
