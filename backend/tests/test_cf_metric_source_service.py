import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.db.schemas import CFMetricSourceConfigCreate
from app.services.content_factory.metric_source_service import (
    MetricImportRunService,
    MetricSourceConfigService,
)


@pytest.mark.asyncio
async def test_create_metric_source_config_adds_record():
    session = AsyncMock()
    session.add = Mock()
    payload = CFMetricSourceConfigCreate(
        source="vk_api",
        name="VK wall metrics",
        freshness_window_hours=24,
        default_confidence="medium",
        config={"owner_id": "-123"},
        created_by_id=uuid.uuid4(),
    )

    result = await MetricSourceConfigService.create(session, payload)

    assert result.name == "VK wall metrics"
    assert result.source == "vk_api"
    session.add.assert_called_once()


@pytest.mark.asyncio
async def test_start_import_run_creates_running_run():
    session = AsyncMock()
    session.add = Mock()
    source = SimpleNamespace(id=uuid.uuid4())

    run = await MetricImportRunService.start_run(
        session,
        source,
        triggered_by="manual",
        requested_by_id=uuid.uuid4(),
    )

    assert run.status == "running"
    assert run.source_config_id == source.id
    session.add.assert_called_once()


@pytest.mark.asyncio
async def test_finish_import_run_success_updates_source_state():
    session = AsyncMock()
    source = SimpleNamespace(
        id=uuid.uuid4(),
        last_run_at=None,
        last_success_at=None,
        last_error_at=None,
        last_error_message=None,
    )
    run = SimpleNamespace(
        id=uuid.uuid4(),
        source_config=source,
        status="running",
        found_count=0,
        created_count=0,
        skipped_duplicate_count=0,
        error_count=0,
        error_message=None,
        raw_summary=None,
        finished_at=None,
    )

    result = await MetricImportRunService.finish_run(
        session,
        run,
        status="succeeded",
        found_count=10,
        created_count=8,
        skipped_duplicate_count=2,
        error_count=0,
        raw_summary={"provider": "test"},
    )

    assert result.status == "succeeded"
    assert source.last_success_at is not None
    assert source.last_error_message is None
