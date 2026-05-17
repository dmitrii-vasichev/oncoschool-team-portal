import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.services.content_factory.vk_metric_collector_service import (
    VKMetricCollectorError,
    VKMetricCollectorService,
    VKMetricsClient,
    VKPostMetrics,
    due_metric_windows,
    parse_vk_post_identity,
)


def test_parse_vk_post_identity_supports_ids_and_urls():
    assert parse_vk_post_identity("456", None, fallback_owner_id=-123).as_vk_ref == "-123_456"
    assert parse_vk_post_identity("-123_456", None, fallback_owner_id=None).as_vk_ref == "-123_456"
    assert parse_vk_post_identity("wall-123_456", None, fallback_owner_id=None).as_vk_ref == "-123_456"
    assert (
        parse_vk_post_identity(
            None,
            "https://vk.com/wall-123_456?from=feed",
            fallback_owner_id=None,
        ).as_vk_ref
        == "-123_456"
    )


def test_parse_vk_post_identity_requires_owner_for_plain_post_id():
    with pytest.raises(VKMetricCollectorError, match="owner id"):
        parse_vk_post_identity("456", None, fallback_owner_id=None)


def test_due_metric_windows_uses_age_and_configured_windows():
    published_at = datetime(2026, 5, 10, 12, 0, tzinfo=timezone.utc)
    now = published_at + timedelta(days=3, hours=1)

    assert due_metric_windows(
        published_at=published_at,
        now=now,
        configured_windows=["3h", "24h", "72h", "7d", "final"],
        final_after_days=30,
    ) == ["3h", "24h", "72h"]


@pytest.mark.asyncio
async def test_vk_metrics_client_maps_post_and_comment_counters():
    requests = []

    async def fake_post(url, data, timeout):
        requests.append((url, data, timeout))

        class Response:
            def raise_for_status(self):
                return None

            def json(self):
                if data.get("post_id"):
                    return {"response": {"count": 9, "items": []}}
                return {
                    "response": {
                        "items": [
                            {
                                "id": 456,
                                "owner_id": -123,
                                "views": {"count": 1000},
                                "likes": {"count": 40},
                                "reposts": {"count": 7},
                            }
                        ]
                    }
                }

        return Response()

    class FakeAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        post = staticmethod(fake_post)

    client = VKMetricsClient(
        access_token="token",
        api_version="5.199",
        async_client_factory=FakeAsyncClient,
    )

    metrics = await client.fetch_post_metrics(owner_id=-123, post_id=456)

    assert metrics.counters == {
        "views": 1000,
        "likes": 40,
        "reposts": 7,
        "comments": 9,
    }
    assert requests[0][1]["posts"] == "-123_456"
    assert requests[1][1]["owner_id"] == -123
    assert requests[1][1]["post_id"] == 456


@pytest.mark.asyncio
async def test_vk_metrics_client_raises_on_vk_error_without_token_leak():
    class FakeAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, url, data, timeout):
            class Response:
                def raise_for_status(self):
                    return None

                def json(self):
                    return {"error": {"error_code": 5, "error_msg": "User authorization failed"}}

            return Response()

    client = VKMetricsClient(
        access_token="super-secret-token",
        api_version="5.199",
        async_client_factory=FakeAsyncClient,
    )

    with pytest.raises(VKMetricCollectorError) as exc_info:
        await client.fetch_post_metrics(owner_id=-123, post_id=456)

    assert "super-secret-token" not in str(exc_info.value)
    assert "VK API rejected metrics request" in str(exc_info.value)


def _mock_publication_query(session, publications):
    result = Mock()
    result.scalars.return_value.all.return_value = publications
    session.execute.return_value = result


@pytest.mark.asyncio
async def test_vk_metric_collector_records_due_snapshots_with_provenance():
    publication = SimpleNamespace(
        id=uuid.uuid4(),
        published_at=datetime(2026, 5, 10, 12, 0, tzinfo=timezone.utc),
        actual_published_at=datetime(2026, 5, 10, 12, 0, tzinfo=timezone.utc),
        platform_post_id="-123_456",
        platform_post_url=None,
    )
    session = AsyncMock()
    _mock_publication_query(session, [publication])
    session.add = Mock()
    run = SimpleNamespace(id=uuid.uuid4(), status="running", source_config=None)
    source_config = SimpleNamespace(
        id=uuid.uuid4(),
        source="vk_api",
        config={"owner_id": "-123", "windows": ["24h"]},
        default_confidence="high",
        freshness_window_hours=24,
    )

    import_run_service = SimpleNamespace(
        start_run=AsyncMock(return_value=run),
        finish_run=AsyncMock(
            side_effect=lambda session, run, **kwargs: SimpleNamespace(
                **kwargs, id=run.id
            )
        ),
    )
    metric_service = SimpleNamespace(
        record_deduped=AsyncMock(
            side_effect=[
                SimpleNamespace(snapshot=SimpleNamespace(id=uuid.uuid4()), created=True),
                SimpleNamespace(snapshot=SimpleNamespace(id=uuid.uuid4()), created=True),
            ]
        )
    )
    client = SimpleNamespace(
        fetch_post_metrics=AsyncMock(
            return_value=VKPostMetrics(
                owner_id=-123,
                post_id=456,
                counters={"views": 1000, "likes": 40},
                raw_post={"id": 456},
                raw_comments={"count": 9},
            )
        )
    )
    collector = VKMetricCollectorService(
        client_factory=lambda access_token, api_version: client,
        import_run_service=import_run_service,
        metric_service=metric_service,
        access_token="token",
        default_owner_id=None,
        default_api_version="5.199",
        now_provider=lambda: datetime(2026, 5, 11, 13, 0, tzinfo=timezone.utc),
    )

    result = await collector.collect_for_source(
        session,
        source_config,
        triggered_by="manual",
    )

    assert result.status == "succeeded"
    assert result.found_count == 2
    assert result.created_count == 2
    first_payload = metric_service.record_deduped.await_args_list[0].args[1]
    assert first_payload.publication_id == publication.id
    assert first_payload.window == "24h"
    assert first_payload.metric_name == "views"
    assert first_payload.source == "vk_api"
    assert first_payload.source_method == "vk_api.wall.getById"
    assert first_payload.confidence == "high"
    assert first_payload.source_config_id == source_config.id
    assert first_payload.import_run_id == run.id
    assert first_payload.external_metric_id == "-123_456:views"
    assert first_payload.dedupe_key.endswith(":24h:views")


