from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CFPlatform, CFPublication, CFPublishingQueueItem
from app.services.content_factory.publisher_errors import ContentFactoryPublisherError
from app.services.content_factory.telegram_publisher_service import TelegramPublisherService
from app.services.content_factory.vk_publisher_service import VKPublisherService


class ContentFactoryPublisherRouter:
    """Routes queue items to the platform-specific Content Factory publisher."""

    def __init__(
        self,
        *,
        telegram_provider: TelegramPublisherService | None = None,
        vk_provider: VKPublisherService | None = None,
    ):
        self.telegram_provider = telegram_provider or TelegramPublisherService()
        self.vk_provider = vk_provider or VKPublisherService()

    async def publish(
        self,
        session: AsyncSession,
        item: CFPublishingQueueItem,
        *,
        bot,
    ) -> dict[str, Any]:
        publication = await session.get(CFPublication, item.publication_id)
        if publication is None:
            raise ContentFactoryPublisherError("Публикация не найдена")

        platform = await session.get(CFPlatform, publication.platform_id)
        if platform is None:
            raise ContentFactoryPublisherError("Площадка публикации не найдена")

        if platform.code == "telegram":
            return await self.telegram_provider.publish(session, item, bot=bot)

        if platform.code == "vk":
            return await self.vk_provider.publish_loaded(
                session=session,
                publication=publication,
                platform=platform,
                item=item,
            )

        raise ContentFactoryPublisherError(
            "Автоотправка для площадки "
            f"{platform.display_name or platform.code} пока не поддерживается",
            platform=platform.code,
        )
