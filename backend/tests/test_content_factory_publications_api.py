import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api.content_factory import publications as pubs_api
from app.db.schemas import (
    CFPublicationCreate,
    CFPublicationSegmentTargetCreate,
    CFPublicationUpdate,
)


def cf_member(role="member", has_cf=True):
    return SimpleNamespace(
        id=uuid.uuid4(), role=role, is_active=True,
        has_content_factory_access=has_cf,
    )


def make_pub(**ov):
    base = {
        "id": uuid.uuid4(), "short_id": "PUB-1",
        "bundle_id": uuid.uuid4(),
        "platform_id": uuid.uuid4(),
        "format_id": uuid.uuid4(),
        "rubric_id": None, "nosology_id": None,
        "title": "X", "body_text": "B", "media_refs": [],
        "scheduled_at": None, "actual_published_at": None,
        "responsible_id": uuid.uuid4(),
        "status": "draft", "platform_post_url": None,
        "platform_post_id": None, "utm": {},
        "version_number": 1, "cancelled_reason": None,
        "created_at": datetime.now(UTC), "updated_at": datetime.now(UTC),
    }
    base.update(ov)
    return SimpleNamespace(**base)


def pub_create_data(bundle_id=None, **ov):
    base = {
        "bundle_id": bundle_id or uuid.uuid4(),
        "platform_id": uuid.uuid4(),
        "format_id": uuid.uuid4(),
        "rubric_id": None, "nosology_id": None,
        "title": "T", "body_text": "B", "media_refs": [],
        "scheduled_at": None,
        "responsible_id": uuid.uuid4(),
        "status": "draft", "utm": {},
    }
    base.update(ov)
    return CFPublicationCreate(**base)


@pytest.mark.asyncio
async def test_list_publications_by_bundle(monkeypatch):
    session = AsyncMock()
    pubs = [make_pub(), make_pub(status="approved")]
    monkeypatch.setattr(
        pubs_api.publication_service, "list_by_bundle",
        AsyncMock(return_value=pubs),
    )
    result = await pubs_api.list_publications_for_bundle(
        bundle_id=uuid.uuid4(), member=cf_member(), session=session,
    )
    assert len(result) == 2


@pytest.mark.asyncio
async def test_list_publications_passes_filters(monkeypatch):
    bundle_id = uuid.uuid4()
    platform_id = uuid.uuid4()
    responsible_id = uuid.uuid4()
    pubs = [
        make_pub(
            bundle_id=bundle_id,
            platform_id=platform_id,
            responsible_id=responsible_id,
            status="scheduled",
        )
    ]
    monkeypatch.setattr(
        pubs_api.publication_service,
        "list",
        AsyncMock(return_value=pubs),
    )
    session = AsyncMock()

    result = await pubs_api.list_publications(
        member=cf_member(),
        session=session,
        bundle_id=bundle_id,
        status="scheduled",
        platform_id=platform_id,
        format_id=None,
        responsible_id=responsible_id,
        scheduled_from=None,
        scheduled_to=None,
        limit=100,
        offset=0,
    )

    assert result == pubs
    pubs_api.publication_service.list.assert_awaited_once_with(
        session,
        bundle_id=bundle_id,
        status="scheduled",
        platform_id=platform_id,
        format_id=None,
        responsible_id=responsible_id,
        scheduled_from=None,
        scheduled_to=None,
        limit=100,
        offset=0,
    )


@pytest.mark.asyncio
async def test_create_publication_persists(monkeypatch):
    me = cf_member()
    bundle_id = uuid.uuid4()
    pub = make_pub(bundle_id=bundle_id)
    session = AsyncMock()
    monkeypatch.setattr(
        pubs_api.publication_service, "create",
        AsyncMock(return_value=pub),
    )
    result = await pubs_api.create_publication_for_bundle(
        bundle_id=bundle_id,
        data=pub_create_data(bundle_id=bundle_id),
        member=me, session=session,
    )
    assert result is pub
    pubs_api.publication_service.create.assert_awaited()
    session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_create_publication_rejects_mismatched_bundle_id(monkeypatch):
    me = cf_member()
    session = AsyncMock()
    with pytest.raises(HTTPException) as exc:
        await pubs_api.create_publication_for_bundle(
            bundle_id=uuid.uuid4(),
            data=pub_create_data(bundle_id=uuid.uuid4()),
            member=me, session=session,
        )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_get_publication_404(monkeypatch):
    monkeypatch.setattr(
        pubs_api.publication_service, "get", AsyncMock(return_value=None)
    )
    with pytest.raises(HTTPException) as exc:
        await pubs_api.get_publication(
            publication_id=uuid.uuid4(),
            member=cf_member(), session=AsyncMock(),
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_update_publication_404(monkeypatch):
    monkeypatch.setattr(
        pubs_api.publication_service, "update", AsyncMock(return_value=None)
    )
    with pytest.raises(HTTPException) as exc:
        await pubs_api.update_publication(
            publication_id=uuid.uuid4(),
            data=CFPublicationUpdate(title="x"),
            member=cf_member(), session=AsyncMock(),
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_list_versions(monkeypatch):
    versions = [SimpleNamespace(
        id=uuid.uuid4(), publication_id=uuid.uuid4(),
        version_number=1, body_text="b", edited_by_id=uuid.uuid4(),
        edited_at=datetime.now(UTC), approval_event="drafted",
        source_materials_refs=[], notes=None,
    )]
    monkeypatch.setattr(
        pubs_api.publication_service, "list_versions",
        AsyncMock(return_value=versions),
    )
    result = await pubs_api.list_publication_versions(
        publication_id=uuid.uuid4(),
        member=cf_member(), session=AsyncMock(),
    )
    assert len(result) == 1


@pytest.mark.asyncio
async def test_add_segment_target(monkeypatch):
    target = SimpleNamespace(
        id=uuid.uuid4(),
        publication_id=uuid.uuid4(),
        external_segment_id=uuid.uuid4(),
        role="target",
        expected_count=100,
        actual_count_at_send=None,
    )
    monkeypatch.setattr(
        pubs_api.publication_service, "add_segment_target",
        AsyncMock(return_value=target),
    )
    session = AsyncMock()
    result = await pubs_api.add_segment_target(
        publication_id=uuid.uuid4(),
        data=CFPublicationSegmentTargetCreate(
            external_segment_id=uuid.uuid4(),
            role="target",
            expected_count=100,
        ),
        member=cf_member(), session=session,
    )
    assert result.role == "target"
    session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_remove_segment_target_404(monkeypatch):
    monkeypatch.setattr(
        pubs_api.publication_service, "remove_segment_target",
        AsyncMock(return_value=False),
    )
    with pytest.raises(HTTPException) as exc:
        await pubs_api.remove_segment_target(
            publication_id=uuid.uuid4(),
            external_segment_id=uuid.uuid4(),
            member=cf_member(), session=AsyncMock(),
        )
    assert exc.value.status_code == 404
