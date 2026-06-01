import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.db.database import async_session, engine


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


from app.db.models import ActivityEvent
from app.services.activity_service import ActivityService

service = ActivityService()


@pytest.mark.asyncio
async def test_give_kudos_creates_event_with_recipient_snapshot():
    async with async_session() as session:
        try:
            giver = await _seed_member(session, full_name="Giver")
            recipient = await _seed_member(session, full_name="Recipient")
            ev = await service.give_kudos(session, giver=giver, recipient_id=recipient.id, message="great work")
            assert ev.event_type == "kudos"
            assert ev.actor_id == giver.id
            assert ev.payload["recipient_id"] == str(recipient.id)
            assert ev.payload["recipient_name"] == "Recipient"
            assert ev.payload["message"] == "great work"
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_give_kudos_rejects_self():
    async with async_session() as session:
        try:
            giver = await _seed_member(session)
            with pytest.raises(ValueError):
                await service.give_kudos(session, giver=giver, recipient_id=giver.id, message="hi")
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_give_kudos_rejects_duplicate_within_window():
    async with async_session() as session:
        try:
            giver = await _seed_member(session)
            recipient = await _seed_member(session)
            await service.give_kudos(session, giver=giver, recipient_id=recipient.id, message="1")
            with pytest.raises(ValueError):
                await service.give_kudos(session, giver=giver, recipient_id=recipient.id, message="2")
        finally:
            await session.rollback()
