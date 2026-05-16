import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.content_factory.publisher_errors import ContentFactoryPublisherError
from app.services.content_factory.publisher_router_service import (
    ContentFactoryPublisherRouter,
)
from app.services.content_factory.publishing_queue_service import PublishingQueueService
from app.services.content_factory.publishing_scheduler_service import (
    ContentFactoryPublishingSchedulerService,
)
from app.services.content_factory.telegram_publisher_service import TelegramPublisherError


def make_queue_item(**overrides):
    base = {
        "id": uuid.uuid4(),
        "publication_id": uuid.uuid4(),
        "platform_id": uuid.uuid4(),
        "status": "queued",
        "attempts": 0,
        "max_attempts": 3,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def make_publication(item=None, **overrides):
    item = item or make_queue_item()
    base = {
        "id": item.publication_id,
        "platform_id": item.platform_id,
        "status": "scheduled",
        "actual_published_at": None,
        "platform_post_id": None,
        "platform_post_url": None,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def make_session(publication=None):
    return SimpleNamespace(
        get=AsyncMock(return_value=publication),
        flush=AsyncMock(),
        commit=AsyncMock(),
    )


class FakeSessionMaker:
    def __init__(self, session):
        self.session = session

    def __call__(self):
        return self

    async def __aenter__(self):
        return self.session

    async def __aexit__(self, exc_type, exc, tb):
        return None


@pytest.mark.asyncio
async def test_send_now_marks_processing_sends_and_marks_success(monkeypatch):
    item = make_queue_item()
    publication = make_publication(item)
    session = make_session(publication)
    publisher = SimpleNamespace(
        publish=AsyncMock(
            return_value={
                "platform": "telegram",
                "message_id": "321",
                "post_url": "https://t.me/c/123/321",
            }
        )
    )
    service = ContentFactoryPublishingSchedulerService(
        bot=SimpleNamespace(),
        session_maker=FakeSessionMaker(session),
        publisher=publisher,
    )
    actor_id = uuid.uuid4()
    monkeypatch.setattr(
        PublishingQueueService,
        "get_item",
        AsyncMock(return_value=item),
    )
    monkeypatch.setattr(
        PublishingQueueService,
        "mark_processing",
        AsyncMock(return_value=item),
    )
    monkeypatch.setattr(
        PublishingQueueService,
        "record_attempt_success",
        AsyncMock(return_value=item),
    )

    result = await service.send_now(session, item.id, actor_id=actor_id)

    assert result is item
    publisher.publish.assert_awaited_once_with(session, item, bot=service.bot)
    PublishingQueueService.mark_processing.assert_awaited_once_with(
        session,
        item,
        actor_id=actor_id,
    )
    PublishingQueueService.record_attempt_success.assert_awaited_once()
    assert publication.status == "published"
    assert publication.actual_published_at is not None
    assert publication.platform_post_id == "321"
    assert publication.platform_post_url == "https://t.me/c/123/321"
    session.flush.assert_awaited()


@pytest.mark.asyncio
async def test_send_now_records_vk_post_id_on_publication(monkeypatch):
    item = make_queue_item()
    publication = make_publication(item)
    session = make_session(publication)
    publisher = SimpleNamespace(
        publish=AsyncMock(
            return_value={
                "platform": "vk",
                "post_id": "456",
                "post_url": "https://vk.com/wall-123_456",
            }
        )
    )
    service = ContentFactoryPublishingSchedulerService(
        bot=SimpleNamespace(),
        session_maker=FakeSessionMaker(session),
        publisher=publisher,
    )
    monkeypatch.setattr(
        PublishingQueueService,
        "get_item",
        AsyncMock(return_value=item),
    )
    monkeypatch.setattr(
        PublishingQueueService,
        "mark_processing",
        AsyncMock(return_value=item),
    )
    monkeypatch.setattr(
        PublishingQueueService,
        "record_attempt_success",
        AsyncMock(return_value=item),
    )

    await service.send_now(session, item.id, actor_id=uuid.uuid4())

    assert publication.status == "published"
    assert publication.platform_post_id == "456"
    assert publication.platform_post_url == "https://vk.com/wall-123_456"


@pytest.mark.asyncio
async def test_send_now_records_failure_when_publisher_rejects(monkeypatch):
    item = make_queue_item()
    session = make_session(make_publication(item))
    publisher = SimpleNamespace(
        publish=AsyncMock(side_effect=TelegramPublisherError("Telegram-бот недоступен"))
    )
    service = ContentFactoryPublishingSchedulerService(
        bot=SimpleNamespace(),
        session_maker=FakeSessionMaker(session),
        publisher=publisher,
    )
    monkeypatch.setattr(
        PublishingQueueService,
        "get_item",
        AsyncMock(return_value=item),
    )
    monkeypatch.setattr(
        PublishingQueueService,
        "mark_processing",
        AsyncMock(return_value=item),
    )
    monkeypatch.setattr(
        PublishingQueueService,
        "record_attempt_failure",
        AsyncMock(return_value=item),
    )

    result = await service.send_now(session, item.id, actor_id=uuid.uuid4())

    assert result is item
    PublishingQueueService.record_attempt_failure.assert_awaited_once()
    failure_kwargs = PublishingQueueService.record_attempt_failure.await_args.kwargs
    assert failure_kwargs["error_message"] == "Telegram-бот недоступен"


@pytest.mark.asyncio
async def test_process_due_queue_processes_each_due_item(monkeypatch):
    session = make_session()
    items = [make_queue_item(), make_queue_item()]
    service = ContentFactoryPublishingSchedulerService(
        bot=SimpleNamespace(),
        session_maker=FakeSessionMaker(session),
        publisher=SimpleNamespace(),
    )
    monkeypatch.setattr(
        PublishingQueueService,
        "list_due_items",
        AsyncMock(return_value=items),
    )
    service._process_item = AsyncMock(return_value=None)

    result = await service.process_due_queue()

    assert result == {"attempted": 2, "succeeded": 2, "failed": 0}
    assert service._process_item.await_count == 2
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_router_sends_vk_publication_to_vk_provider():
    item = make_queue_item()
    publication = make_publication(item)
    platform = SimpleNamespace(id=item.platform_id, code="vk")
    session = make_session(publication)
    session.get = AsyncMock(side_effect=[publication, platform])
    vk_provider = SimpleNamespace(
        publish_loaded=AsyncMock(return_value={"platform": "vk", "post_id": "1"})
    )
    router = ContentFactoryPublisherRouter(
        telegram_provider=SimpleNamespace(),
        vk_provider=vk_provider,
    )

    result = await router.publish(session, item, bot=SimpleNamespace())

    assert result == {"platform": "vk", "post_id": "1"}
    vk_provider.publish_loaded.assert_awaited_once_with(
        session=session,
        publication=publication,
        platform=platform,
        item=item,
    )


@pytest.mark.asyncio
async def test_send_now_records_common_provider_failure_platform(monkeypatch):
    item = make_queue_item()
    session = make_session(make_publication(item))
    publisher = SimpleNamespace(
        publish=AsyncMock(
            side_effect=ContentFactoryPublisherError(
                "VK API token is not configured",
                platform="vk",
            )
        )
    )
    service = ContentFactoryPublishingSchedulerService(
        bot=SimpleNamespace(),
        session_maker=FakeSessionMaker(session),
        publisher=publisher,
    )
    monkeypatch.setattr(
        PublishingQueueService,
        "get_item",
        AsyncMock(return_value=item),
    )
    monkeypatch.setattr(
        PublishingQueueService,
        "mark_processing",
        AsyncMock(return_value=item),
    )
    monkeypatch.setattr(
        PublishingQueueService,
        "record_attempt_failure",
        AsyncMock(return_value=item),
    )

    result = await service.send_now(session, item.id, actor_id=uuid.uuid4())

    assert result is item
    failure_kwargs = PublishingQueueService.record_attempt_failure.await_args.kwargs
    assert failure_kwargs["error_message"] == "VK API token is not configured"
    assert failure_kwargs["provider_response"] == {"platform": "vk"}
