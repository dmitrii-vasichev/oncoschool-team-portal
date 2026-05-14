import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

from app.api.content_factory import bundles as bundles_api
from app.api.content_factory.deps import require_cf_admin
from app.db.schemas import CFBundleCreate, CFBundleUpdate


def cf_member(role="member", has_cf=True):
    return SimpleNamespace(
        id=uuid.uuid4(), role=role, is_active=True,
        has_content_factory_access=has_cf,
    )


def make_bundle(**ov):
    base = {
        "id": uuid.uuid4(), "short_id": "BDL-1",
        "name": "Эфир по РМЖ", "product_stream": "onco_school",
        "status": "planning", "event_date": None, "owner_id": uuid.uuid4(),
        "brief": "Описание", "funnel_template_id": None,
        "source_material_refs": [], "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }
    base.update(ov)
    return SimpleNamespace(**base)


def bundle_create_data(**ov):
    base = {
        "name": "Test", "product_stream": "onco_school",
        "status": "planning", "owner_id": uuid.uuid4(),
        "brief": "X", "funnel_template_id": None,
        "source_material_refs": [],
    }
    base.update(ov)
    return CFBundleCreate(**base)


@pytest.mark.asyncio
async def test_list_bundles_filters_pass_through(monkeypatch):
    session = AsyncMock()
    listed = [make_bundle(), make_bundle(name="Second")]
    monkeypatch.setattr(
        bundles_api.bundle_service, "list",
        AsyncMock(return_value=listed),
    )

    result = await bundles_api.list_bundles(
        member=cf_member(), session=session,
        product_stream=None, status=None, owner_id=None,
        limit=100, offset=0,
    )
    assert len(result) == 2
    bundles_api.bundle_service.list.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_bundle_persists(monkeypatch):
    bundle = make_bundle()
    session = AsyncMock()
    monkeypatch.setattr(
        bundles_api.bundle_service, "create",
        AsyncMock(return_value=bundle),
    )
    result = await bundles_api.create_bundle(
        data=bundle_create_data(), member=cf_member(), session=session,
    )
    assert result is bundle
    session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_get_bundle_404(monkeypatch):
    session = AsyncMock()
    monkeypatch.setattr(
        bundles_api.bundle_service, "get", AsyncMock(return_value=None)
    )
    with pytest.raises(HTTPException) as exc:
        await bundles_api.get_bundle(
            bundle_id=uuid.uuid4(), member=cf_member(), session=session,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_update_bundle_404(monkeypatch):
    session = AsyncMock()
    monkeypatch.setattr(
        bundles_api.bundle_service, "update", AsyncMock(return_value=None)
    )
    with pytest.raises(HTTPException) as exc:
        await bundles_api.update_bundle(
            bundle_id=uuid.uuid4(),
            data=CFBundleUpdate(name="X"),
            member=cf_member(), session=session,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_delete_bundle_requires_admin():
    # Even a flagged non-admin member must be rejected by the dep.
    non_admin = cf_member(role="member", has_cf=True)
    with pytest.raises(HTTPException) as exc:
        await require_cf_admin(member=non_admin)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_delete_bundle_returns_204_when_empty(monkeypatch):
    admin = cf_member(role="admin")
    bundle = make_bundle()
    session = AsyncMock()
    monkeypatch.setattr(
        bundles_api.bundle_service, "get", AsyncMock(return_value=bundle)
    )
    monkeypatch.setattr(
        bundles_api.bundle_service, "delete", AsyncMock(return_value=True)
    )
    # FK pre-check returns 0 (no publications):
    count_result = MagicMock()
    count_result.scalar_one = MagicMock(return_value=0)
    session.execute = AsyncMock(return_value=count_result)

    result = await bundles_api.delete_bundle(
        bundle_id=bundle.id, member=admin, session=session,
    )
    assert result.status_code == 204
    session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_delete_bundle_404_when_missing(monkeypatch):
    admin = cf_member(role="admin")
    session = AsyncMock()
    monkeypatch.setattr(
        bundles_api.bundle_service, "get", AsyncMock(return_value=None)
    )
    with pytest.raises(HTTPException) as exc:
        await bundles_api.delete_bundle(
            bundle_id=uuid.uuid4(), member=admin, session=session,
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_delete_bundle_409_when_has_publications(monkeypatch):
    admin = cf_member(role="admin")
    bundle = make_bundle()
    session = AsyncMock()
    monkeypatch.setattr(
        bundles_api.bundle_service, "get", AsyncMock(return_value=bundle)
    )
    delete_mock = AsyncMock(return_value=True)
    monkeypatch.setattr(bundles_api.bundle_service, "delete", delete_mock)
    count_result = MagicMock()
    count_result.scalar_one = MagicMock(return_value=3)
    session.execute = AsyncMock(return_value=count_result)

    with pytest.raises(HTTPException) as exc:
        await bundles_api.delete_bundle(
            bundle_id=bundle.id, member=admin, session=session,
        )
    assert exc.value.status_code == 409
    assert "3 публикаций" in exc.value.detail
    delete_mock.assert_not_awaited()
