import asyncio
import io
import logging
import time
from pathlib import Path
from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware, Bot
from aiogram.types import TelegramObject, Update

from app.config import settings
from app.db.database import async_session
from app.db.repositories import TeamMemberRepository

logger = logging.getLogger(__name__)

AVATAR_CHECK_INTERVAL = 86400  # 24 hours
AVATARS_DIR = Path(__file__).resolve().parents[2] / "static" / "avatars"


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
        self.storage_service = storage_service

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

    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        # Извлекаем user из события
        update: Update = data.get("event_update") or event
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
                else:
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
                        updated = True
                    if updated:
                        await session.flush()

            data["member"] = member
            data["session_maker"] = async_session

        # Fetch Telegram avatar in background (non-blocking)
        if self._needs_avatar_check(user.id, member.avatar_url):
            self._avatar_last_checked[user.id] = time.time()
            bot_instance: Bot = data["bot"]
            logger.info(
                "Starting avatar fetch for tg_id=%s (current=%s)",
                user.id, member.avatar_url,
            )
            asyncio.create_task(
                self._update_avatar_bg(bot_instance, user.id, str(member.id), member.avatar_url)
            )

        return await handler(event, data)
