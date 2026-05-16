import uuid
from types import SimpleNamespace

import pytest

from app.services.content_factory.publisher_errors import ContentFactoryPublisherError
from app.services.content_factory.vk_publisher_service import (
    VKPublisherConfig,
    VKPublisherService,
    build_vk_message,
)


def make_publication(**overrides):
    base = {
        "id": uuid.uuid4(),
        "platform_id": uuid.uuid4(),
        "title": "VK title",
        "body_text": "VK body",
        "media_refs": [],
        "status": "scheduled",
        "version_number": 1,
        "utm": {},
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def make_platform(code="vk"):
    return SimpleNamespace(id=uuid.uuid4(), code=code, display_name="ВКонтакте")


def make_variant(**overrides):
    base = {
        "publication_id": uuid.uuid4(),
        "channel": "vk",
        "title": "Variant title",
        "body_text": "Plain <VK> body",
        "source_version_number": 1,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


class FakeVKResponse:
    def __init__(self, payload):
        self._payload = payload

    def json(self):
        return self._payload

    def raise_for_status(self):
        return None


class FakeVKClient:
    def __init__(self, payload):
        self.payload = payload
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return None

    async def post(self, url, data, timeout):
        self.calls.append({"url": url, "data": data, "timeout": timeout})
        return FakeVKResponse(self.payload)


class FakeScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeSession:
    def __init__(self, variant=None):
        self.variant = variant

    async def execute(self, statement):
        return FakeScalarResult(self.variant)


@pytest.mark.asyncio
async def test_vk_publisher_rejects_missing_token():
    service = VKPublisherService(
        config=VKPublisherConfig(
            access_token="",
            owner_id=-123,
            api_version="5.199",
            from_group=True,
        )
    )

    with pytest.raises(ContentFactoryPublisherError, match="VK API token"):
        await service.publish_loaded(
            session=FakeSession(),
            publication=make_publication(),
            platform=make_platform(),
            item=SimpleNamespace(payload={}),
        )


@pytest.mark.asyncio
async def test_vk_publisher_rejects_missing_owner_id():
    service = VKPublisherService(
        config=VKPublisherConfig(
            access_token="token",
            owner_id=None,
            api_version="5.199",
            from_group=True,
        )
    )

    with pytest.raises(ContentFactoryPublisherError, match="VK owner id"):
        await service.publish_loaded(
            session=FakeSession(),
            publication=make_publication(),
            platform=make_platform(),
            item=SimpleNamespace(payload={}),
        )


def test_build_vk_message_uses_current_variant_plain_text():
    message = build_vk_message(make_publication(), make_variant())

    assert message == "Variant title\n\nPlain <VK> body"


def test_build_vk_message_falls_back_to_publication_text():
    message = build_vk_message(make_publication(title="Main", body_text="Body"), None)

    assert message == "Main\n\nBody"


@pytest.mark.asyncio
async def test_vk_publisher_rejects_non_vk_platform():
    service = VKPublisherService(
        config=VKPublisherConfig(
            access_token="token",
            owner_id=-123,
            api_version="5.199",
            from_group=True,
        )
    )

    with pytest.raises(ContentFactoryPublisherError, match="supports only VK"):
        await service.publish_loaded(
            session=FakeSession(),
            publication=make_publication(),
            platform=make_platform(code="telegram"),
            item=SimpleNamespace(payload={}),
        )


@pytest.mark.asyncio
async def test_vk_publisher_rejects_media_refs_before_sending():
    service = VKPublisherService(
        config=VKPublisherConfig(
            access_token="token",
            owner_id=-123,
            api_version="5.199",
            from_group=True,
        )
    )

    with pytest.raises(ContentFactoryPublisherError, match="only text"):
        await service.publish_loaded(
            session=FakeSession(),
            publication=make_publication(media_refs=[{"kind": "image"}]),
            platform=make_platform(),
            item=SimpleNamespace(payload={}),
        )


@pytest.mark.asyncio
async def test_vk_publisher_posts_to_wall_and_returns_evidence(monkeypatch):
    fake_client = FakeVKClient({"response": {"post_id": 456}})
    monkeypatch.setattr(
        "app.services.content_factory.vk_publisher_service.httpx.AsyncClient",
        lambda: fake_client,
    )
    service = VKPublisherService(
        config=VKPublisherConfig(
            access_token="secret-token",
            owner_id=-123,
            api_version="5.199",
            from_group=True,
        )
    )

    result = await service.publish_loaded(
        session=FakeSession(variant=make_variant(title="VK", body_text="Body")),
        publication=make_publication(),
        platform=make_platform(),
        item=SimpleNamespace(payload={}),
    )

    assert result["platform"] == "vk"
    assert result["owner_id"] == -123
    assert result["post_id"] == "456"
    assert result["post_url"] == "https://vk.com/wall-123_456"
    assert fake_client.calls[0]["url"] == "https://api.vk.com/method/wall.post"
    sent = fake_client.calls[0]["data"]
    assert sent["owner_id"] == -123
    assert sent["from_group"] == 1
    assert sent["message"] == "VK\n\nBody"
    assert sent["v"] == "5.199"
    assert sent["access_token"] == "secret-token"


@pytest.mark.asyncio
async def test_vk_publisher_translates_vk_api_error(monkeypatch):
    fake_client = FakeVKClient(
        {"error": {"error_code": 15, "error_msg": "Access denied"}}
    )
    monkeypatch.setattr(
        "app.services.content_factory.vk_publisher_service.httpx.AsyncClient",
        lambda: fake_client,
    )
    service = VKPublisherService(
        config=VKPublisherConfig(
            access_token="secret-token",
            owner_id=-123,
            api_version="5.199",
            from_group=True,
        )
    )

    with pytest.raises(ContentFactoryPublisherError, match="VK API rejected the post"):
        await service.publish_loaded(
            session=FakeSession(),
            publication=make_publication(),
            platform=make_platform(),
            item=SimpleNamespace(payload={}),
        )
