import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api.content_factory import segments as seg_api
from app.db.schemas import CFExternalSegmentCreate, CFSegmentRefreshRequest


def cf_member(has_cf=True):
    return SimpleNamespace(
        id=uuid.uuid4(), role="member", is_active=True,
        has_content_factory_access=has_cf,
    )


def make_seg(**ov):
    base = {
        "id": uuid.uuid4(), "source": "getcourse",
        "source_segment_id": "S1", "source_url": "https://x",
        "name": "Сегмент", "description": None,
        "population_count": 100, "is_active": True,
        "owner_id": uuid.uuid4(),
        "last_fetched_at": datetime.now(UTC),
        "filter_hash": None,
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }
    base.update(ov)
    return SimpleNamespace(**base)


def seg_create_data(**ov):
    base = {
        "source": "getcourse",
        "source_segment_id": f"S-{uuid.uuid4()}",
        "source_url": "https://x",
        "name": "X", "description": None,
        "population_count": 100, "is_active": True,
        "owner_id": uuid.uuid4(),
    }
    base.update(ov)
    return CFExternalSegmentCreate(**base)


@pytest.mark.asyncio
async def test_list_segments(monkeypatch):
    monkeypatch.setattr(
        seg_api.segment_service, "list",
        AsyncMock(return_value=[make_seg(), make_seg()]),
    )
    result = await seg_api.list_segments(
        member=cf_member(), session=AsyncMock(), only_active=True,
    )
    assert len(result) == 2


@pytest.mark.asyncio
async def test_create_segment(monkeypatch):
    seg = make_seg()
    monkeypatch.setattr(
        seg_api.segment_service, "create",
        AsyncMock(return_value=seg),
    )
    session = AsyncMock()
    result = await seg_api.create_segment(
        data=seg_create_data(), member=cf_member(), session=session,
    )
    assert result is seg
    session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_get_segment_404(monkeypatch):
    monkeypatch.setattr(
        seg_api.segment_service, "get", AsyncMock(return_value=None)
    )
    with pytest.raises(HTTPException) as exc:
        await seg_api.get_segment(
            segment_id=uuid.uuid4(),
            member=cf_member(), session=AsyncMock(),
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_refresh_segment_404(monkeypatch):
    monkeypatch.setattr(
        seg_api.segment_service, "refresh_population",
        AsyncMock(return_value=None),
    )
    with pytest.raises(HTTPException) as exc:
        await seg_api.refresh_segment(
            segment_id=uuid.uuid4(),
            data=CFSegmentRefreshRequest(population_count=200),
            member=cf_member(), session=AsyncMock(),
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_refresh_segment_persists(monkeypatch):
    seg = make_seg(population_count=200)
    monkeypatch.setattr(
        seg_api.segment_service, "refresh_population",
        AsyncMock(return_value=seg),
    )
    session = AsyncMock()
    result = await seg_api.refresh_segment(
        segment_id=seg.id,
        data=CFSegmentRefreshRequest(population_count=200),
        member=cf_member(), session=session,
    )
    assert result is seg
    session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_list_snapshots(monkeypatch):
    snap = SimpleNamespace(
        id=uuid.uuid4(),
        external_segment_id=uuid.uuid4(),
        population_count=100,
        fetched_at=datetime.now(UTC),
        raw_payload=None,
        notes=None,
    )
    monkeypatch.setattr(
        seg_api.segment_service, "list_snapshots",
        AsyncMock(return_value=[snap]),
    )
    result = await seg_api.list_segment_snapshots(
        segment_id=uuid.uuid4(),
        member=cf_member(), session=AsyncMock(),
    )
    assert len(result) == 1
