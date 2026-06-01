import uuid

import pytest
import pytest_asyncio
from sqlalchemy import func, select

from app.db.database import async_session, engine
from app.db.models import ActivityEvent
from app.services.activity_service import ActivityService

service = ActivityService()


@pytest_asyncio.fixture(autouse=True)
async def _dispose_engine_pool():
    await engine.dispose()
    yield
    await engine.dispose()


async def _seed_member(session, *, full_name="Anna", role="member", telegram_id=None, is_active=True):
    from app.db.models import TeamMember
    m = TeamMember(id=uuid.uuid4(), full_name=full_name, role=role, telegram_id=telegram_id, is_active=is_active)
    session.add(m)
    await session.flush()
    return m


@pytest.mark.asyncio
async def test_serialize_kudos_surfaces_recipient_and_message_for_member():
    async with async_session() as session:
        try:
            giver = await _seed_member(session, full_name="Giver", role="member")
            ev = ActivityEvent(
                event_type="kudos", actor_id=giver.id, visibility="company",
                payload={
                    "actor_name": "Giver", "recipient_id": str(uuid.uuid4()),
                    "recipient_name": "Recipient", "recipient_avatar_url": None,
                    "message": "thanks!",
                },
            )
            session.add(ev)
            await session.flush()
            await session.refresh(ev, ["reactions", "actor"])
            row = service.serialize_event(ev, giver, set(), is_full_scope=False)
            assert row["recipient_name"] == "Recipient"
            assert row["message"] == "thanks!"
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_serialize_team_milestone_surfaces_kind_and_count():
    async with async_session() as session:
        try:
            viewer = await _seed_member(session, role="member")
            ev = ActivityEvent(
                event_type="milestone_team", actor_id=None, visibility="company",
                payload={"kind": "total", "count": 1000},
            )
            session.add(ev)
            await session.flush()
            await session.refresh(ev, ["reactions", "actor"])
            row = service.serialize_event(ev, viewer, set(), is_full_scope=False)
            assert row["milestone_kind"] == "total"
            assert row["milestone_count"] == 1000
        finally:
            await session.rollback()
