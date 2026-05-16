# Content Factory Sprint 46 VK Publisher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add VK text publishing to the existing Content Factory publishing queue.

**Architecture:** Keep queue lifecycle in `ContentFactoryPublishingSchedulerService` and move platform-specific sending behind a provider router. Telegram remains supported through the existing Telegram service, while the new VK service posts text through VK `wall.post` using configured backend settings.

**Tech Stack:** FastAPI backend, SQLAlchemy async sessions, APScheduler, httpx, pytest, Next.js frontend source guards.

---

## File Structure

- Modify `backend/app/config.py`: add VK API settings.
- Create `backend/app/services/content_factory/publisher_errors.py`: common `ContentFactoryPublisherError`.
- Modify `backend/app/services/content_factory/telegram_publisher_service.py`: make `TelegramPublisherError` subclass the common publisher error.
- Create `backend/app/services/content_factory/vk_publisher_service.py`: VK text message builder, config validation, API call, response parsing.
- Create `backend/app/services/content_factory/publisher_router_service.py`: load publication/platform and route to Telegram or VK provider.
- Modify `backend/app/services/content_factory/publishing_scheduler_service.py`: depend on the router instead of a Telegram-only publisher and record failures with the provider platform code.
- Modify `backend/app/main.py`: instantiate the router with Telegram and VK providers.
- Modify `frontend/src/components/content-factory/ContentFactoryPublishingQueuePanel.tsx`: make queue copy platform-neutral.
- Modify `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`: guard the platform-neutral copy.
- Add `backend/tests/test_cf_vk_publisher_service.py`: VK publisher tests.
- Modify `backend/tests/test_cf_publishing_scheduler_service.py`: provider router/scheduler behavior tests.
- Add or modify docs: `docs/PLAN.md`, `docs/STATUS.md`, `docs/TEST_PLAN.md`, `docs/BACKLOG.md`.

## Task 1: VK Settings And Common Publisher Error

**Files:**
- Modify: `backend/app/config.py`
- Create: `backend/app/services/content_factory/publisher_errors.py`
- Modify: `backend/app/services/content_factory/telegram_publisher_service.py`
- Test: `backend/tests/test_cf_vk_publisher_service.py`

- [ ] **Step 1: Write failing tests for missing VK configuration**

Add tests that import `VKPublisherService` and verify it raises `ContentFactoryPublisherError` when token or owner id is missing:

```python
import uuid
from types import SimpleNamespace

import pytest

from app.services.content_factory.publisher_errors import ContentFactoryPublisherError
from app.services.content_factory.vk_publisher_service import VKPublisherConfig, VKPublisherService


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


@pytest.mark.asyncio
async def test_vk_publisher_rejects_missing_token():
    service = VKPublisherService(
        config=VKPublisherConfig(access_token="", owner_id=-123, api_version="5.199", from_group=True)
    )

    with pytest.raises(ContentFactoryPublisherError, match="VK API token"):
        await service.publish_loaded(
            session=SimpleNamespace(),
            publication=make_publication(),
            platform=make_platform(),
            item=SimpleNamespace(payload={}),
        )


@pytest.mark.asyncio
async def test_vk_publisher_rejects_missing_owner_id():
    service = VKPublisherService(
        config=VKPublisherConfig(access_token="token", owner_id=None, api_version="5.199", from_group=True)
    )

    with pytest.raises(ContentFactoryPublisherError, match="VK owner id"):
        await service.publish_loaded(
            session=SimpleNamespace(),
            publication=make_publication(),
            platform=make_platform(),
            item=SimpleNamespace(payload={}),
        )
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_vk_publisher_service.py -q
```

Expected: fail because `publisher_errors.py` and `vk_publisher_service.py` do not exist.

- [ ] **Step 3: Add settings and common error**

In `backend/app/config.py`, add:

```python
    # VK publishing
    VK_API_ACCESS_TOKEN: str = ""
    VK_API_VERSION: str = "5.199"
    VK_OWNER_ID: str = ""
    VK_FROM_GROUP: bool = True
```

Create `backend/app/services/content_factory/publisher_errors.py`:

```python
class ContentFactoryPublisherError(RuntimeError):
    """Raised when a Content Factory publisher cannot send safely."""

    def __init__(self, message: str, *, platform: str | None = None):
        super().__init__(message)
        self.platform = platform
```