@pytest.mark.asyncio
async def test_vk_metric_collector_skips_duplicate_snapshots():
    publication = SimpleNamespace(
        id=uuid.uuid4(),
        published_at=datetime(2026, 5, 10, 12, 0, tzinfo=timezone.utc),
        actual_published_at=datetime(2026, 5, 10, 12, 0, tzinfo=timezone.utc),
        platform_post_id="-123_456",
        platform_post_url=None,
    )
    session = AsyncMock()
    _mock_publication_query(session, [publication])
    source_config = SimpleNamespace(
        id=uuid.uuid4(),
        source="vk_api",
        config={"owner_id": "-123", "windows": ["24h"]},
        default_confidence="medium",
        freshness_window_hours=24,
    )
    run = SimpleNamespace(id=uuid.uuid4(), status="running", source_config=None)
    import_run_service = SimpleNamespace(
        start_run=AsyncMock(return_value=run),
        finish_run=AsyncMock(
            side_effect=lambda session, run, **kwargs: SimpleNamespace(
                **kwargs, id=run.id
            )
        ),
    )
    metric_service = SimpleNamespace(
        record_deduped=AsyncMock(
            return_value=SimpleNamespace(
                snapshot=SimpleNamespace(id=uuid.uuid4()), created=False
            )
        )
    )
    client = SimpleNamespace(
        fetch_post_metrics=AsyncMock(
            return_value=VKPostMetrics(
                owner_id=-123,
                post_id=456,
                counters={"views": 1000},
                raw_post={"id": 456},
                raw_comments={"count": 0},
            )
        )
    )
    collector = VKMetricCollectorService(
        client_factory=lambda access_token, api_version: client,
        import_run_service=import_run_service,
        metric_service=metric_service,
        access_token="token",
        default_owner_id=None,
        default_api_version="5.199",
        now_provider=lambda: datetime(2026, 5, 11, 13, 0, tzinfo=timezone.utc),
    )

    result = await collector.collect_for_source(session, source_config, triggered_by="manual")

    assert result.created_count == 0
    assert result.skipped_duplicate_count == 1


@pytest.mark.asyncio
async def test_vk_metric_collector_marks_failed_when_publication_fails():
    session = AsyncMock()
    _mock_publication_query(
        session,
        [
            SimpleNamespace(
                id=uuid.uuid4(),
                published_at=datetime.now(timezone.utc),
                actual_published_at=datetime.now(timezone.utc),
                platform_post_id="bad",
                platform_post_url=None,
            )
        ],
    )
    source_config = SimpleNamespace(
        id=uuid.uuid4(),
        source="vk_api",
        config={"owner_id": "-123", "windows": ["3h"]},
        default_confidence="medium",
        freshness_window_hours=24,
    )
    run = SimpleNamespace(id=uuid.uuid4(), status="running", source_config=None)
    import_run_service = SimpleNamespace(
        start_run=AsyncMock(return_value=run),
        finish_run=AsyncMock(
            side_effect=lambda session, run, **kwargs: SimpleNamespace(
                **kwargs, id=run.id
            )
        ),
    )
    collector = VKMetricCollectorService(
        import_run_service=import_run_service,
        access_token="token",
        default_owner_id=None,
        default_api_version="5.199",
        now_provider=lambda: datetime.now(timezone.utc) + timedelta(hours=4),
    )

    result = await collector.collect_for_source(session, source_config, triggered_by="manual")

    assert result.status == "failed"
    assert result.error_count == 1
    assert "failed" in result.error_message.lower()


@pytest.mark.asyncio
async def test_vk_metric_collector_rejects_missing_token_before_external_calls():
    session = AsyncMock()
    source_config = SimpleNamespace(
        id=uuid.uuid4(),
        source="vk_api",
        config={"owner_id": "-123"},
        default_confidence="medium",
        freshness_window_hours=24,
    )
    collector = VKMetricCollectorService(access_token="", default_owner_id=None)

    with pytest.raises(VKMetricCollectorError, match="token"):
        await collector.collect_for_source(session, source_config, triggered_by="manual")
