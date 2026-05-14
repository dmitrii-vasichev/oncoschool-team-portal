import uuid
from datetime import UTC, date, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api.content_factory import retros as retros_api
from app.db.schemas import CFRetroNoteCreate, CFRetroNoteUpdate


def cf_member(has_cf=True):
    return SimpleNamespace(
        id=uuid.uuid4(), role="member", is_active=True,
        has_content_factory_access=has_cf,
    )


def make_retro(**ov):
    base = {
        "id": uuid.uuid4(),
        "period_start": date(2026, 5, 1),
        "period_end": date(2026, 5, 7),
        "retro_type": "weekly",
        "bundle_id": None,
        "facilitator_id": uuid.uuid4(),
        "best_by_objective": {},
        "broken": [], "learnings": {},
        "decisions": {}, "actions": [],
        "notes": "",
        "created_at": datetime.now(UTC),
    }
    base.update(ov)
    return SimpleNamespace(**base)


def retro_create():
    return CFRetroNoteCreate(
        period_start=date(2026, 5, 1),
        period_end=date(2026, 5, 7),
        retro_type="weekly",
        bundle_id=None,
        facilitator_id=uuid.uuid4(),
        best_by_objective={},
        broken=[],
        learnings={},
        decisions={},
        actions=[],
        notes="",
    )


@pytest.mark.asyncio
async def test_list_retros(monkeypatch):
    monkeypatch.setattr(
        retros_api.retro_service, "list",
        AsyncMock(return_value=[make_retro(), make_retro(retro_type="monthly")]),
    )
    result = await retros_api.list_retros(
        member=cf_member(), session=AsyncMock(),
        retro_type=None, limit=50,
    )
    assert len(result) == 2


@pytest.mark.asyncio
async def test_create_retro(monkeypatch):
    retro = make_retro()
    monkeypatch.setattr(
        retros_api.retro_service, "create",
        AsyncMock(return_value=retro),
    )
    session = AsyncMock()
    result = await retros_api.create_retro(
        data=retro_create(), member=cf_member(), session=session,
    )
    assert result is retro
    session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_get_retro_404(monkeypatch):
    monkeypatch.setattr(
        retros_api.retro_service, "get", AsyncMock(return_value=None)
    )
    with pytest.raises(HTTPException) as exc:
        await retros_api.get_retro(
            retro_id=uuid.uuid4(),
            member=cf_member(), session=AsyncMock(),
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_update_retro_404(monkeypatch):
    monkeypatch.setattr(
        retros_api.retro_service, "update", AsyncMock(return_value=None)
    )
    with pytest.raises(HTTPException) as exc:
        await retros_api.update_retro(
            retro_id=uuid.uuid4(),
            data=CFRetroNoteUpdate(notes="x"),
            member=cf_member(), session=AsyncMock(),
        )
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_update_retro_persists(monkeypatch):
    retro = make_retro(notes="updated")
    monkeypatch.setattr(
        retros_api.retro_service, "update", AsyncMock(return_value=retro)
    )
    session = AsyncMock()
    result = await retros_api.update_retro(
        retro_id=retro.id,
        data=CFRetroNoteUpdate(notes="updated"),
        member=cf_member(), session=session,
    )
    assert result is retro
    session.commit.assert_awaited()
