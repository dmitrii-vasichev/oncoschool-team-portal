from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject, Update

from app.config import settings
from app.db.database import async_session
from app.db.repositories import TeamMemberRepository


class AuthMiddleware(BaseMiddleware):
    """
    Middleware для авторизации пользователей.
    - Ищет telegram_id в team_members
    - Если не найден — авторегистрация (role=member, или moderator если в ADMIN_TELEGRAM_IDS)
    - Добавляет member и db session в data
    """

    def __init__(self):
        self.member_repo = TeamMemberRepository()

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
                    # Авторегистрация
                    role = (
                        "moderator"
                        if user.id in settings.ADMIN_TELEGRAM_IDS
                        else "member"
                    )
                    full_name = user.full_name or user.first_name or "Unknown"
                    member = await self.member_repo.create(
                        session,
                        telegram_id=user.id,
                        telegram_username=user.username,
                        full_name=full_name,
                        role=role,
                    )
                else:
                    # Обновляем username если изменился
                    updated = False
                    if member.telegram_username != user.username:
                        member.telegram_username = user.username
                        updated = True
                    # Проверяем: если в ADMIN_TELEGRAM_IDS, но роль member — повысить
                    if (
                        user.id in settings.ADMIN_TELEGRAM_IDS
                        and member.role != "moderator"
                    ):
                        member.role = "moderator"
                        updated = True
                    if updated:
                        await session.flush()

            data["member"] = member
            data["session_maker"] = async_session

        return await handler(event, data)
