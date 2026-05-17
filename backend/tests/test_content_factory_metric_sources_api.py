import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.api.content_factory import metric_sources as metric_sources_api
from app.db.schemas import CFMetricSourceConfigCreate, CFMetricSourceConfigUpdate


def cf_member():
    return SimpleNamespace(
        id=uuid.uuid4(),
        role="member",
        is_active=True,
        has_content_factory_access=True,
    )


def make_source_config(**overrides):
    now = datetime.now(UTC)
    data = {
        "id": uuid.uuid4(),
        "source": "vk_api",
        "name": "VK wall metrics",
        "description": None,
        "is_active": True,
        "freshness_window_hours": 24,
        "default_confidence": "medium",
        "config": {"owner_id": "-123"},
        "credentials_ref": None,
        "created_by_id": uuid.uuid4(),
        "last_run_at": None,
        "last_success_at": None,
        "last_error_at": None,
        "last_error_message": None,
        "created_at": now,
        "updated_at": now,
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def make_import_run(**overrides):
    now = datetime.now(UTC)
    data = {
        "id": uuid.uuid4(),
        "source_config_id": uuid.uuid4(),
        "status": "succeeded",
        "triggered_by": "manual",
        "requested_by_id": uuid.uuid4(),
        "started_at": now,
        "finished_at": now,
        "found_count": 10,
        "created_count": 8,
        "skipped_duplicate_count": 2,
        "error_count": 0,
        "error_message": None,
        "raw_summary": {"provider": "test"},
        "created_at": now,
        "updated_at": now,
    }
    data.update(overrides)
    return SimpleNamespace(**data)


@pytest.mark.asyncio
async def test_list_metric_sources(monkeypatch):
    source = make_source_config()
    monkeypatch.setattr(
        metric_sources_api.source_config_service,
        "list",
        AsyncMock(return_value=[source]),
    )

    result = await metric_sources_api.list_metric_sources(
        member=cf_member(),
        session=AsyncMock(),
        source=None,
        is_active=None,
        limit=100,
        offset=0,
    )

    assert result == [source]


@pytest.mark.asyncio
async def test_create_metric_source_sets_member(monkeypatch):
    captured = {}

    async def fake_create(session, payload):
        captured["payload"] = payload
        return make_source_config(created_by_id=payload.created_by_id)

    monkeypatch.setattr(metric_sources_api.source_config_service, "create", fake_create)
    member = cf_member()
    session = AsyncMock()

    result = await metric_sources_api.create_metric_source(
        data=CFMetricSourceConfigCreate(source="vk_api", name="VK metrics"),
        member=member,
        session=session,
    )

    assert captured["payload"].created_by_id == member.id
    assert result.created_by_id == member.id
    session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_update_metric_source_returns_404_for_missing(monkeypatch):
    monkeypatch.setattr(
        metric_sources_api.source_config_service,
        "update",
        AsyncMock(return_value=None),
    )

    with pytest.raises(metric_sources_api.HTTPException) as exc:
        await metric_sources_api.update_metric_source(
            source_config_id=uuid.uuid4(),
            data=CFMetricSourceConfigUpdate(name="Updated"),
            member=cf_member(),
            session=AsyncMock(),
        )

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_list_metric_import_runs(monkeypatch):
    run = make_import_run()
    monkeypatch.setattr(
        metric_sources_api.import_run_service,
        "list_runs",
        AsyncMock(return_value=[run]),
    )

    result = await metric_sources_api.list_metric_import_runs(
        member=cf_member(),
        session=AsyncMock(),
        source_config_id=None,
        status=None,
        limit=100,
        offset=0,
    )

    assert result == [run]
