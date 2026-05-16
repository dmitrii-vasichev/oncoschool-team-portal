from __future__ import annotations

import html
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    CFPlatform,
    CFPublication,
    CFPublicationVariant,
    CFPublishingQueueItem,
    TelegramNotificationTarget,
)
from app.db.repositories import TelegramTargetRepository
from app.services.content_factory.publisher_errors import ContentFactoryPublisherError


CONTENT_FACTORY_TARGET_TYPE = "content_factory"
TELEGRAM_CHANNEL = "telegram"
PUBLISHABLE_STATUSES = {"approved", "scheduled"}


class TelegramPublisherError(ContentFactoryPublisherError):
    """Raised when a Telegram publication cannot be sent safely."""

    def __init__(self, message: str):
        super().__init__(message, platform=TELEGRAM_CHANNEL)


def build_telegram_message(
    publication: CFPublication,
    variant: CFPublicationVariant | None,
) -> str:
    source = variant or publication
    title = html.escape((getattr(source, "title", None) or "").strip())
    body = html.escape((getattr(source, "body_text", None) or "").strip())
    parts: list[str] = []
    if title:
        parts.append(f"<b>{title}</b>")
    if body:
        parts.append(body)
    return "\n\n".join(parts)


def build_telegram_post_url(chat_id: int, message_id: int | str) -> str | None:
    raw_chat_id = str(abs(int(chat_id)))
    if raw_chat_id.startswith("100") and len(raw_chat_id) > 3:
        return f"https://t.me/c/{raw_chat_id[3:]}/{message_id}"
    return None


def _target_id_from_payload(
    publication: CFPublication,
    item: CFPublishingQueueItem,
) -> uuid.UUID | None:
    candidates: list[Any] = []
    payload = item.payload if isinstance(item.payload, dict) else {}
    payload_utm = payload.get("utm") if isinstance(payload.get("utm"), dict) else {}
    publication_utm = (
        publication.utm if isinstance(getattr(publication, "utm", None), dict) else {}
    )
    for raw in (payload_utm, publication_utm, payload):
        candidates.extend(
            [
                raw.get("telegram_target_id"),
                raw.get("cf_telegram_target_id"),
            ]
        )

    for candidate in candidates:
        if not candidate:
            continue
        try:
            return uuid.UUID(str(candidate))
        except ValueError:
            raise TelegramPublisherError(
                "Некорректный telegram_target_id в UTM публикации"
            ) from None
    return None


class TelegramPublisherService:
    def __init__(self, target_repo: TelegramTargetRepository | None = None):
        self.target_repo = target_repo or TelegramTargetRepository()

    async def load_publication(
        self,
        session: AsyncSession,
        item: CFPublishingQueueItem,
    ) -> CFPublication | None:
        return await session.get(CFPublication, item.publication_id)

    async def load_platform(
        self,
        session: AsyncSession,
        publication: CFPublication,
    ) -> CFPlatform | None:
        return await session.get(CFPlatform, publication.platform_id)

    async def load_current_variant(
        self,
        session: AsyncSession,
        publication: CFPublication,
    ) -> CFPublicationVariant | None:
        result = await session.execute(
            select(CFPublicationVariant)
            .where(
                CFPublicationVariant.publication_id == publication.id,
                CFPublicationVariant.channel == TELEGRAM_CHANNEL,
                CFPublicationVariant.source_version_number
                == publication.version_number,
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def resolve_target(
        self,
        session: AsyncSession,
        publication: CFPublication,
        item: CFPublishingQueueItem,
    ) -> TelegramNotificationTarget:
        explicit_target_id = _target_id_from_payload(publication, item)
        if explicit_target_id is not None:
            target = await self.target_repo.get_by_id(session, explicit_target_id)
            if not target or not target.is_active:
                raise TelegramPublisherError(
                    "Telegram-группа для Content Factory не найдена или выключена"
                )
            return target

        targets = await self.target_repo.get_active_by_type(
            session,
            CONTENT_FACTORY_TARGET_TYPE,
        )
        if len(targets) == 1:
            return targets[0]
        if not targets:
            raise TelegramPublisherError(
                "Для автоотправки Telegram настройте одну активную группу "
                "с типом content_factory"
            )
        raise TelegramPublisherError(
            "Найдено несколько Telegram-групп для Content Factory. "
            "Укажите telegram_target_id в UTM публикации"
        )

    async def publish(
        self,
        session: AsyncSession,
        item: CFPublishingQueueItem,
        *,
        bot,
    ) -> dict[str, Any]:
        if bot is None:
            raise TelegramPublisherError("Telegram-бот недоступен")

        publication = await self.load_publication(session, item)
        if publication is None:
            raise TelegramPublisherError("Публикация не найдена")

        platform = await self.load_platform(session, publication)
        if platform is None or platform.code != TELEGRAM_CHANNEL:
            raise TelegramPublisherError(
                "Автоотправка в этом спринте поддерживает только Telegram"
            )

        if publication.status not in PUBLISHABLE_STATUSES:
            raise TelegramPublisherError(
                "Публикация больше не находится в статусе Одобрено или Запланировано"
            )

        if publication.media_refs:
            raise TelegramPublisherError(
                "Автоотправка Telegram пока поддерживает только текстовые "
                "публикации без media_refs"
            )

        variant = await self.load_current_variant(session, publication)
        message = build_telegram_message(publication, variant)
        if not message.strip():
            raise TelegramPublisherError("Нет текста для отправки в Telegram")

        target = await self.resolve_target(session, publication, item)
        kwargs: dict[str, Any] = {
            "chat_id": target.chat_id,
            "text": message,
            "parse_mode": "HTML",
        }
        if target.thread_id:
            kwargs["message_thread_id"] = target.thread_id

        try:
            sent_message = await bot.send_message(**kwargs)
        except Exception as exc:
            raise TelegramPublisherError(str(exc)[:1000]) from exc

        message_id = str(sent_message.message_id)
        post_url = build_telegram_post_url(target.chat_id, message_id)
        return {
            "platform": TELEGRAM_CHANNEL,
            "chat_id": target.chat_id,
            "thread_id": target.thread_id,
            "target_id": str(target.id),
            "target_label": target.label,
            "message_id": message_id,
            "post_url": post_url,
        }