Modify `backend/app/services/content_factory/telegram_publisher_service.py`:

```python
from app.services.content_factory.publisher_errors import ContentFactoryPublisherError


class TelegramPublisherError(ContentFactoryPublisherError):
    """Raised when a Telegram publication cannot be sent safely."""

    def __init__(self, message: str):
        super().__init__(message, platform=TELEGRAM_CHANNEL)
```

- [ ] **Step 4: Create minimal VK service config**

Create `backend/app/services/content_factory/vk_publisher_service.py` with:

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import CFPlatform, CFPublication, CFPublishingQueueItem
from app.services.content_factory.publisher_errors import ContentFactoryPublisherError


VK_CHANNEL = "vk"
PUBLISHABLE_STATUSES = {"approved", "scheduled"}


@dataclass(frozen=True)
class VKPublisherConfig:
    access_token: str
    owner_id: int | None
    api_version: str
    from_group: bool = True

    @classmethod
    def from_settings(cls) -> "VKPublisherConfig":
        raw_owner_id = str(settings.VK_OWNER_ID).strip()
        return cls(
            access_token=settings.VK_API_ACCESS_TOKEN,
            owner_id=int(raw_owner_id) if raw_owner_id else None,
            api_version=settings.VK_API_VERSION,
            from_group=settings.VK_FROM_GROUP,
        )


class VKPublisherService:
    def __init__(self, config: VKPublisherConfig | None = None):
        self.config = config or VKPublisherConfig.from_settings()

    async def publish_loaded(
        self,
        *,
        session: AsyncSession,
        publication: CFPublication,
        platform: CFPlatform,
        item: CFPublishingQueueItem,
    ) -> dict[str, Any]:
        self._validate_config()
        raise ContentFactoryPublisherError("VK publishing is not implemented yet", platform=VK_CHANNEL)

    def _validate_config(self) -> None:
        if not self.config.access_token:
            raise ContentFactoryPublisherError("VK API token is not configured", platform=VK_CHANNEL)
        if self.config.owner_id is None:
            raise ContentFactoryPublisherError("VK owner id is not configured", platform=VK_CHANNEL)
```

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_vk_publisher_service.py -q
```

Expected: 2 tests pass.

## Task 2: VK Message Builder And Validation

**Files:**
- Modify: `backend/app/services/content_factory/vk_publisher_service.py`
- Test: `backend/tests/test_cf_vk_publisher_service.py`

- [ ] **Step 1: Add failing tests for message selection and validation**

Add:

```python
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


def test_build_vk_message_uses_current_variant_plain_text():
    from app.services.content_factory.vk_publisher_service import build_vk_message

    message = build_vk_message(make_publication(), make_variant())

    assert message == "Variant title\n\nPlain <VK> body"


def test_build_vk_message_falls_back_to_publication_text():
    from app.services.content_factory.vk_publisher_service import build_vk_message

    message = build_vk_message(make_publication(title="Main", body_text="Body"), None)

    assert message == "Main\n\nBody"


@pytest.mark.asyncio
async def test_vk_publisher_rejects_non_vk_platform():
    service = VKPublisherService(
        config=VKPublisherConfig(access_token="token", owner_id=-123, api_version="5.199", from_group=True)
    )

    with pytest.raises(ContentFactoryPublisherError, match="supports only VK"):
        await service.publish_loaded(
            session=SimpleNamespace(),
            publication=make_publication(),
            platform=make_platform(code="telegram"),
            item=SimpleNamespace(payload={}),
        )


@pytest.mark.asyncio
async def test_vk_publisher_rejects_media_refs_before_sending():
    service = VKPublisherService(
        config=VKPublisherConfig(access_token="token", owner_id=-123, api_version="5.199", from_group=True)
    )

    with pytest.raises(ContentFactoryPublisherError, match="only text"):
        await service.publish_loaded(
            session=SimpleNamespace(),
            publication=make_publication(media_refs=[{"kind": "image"}]),
            platform=make_platform(),
            item=SimpleNamespace(payload={}),
        )
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_vk_publisher_service.py -q
```

Expected: fail because `build_vk_message` and validation behavior are missing.

- [ ] **Step 3: Implement message builder and validation**

Add to `vk_publisher_service.py`:

```python
from sqlalchemy import select

from app.db.models import CFPublicationVariant


def build_vk_message(publication: CFPublication, variant: CFPublicationVariant | None) -> str:
    source = variant or publication
    title = (getattr(source, "title", None) or "").strip()
    body = (getattr(source, "body_text", None) or "").strip()
    parts: list[str] = []
    if title:
        parts.append(title)
    if body:
        parts.append(body)
    return "\n\n".join(parts)
```

Add to `VKPublisherService`:

```python
    async def load_current_variant(
        self,
        session: AsyncSession,
        publication: CFPublication,
    ) -> CFPublicationVariant | None:
        result = await session.execute(
            select(CFPublicationVariant)
            .where(
                CFPublicationVariant.publication_id == publication.id,
                CFPublicationVariant.channel == VK_CHANNEL,
                CFPublicationVariant.source_version_number == publication.version_number,
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    def _validate_publication(self, publication: CFPublication, platform: CFPlatform) -> None:
        if platform.code != VK_CHANNEL:
            raise ContentFactoryPublisherError("VK publisher supports only VK publications", platform=VK_CHANNEL)
        if publication.status not in PUBLISHABLE_STATUSES:
            raise ContentFactoryPublisherError(
                "Публикация больше не находится в статусе Одобрено или Запланировано",
                platform=VK_CHANNEL,
            )
        if publication.media_refs:
            raise ContentFactoryPublisherError(
                "VK auto publishing currently supports only text publications without media",
                platform=VK_CHANNEL,
            )
```

Update `publish_loaded`:

```python
        self._validate_config()
        self._validate_publication(publication, platform)
        variant = await self.load_current_variant(session, publication)
        message = build_vk_message(publication, variant)
        if not message.strip():
            raise ContentFactoryPublisherError("No text is available for VK publishing", platform=VK_CHANNEL)
        raise ContentFactoryPublisherError("VK publishing is not implemented yet", platform=VK_CHANNEL)
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_vk_publisher_service.py -q
```

Expected: message and validation tests pass.

## Task 3: VK API Call And Response Parsing

**Files:**
- Modify: `backend/app/services/content_factory/vk_publisher_service.py`
- Test: `backend/tests/test_cf_vk_publisher_service.py`

- [ ] **Step 1: Add failing tests for API success and errors**

Add fake response/client helpers and tests:

```python
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
async def test_vk_publisher_posts_to_wall_and_returns_evidence(monkeypatch):
    fake_client = FakeVKClient({"response": {"post_id": 456}})
    monkeypatch.setattr(
        "app.services.content_factory.vk_publisher_service.httpx.AsyncClient",
        lambda: fake_client,
    )
    service = VKPublisherService(
        config=VKPublisherConfig(access_token="secret-token", owner_id=-123, api_version="5.199", from_group=True)
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
    fake_client = FakeVKClient({"error": {"error_code": 15, "error_msg": "Access denied"}})
    monkeypatch.setattr(
        "app.services.content_factory.vk_publisher_service.httpx.AsyncClient",
        lambda: fake_client,
    )
    service = VKPublisherService(
        config=VKPublisherConfig(access_token="secret-token", owner_id=-123, api_version="5.199", from_group=True)
    )

    with pytest.raises(ContentFactoryPublisherError, match="VK API rejected the post"):
        await service.publish_loaded(
            session=FakeSession(),
            publication=make_publication(),
            platform=make_platform(),
            item=SimpleNamespace(payload={}),
        )
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_vk_publisher_service.py -q
```

Expected: fail because HTTP call and response parsing are not implemented.

- [ ] **Step 3: Implement VK API call**

Add:

```python
import httpx


VK_WALL_POST_URL = "https://api.vk.com/method/wall.post"


def build_vk_post_url(owner_id: int, post_id: int | str) -> str:
    return f"https://vk.com/wall{owner_id}_{post_id}"
```

Replace final placeholder in `publish_loaded`:

```python
        payload = {
            "owner_id": self.config.owner_id,
            "from_group": 1 if self.config.from_group else 0,
            "message": message,
            "access_token": self.config.access_token,
            "v": self.config.api_version,
        }
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(VK_WALL_POST_URL, data=payload, timeout=15)
                response.raise_for_status()
                data = response.json()
        except ContentFactoryPublisherError:
            raise
        except Exception as exc:
            raise ContentFactoryPublisherError(f"VK API request failed: {str(exc)[:500]}", platform=VK_CHANNEL) from exc

        if isinstance(data, dict) and isinstance(data.get("error"), dict):
            error = data["error"]
            code = error.get("error_code")
            message_text = error.get("error_msg") or "unknown VK error"
            raise ContentFactoryPublisherError(
                f"VK API rejected the post: {code} {message_text}",
                platform=VK_CHANNEL,
            )

        response_data = data.get("response") if isinstance(data, dict) else None
        post_id = response_data.get("post_id") if isinstance(response_data, dict) else None
        if post_id is None:
            raise ContentFactoryPublisherError("VK API returned an unexpected response", platform=VK_CHANNEL)

        post_id_text = str(post_id)
        owner_id = int(self.config.owner_id)
        return {
            "platform": VK_CHANNEL,
            "owner_id": owner_id,
            "from_group": self.config.from_group,
            "post_id": post_id_text,
            "post_url": build_vk_post_url(owner_id, post_id_text),
            "response": {"post_id": post_id},
        }
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_vk_publisher_service.py -q
```

Expected: all VK publisher tests pass.

## Task 4: Provider Router And Scheduler Integration

**Files:**
- Create: `backend/app/services/content_factory/publisher_router_service.py`
- Modify: `backend/app/services/content_factory/publishing_scheduler_service.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_cf_publishing_scheduler_service.py`

- [ ] **Step 1: Add failing scheduler route tests**

Modify scheduler tests to use common publisher errors and assert platform-aware routing/failure:

```python
from app.services.content_factory.publisher_errors import ContentFactoryPublisherError
from app.services.content_factory.publisher_router_service import ContentFactoryPublisherRouter


@pytest.mark.asyncio
async def test_router_sends_vk_publication_to_vk_provider():
    item = make_queue_item()
    publication = make_publication(item)
    platform = SimpleNamespace(id=item.platform_id, code="vk")
    session = make_session(publication)
    session.get = AsyncMock(side_effect=[publication, platform])
    vk_provider = SimpleNamespace(publish_loaded=AsyncMock(return_value={"platform": "vk", "post_id": "1"}))
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
        publish=AsyncMock(side_effect=ContentFactoryPublisherError("VK API token is not configured", platform="vk"))
    )
    service = ContentFactoryPublishingSchedulerService(
        bot=SimpleNamespace(),
        session_maker=FakeSessionMaker(session),
        publisher=publisher,
    )
    monkeypatch.setattr(PublishingQueueService, "get_item", AsyncMock(return_value=item))
    monkeypatch.setattr(PublishingQueueService, "mark_processing", AsyncMock(return_value=item))
    monkeypatch.setattr(PublishingQueueService, "record_attempt_failure", AsyncMock(return_value=item))

    result = await service.send_now(session, item.id, actor_id=uuid.uuid4())

    assert result is item
    failure_kwargs = PublishingQueueService.record_attempt_failure.await_args.kwargs
    assert failure_kwargs["error_message"] == "VK API token is not configured"
    assert failure_kwargs["provider_response"] == {"platform": "vk"}
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_publishing_scheduler_service.py -q
```

Expected: fail because router does not exist and scheduler still catches Telegram-only errors.

- [ ] **Step 3: Implement router**

Create `backend/app/services/content_factory/publisher_router_service.py`:

```python
from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CFPlatform, CFPublication, CFPublishingQueueItem
from app.services.content_factory.publisher_errors import ContentFactoryPublisherError
from app.services.content_factory.telegram_publisher_service import TelegramPublisherService
from app.services.content_factory.vk_publisher_service import VKPublisherService


class ContentFactoryPublisherRouter:
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
            f"Автоотправка для площадки {platform.display_name or platform.code} пока не поддерживается",
            platform=platform.code,
        )
```

- [ ] **Step 4: Modify scheduler to catch common provider errors**

In `publishing_scheduler_service.py`, import:

```python
from app.services.content_factory.publisher_errors import ContentFactoryPublisherError
from app.services.content_factory.publisher_router_service import ContentFactoryPublisherRouter
```

Change constructor type/default:

```python
        publisher: ContentFactoryPublisherRouter | None = None,
...
        self.publisher = publisher or ContentFactoryPublisherRouter()
```

Change exception handler:

```python
        except ContentFactoryPublisherError as exc:
            await PublishingQueueService.record_attempt_failure(
                session,
                item,
                error_message=str(exc),
                retry_after=timedelta(minutes=5),
                provider_response={"platform": exc.platform or "unknown"},
            )
            return False
```

