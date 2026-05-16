from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.models import CFPublication, CFPublishingQueueItem
from app.services.content_factory.publisher_errors import ContentFactoryPublisherError
from app.services.content_factory.publisher_router_service import (
    ContentFactoryPublisherRouter,
)
from app.services.content_factory.publishing_queue_service import (
    PublishingQueueService,
    PublishingQueueValidationError,
)


logger = logging.getLogger(__name__)

SEND_NOW_ALLOWED_STATUSES = {"queued", "failed", "manual_fallback"}


class ContentFactoryPublishingSchedulerService:
    """Processes Content Factory publishing queue jobs."""

    def __init__(
        self,
        *,
        bot,
        session_maker: async_sessionmaker,
        publisher: ContentFactoryPublisherRouter | None = None,
    ):
        self.bot = bot
        self.session_maker = session_maker
        self.publisher = publisher or ContentFactoryPublisherRouter()
        self.scheduler = AsyncIOScheduler()

    def start(self) -> None:
        if self.scheduler.running:
            logger.info("ContentFactoryPublishingSchedulerService already running")
            return
        self.scheduler.add_job(
            self.process_due_queue,
            "interval",
            minutes=1,
            id="content_factory_publishing_scheduler",
            replace_existing=True,
        )
        self.scheduler.start()
        logger.info("ContentFactoryPublishingSchedulerService started")

    def stop(self) -> None:
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("ContentFactoryPublishingSchedulerService stopped")

    async def process_due_queue(self) -> dict[str, int]:
        attempted = 0
        succeeded = 0
        failed = 0
        try:
            async with self.session_maker() as session:
                items = await PublishingQueueService.list_due_items(
                    session,
                    now=datetime.now(timezone.utc),
                    limit=50,
                )
                for item in items:
                    attempted += 1
                    try:
                        ok = await self._process_item(
                            session,
                            item,
                            actor_id=None,
                        )
                        if ok is False:
                            failed += 1
                        else:
                            succeeded += 1
                    except Exception as exc:
                        failed += 1
                        logger.error(
                            "Content Factory queue item failed id=%s err=%s",
                            getattr(item, "id", None),
                            exc,
                            exc_info=True,
                        )
                if attempted:
                    await session.commit()
        except Exception as exc:
            logger.error(
                "Content Factory publishing scheduler failed: %s",
                exc,
                exc_info=True,
            )
        return {"attempted": attempted, "succeeded": succeeded, "failed": failed}

    async def send_now(
        self,
        session: AsyncSession,
        queue_item_id: uuid.UUID,
        *,
        actor_id: uuid.UUID,
    ) -> CFPublishingQueueItem | None:
        item = await PublishingQueueService.get_item(session, queue_item_id)
        if item is None:
            return None

        if item.status not in SEND_NOW_ALLOWED_STATUSES:
            raise PublishingQueueValidationError(
                "Отправить сейчас можно только задание в очереди, ошибке или ручном обходе"
            )
        if item.status in {"failed", "manual_fallback"}:
            item = await PublishingQueueService.retry_item(
                session,
                queue_item_id,
                actor_id=actor_id,
            )
            if item is None:
                return None

        await self._process_item(session, item, actor_id=actor_id)
        return item

    async def _process_item(
        self,
        session: AsyncSession,
        item: CFPublishingQueueItem,
        *,
        actor_id: uuid.UUID | None,
    ) -> bool:
        item = await PublishingQueueService.mark_processing(
            session,
            item,
            actor_id=actor_id,
        )
        try:
            provider_response = await self.publisher.publish(
                session,
                item,
                bot=self.bot,
            )
        except ContentFactoryPublisherError as exc:
            await PublishingQueueService.record_attempt_failure(
                session,
                item,
                error_message=str(exc),
                retry_after=timedelta(minutes=5),
                provider_response={"platform": exc.platform or "unknown"},
            )
            return False

        await PublishingQueueService.record_attempt_success(
            session,
            item,
            provider_response=provider_response,
            actor_id=actor_id,
        )
        await self._record_publication_success(
            session,
            item,
            provider_response,
        )
        return True

    async def _record_publication_success(
        self,
        session: AsyncSession,
        item: CFPublishingQueueItem,
        provider_response: dict,
    ) -> None:
        publication = await session.get(CFPublication, item.publication_id)
        if publication is None:
            return
        publication.status = "published"
        publication.actual_published_at = datetime.now(timezone.utc)
        publication.platform_post_id = provider_response.get(
            "message_id"
        ) or provider_response.get("post_id")
        publication.platform_post_url = provider_response.get("post_url")
        await session.flush()
