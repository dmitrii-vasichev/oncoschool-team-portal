import uuid
import pytest
import pytest_asyncio
from sqlalchemy.exc import IntegrityError
from app.db.database import async_session, engine
from app.db.models import ActivityEvent, ActivityReaction, TeamMember


@pytest_asyncio.fixture(autouse=True)
async def _dispose_engine_pool():
    await engine.dispose()
    yield
    await engine.dispose()


@pytest.mark.asyncio
async def test_activity_event_persists_with_payload_and_visibility():
    async with async_session() as session:
        try:
            actor = TeamMember(id=uuid.uuid4(), full_name="Anna", role="member")
            session.add(actor)
            await session.flush()
            event = ActivityEvent(
                event_type="task_completed", actor_id=actor.id, visibility="company",
                payload={"actor_name": "Anna", "task_title": "X", "task_short_id": 42},
            )
            session.add(event)
            await session.flush()
            assert event.id is not None
            assert event.payload["task_short_id"] == 42
            assert event.visibility == "company"
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_activity_reaction_unique_per_member_emoji():
    async with async_session() as session:
        try:
            actor = TeamMember(id=uuid.uuid4(), full_name="Bob", role="member")
            session.add(actor)
            await session.flush()
            event = ActivityEvent(event_type="task_completed", actor_id=actor.id, visibility="company", payload={})
            session.add(event)
            await session.flush()
            r1 = ActivityReaction(event_id=event.id, member_id=actor.id, emoji="clap")
            session.add(r1)
            await session.flush()
            assert r1.id is not None
            # A second reaction with the same (event_id, member_id, emoji) must
            # violate the UNIQUE constraint and raise on flush.
            r2 = ActivityReaction(event_id=event.id, member_id=actor.id, emoji="clap")
            session.add(r2)
            with pytest.raises(IntegrityError):
                await session.flush()
        finally:
            await session.rollback()
