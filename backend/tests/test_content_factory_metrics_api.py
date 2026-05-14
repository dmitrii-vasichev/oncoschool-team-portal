import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.api.content_factory import metrics as metrics_api
from app.db.schemas import CFMetricSnapshotCreate


def cf_member(has_cf=True):
    return SimpleNamespace(
        id=uuid.uuid4(), role="member", is_active=True,
        has_content_factory_access=has_cf,
    )


def metric_create(**ov):
    base = {
        "publication_id": uuid.uuid4(),
        "window": "24h", "metric_name": "views",
        "metric_value": 1000.0, "metric_value_text": None,
        "source": "manual", "source_method": "manual_entry",
        "confidence": "low",
        "raw_payload": None, "note": None,
        "captured_by_id": None,
    }
    base.update(ov)
    return CFMetricSnapshotCreate(**base)


def make_snap(**ov):
    base = {
        "id": uuid.uuid4(),
        "publication_id": uuid.uuid4(),
        "captured_at": datetime.now(UTC),
        "window": "24h", "metric_name": "views",
        "metric_value": 1000.0, "metric_value_text": None,
        "source": "manual", "source_method": "manual_entry",
        "confidence": "low",
        "raw_payload": None, "note": None,
        "captured_by_id": None,
    }
    base.update(ov)
    return SimpleNamespace(**base)


@pytest.mark.asyncio
async def test_record_metric_persists(monkeypatch):
    snap = make_snap()
    monkeypatch.setattr(
        metrics_api.metric_service, "record",
        AsyncMock(return_value=snap),
    )
    session = AsyncMock()
    member = cf_member()

    result = await metrics_api.record_metric(
        publication_id=snap.publication_id,
        data=metric_create(publication_id=snap.publication_id),
        member=member, session=session,
    )
    assert result is snap
    session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_record_metric_url_overrides_body_publication_id(monkeypatch):
    """If publication_id in body != URL, URL wins (we also set captured_by_id from member)."""
    snap = make_snap()
    captured_payload = {}

    async def fake_record(session, payload):
        captured_payload["data"] = payload
        return snap

    monkeypatch.setattr(metrics_api.metric_service, "record", fake_record)
    member = cf_member()
    url_pub_id = uuid.uuid4()
    data = metric_create(publication_id=uuid.uuid4())  # different from URL
    await metrics_api.record_metric(
        publication_id=url_pub_id,
        data=data, member=member, session=AsyncMock(),
    )
    assert captured_payload["data"].publication_id == url_pub_id
    assert captured_payload["data"].captured_by_id == member.id


@pytest.mark.asyncio
async def test_list_metrics_for_publication(monkeypatch):
    snaps = [make_snap(), make_snap(window="7d")]
    monkeypatch.setattr(
        metrics_api.metric_service, "list_for_publication",
        AsyncMock(return_value=snaps),
    )
    result = await metrics_api.list_metrics(
        publication_id=uuid.uuid4(),
        member=cf_member(), session=AsyncMock(),
    )
    assert len(result) == 2