- [ ] **Step 5: Wire router in app startup**

In `backend/app/main.py`, import and instantiate:

```python
from app.services.content_factory.publisher_router_service import ContentFactoryPublisherRouter
from app.services.content_factory.telegram_publisher_service import TelegramPublisherService
from app.services.content_factory.vk_publisher_service import VKPublisherService
```

Then:

```python
content_factory_publishing_scheduler = ContentFactoryPublishingSchedulerService(
    bot=bot,
    session_maker=async_session,
    publisher=ContentFactoryPublisherRouter(
        telegram_provider=TelegramPublisherService(),
        vk_provider=VKPublisherService(),
    ),
)
```

- [ ] **Step 6: Run focused scheduler tests**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_publishing_scheduler_service.py -q
```

Expected: scheduler tests pass.

## Task 5: Frontend Queue Copy

**Files:**
- Modify: `frontend/src/components/content-factory/ContentFactoryPublishingQueuePanel.tsx`
- Modify: `frontend/src/components/content-factory/contentFactorySourceGuards.test.ts`

- [ ] **Step 1: Add failing source guard**

In `contentFactorySourceGuards.test.ts`, add assertion that the queue panel uses platform-neutral copy:

```typescript
assert.match(queuePanelSource, /Автоотправка/);
assert.doesNotMatch(queuePanelSource, /Telegram-автоотправка/);
```

- [ ] **Step 2: Run source guard to verify RED**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: fail because copy still says `Telegram-автоотправка`.

- [ ] **Step 3: Update queue panel copy**

Change:

```tsx
Telegram-автоотправка: очередь, попытки, ошибки и ручной обход.
```

To:

```tsx
Автоотправка в Telegram и VK: очередь, попытки, ошибки и ручной обход.
```

- [ ] **Step 4: Run source guard to verify GREEN**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: pass.

## Task 6: Durable Docs And Verification

**Files:**
- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/TEST_PLAN.md`
- Modify: `docs/BACKLOG.md`

- [ ] **Step 1: Update docs**

Document Sprint 46 as active in:

- `docs/PLAN.md`
- `docs/STATUS.md`
- `docs/TEST_PLAN.md`
- `docs/BACKLOG.md`

Include exact validation commands:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_vk_publisher_service.py tests/test_cf_publishing_scheduler_service.py tests/test_content_factory_publishing_queue_api.py -q
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest -q
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

- [ ] **Step 2: Run focused verification**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest tests/test_cf_vk_publisher_service.py tests/test_cf_publishing_scheduler_service.py tests/test_content_factory_publishing_queue_api.py -q
cd frontend && node --test --experimental-strip-types src/components/content-factory/contentFactorySourceGuards.test.ts
```

Expected: all focused checks pass.

- [ ] **Step 3: Run full verification**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://cfuser:cfpass@localhost:5434/oncoschool_cf OPENAI_API_KEY=test pytest -q
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

Expected: all commands pass.

- [ ] **Step 4: Commit implementation**

Run:

```bash
git add backend/app/config.py backend/app/services/content_factory/publisher_errors.py backend/app/services/content_factory/telegram_publisher_service.py backend/app/services/content_factory/vk_publisher_service.py backend/app/services/content_factory/publisher_router_service.py backend/app/services/content_factory/publishing_scheduler_service.py backend/app/main.py backend/tests/test_cf_vk_publisher_service.py backend/tests/test_cf_publishing_scheduler_service.py frontend/src/components/content-factory/ContentFactoryPublishingQueuePanel.tsx frontend/src/components/content-factory/contentFactorySourceGuards.test.ts docs/PLAN.md docs/STATUS.md docs/TEST_PLAN.md docs/BACKLOG.md
git commit -m "feat(cf): publish queued vk posts"
```

## Plan Self-Review

- Spec coverage: the plan covers VK settings, text publishing, provider routing, scheduler error handling, frontend copy, durable docs, and verification.
- Scope: media attachments, OAuth UI, VK metrics, and multi-target management remain out of scope.
- Placeholder scan: no TODO/TBD placeholders are required for implementation.
- Type consistency: the common error is `ContentFactoryPublisherError`; VK channel code is `vk`; provider response uses `post_id` and `post_url`.
