import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api.content_factory import guests as guests_api
from app.db.schemas import CFGuestStoryCreate, CFGuestStoryEventCreate, CFGuestStoryUpdate


def cf_member(has_cf=True):
    return SimpleNamespace(
        id=uuid.uuid4(),
        role="member",
        is_active=True,
        has_content_factory_access=has_cf,
    )


def make_guest_story(**overrides):
    base = {
        "id": uuid.uuid4(),
        "display_name": "Patient story candidate",
        "contact_ref": "@candidate",
        "role": "patient",
        "source": "manual",
        "source_notes": None,
        "story_brief": "Useful patient experience.",
        "status": "sourced",
        "owner_id": uuid.uuid4(),
        "stage_due_at": None,
        "nosology_id": None,
        "bundle_id": None,
        "publication_id": None,
        "screening_notes": None,
        "medical_factcheck_notes": None,
        "rejection_reason": None,
        "consent_status": "not_started",
        "consent_version": None,
        "consent_signed_at": None,
        "allowed_channels": [],
        "anonymity_level": "full_name",
        "sensitive_topics": [],
        "legal_notes": None,
        "gift_status": "not_required",
        "follow_up_due_at": None,
        "created_at": datetime.now(UTC),
        "updated_at": datetime.now(UTC),
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def make_guest_story_event(**overrides):
    base = {
        "id": uuid.uuid4(),
        "guest_story_id": uuid.uuid4(),
        "parent_event_id": None,
        "actor_id": uuid.uuid4(),
        "event_type": "comment",
        "body": "Попросили согласовать город.",
        "old_value": None,
        "new_value": None,
        "payload": {},
        "created_at": datetime.now(UTC),
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def guest_story_create():
    return CFGuestStoryCreate(
        display_name="Patient story candidate",
        role="patient",
        owner_id=uuid.uuid4(),
        story_brief="Useful patient experience.",
    )


@pytest.mark.asyncio
async def test_list_guest_stories(monkeypatch):
    monkeypatch.setattr(
        guests_api.guest_story_service,
        "list",
        AsyncMock(return_value=[make_guest_story(), make_guest_story(status="consent_sent")]),
    )

    result = await guests_api.list_guest_stories(
        member=cf_member(),
        session=AsyncMock(),
        status=None,
        owner_id=None,
        consent_status=None,
        bundle_id=None,
        publication_id=None,
        limit=100,
        offset=0,
    )

    assert len(result) == 2


@pytest.mark.asyncio
async def test_create_guest_story(monkeypatch):
    member = cf_member()
    payload = guest_story_create()
    guest_story = make_guest_story()
    monkeypatch.setattr(
        guests_api.guest_story_service,
        "create",
        AsyncMock(return_value=guest_story),
    )
    session = AsyncMock()

    result = await guests_api.create_guest_story(
        data=payload,
        member=member,
        session=session,
    )

    assert result is guest_story
    session.commit.assert_awaited()
    guests_api.guest_story_service.create.assert_awaited_with(
        session,
        payload,
        actor_id=member.id,
    )


@pytest.mark.asyncio
async def test_get_guest_story_404(monkeypatch):
    monkeypatch.setattr(
        guests_api.guest_story_service,
        "get",
        AsyncMock(return_value=None),
    )

    with pytest.raises(HTTPException) as exc:
        await guests_api.get_guest_story(
            guest_story_id=uuid.uuid4(),
            member=cf_member(),
            session=AsyncMock(),
        )

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_update_guest_story_404(monkeypatch):
    monkeypatch.setattr(
        guests_api.guest_story_service,
        "update",
        AsyncMock(return_value=None),
    )

    with pytest.raises(HTTPException) as exc:
        await guests_api.update_guest_story(
            guest_story_id=uuid.uuid4(),
            data=CFGuestStoryUpdate(status="consent_sent"),
            member=cf_member(),
            session=AsyncMock(),
        )

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_update_guest_story_persists(monkeypatch):
    guest_story = make_guest_story(status="consent_sent")
    monkeypatch.setattr(
        guests_api.guest_story_service,
        "update",
        AsyncMock(return_value=guest_story),
    )
    session = AsyncMock()

    result = await guests_api.update_guest_story(
        guest_story_id=guest_story.id,
        data=CFGuestStoryUpdate(status="consent_sent"),
        member=cf_member(),
        session=session,
    )

    assert result is guest_story
    session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_list_guest_story_events(monkeypatch):
    guest_story = make_guest_story()
    event = make_guest_story_event(guest_story_id=guest_story.id)
    monkeypatch.setattr(
        guests_api.guest_story_service,
        "get",
        AsyncMock(return_value=guest_story),
    )
    monkeypatch.setattr(
        guests_api.guest_story_service,
        "list_events",
        AsyncMock(return_value=[event]),
    )
    session = AsyncMock()

    result = await guests_api.list_guest_story_events(
        guest_story_id=guest_story.id,
        member=cf_member(),
        session=session,
    )

    assert result == [event]
    guests_api.guest_story_service.list_events.assert_awaited_with(session, guest_story.id)


@pytest.mark.asyncio
async def test_list_guest_story_events_404(monkeypatch):
    monkeypatch.setattr(
        guests_api.guest_story_service,
        "get",
        AsyncMock(return_value=None),
    )

    with pytest.raises(HTTPException) as exc:
        await guests_api.list_guest_story_events(
            guest_story_id=uuid.uuid4(),
            member=cf_member(),
            session=AsyncMock(),
        )

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_create_guest_story_event_persists(monkeypatch):
    member = cf_member()
    guest_story = make_guest_story()
    event = make_guest_story_event(
        guest_story_id=guest_story.id,
        actor_id=member.id,
        body="Гость просит не называть город.",
    )
    monkeypatch.setattr(
        guests_api.guest_story_service,
        "get",
        AsyncMock(return_value=guest_story),
    )
    monkeypatch.setattr(
        guests_api.guest_story_service,
        "create_comment",
        AsyncMock(return_value=event),
    )
    session = AsyncMock()

    parent_event_id = uuid.uuid4()

    result = await guests_api.create_guest_story_event(
        guest_story_id=guest_story.id,
        data=CFGuestStoryEventCreate(
            body="Гость просит не называть город.",
            parent_event_id=parent_event_id,
        ),
        member=member,
        session=session,
    )

    assert result is event
    guests_api.guest_story_service.create_comment.assert_awaited_with(
        session,
        guest_story_id=guest_story.id,
        actor_id=member.id,
        body="Гость просит не называть город.",
        parent_event_id=parent_event_id,
    )
    session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_create_guest_story_event_invalid_parent_returns_404(monkeypatch):
    member = cf_member()
    guest_story = make_guest_story()
    monkeypatch.setattr(
        guests_api.guest_story_service,
        "get",
        AsyncMock(return_value=guest_story),
    )
    monkeypatch.setattr(
        guests_api.guest_story_service,
        "create_comment",
        AsyncMock(side_effect=ValueError("Parent event not found for guest story")),
    )

    with pytest.raises(HTTPException) as exc:
        await guests_api.create_guest_story_event(
            guest_story_id=guest_story.id,
            data=CFGuestStoryEventCreate(
                body="Ответ к чужой истории.",
                parent_event_id=uuid.uuid4(),
            ),
            member=member,
            session=AsyncMock(),
        )

    assert exc.value.status_code == 404
