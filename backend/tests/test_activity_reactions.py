import uuid
import pytest
import pytest_asyncio
from app.db.database import async_session, engine
from app.db.models import ActivityEvent, TeamMember
from app.services.activity_service import ActivityService

service = ActivityService()


@pytest_asyncio.fixture(autouse=True)
async def _dispose_engine_pool():
    await engine.dispose()
    yield
    await engine.dispose()


async def _seed(session):
    actor = TeamMember(id=uuid.uuid4(), full_name="Anna", role="member")
    reactor = TeamMember(id=uuid.uuid4(), full_name="Bob", role="member")
    session.add_all([actor, reactor])
    await session.flush()
    ev = ActivityEvent(event_type="task_completed", actor_id=actor.id, visibility="company", payload={})
    session.add(ev)
    await session.flush()
    return actor, reactor, ev


@pytest.mark.asyncio
async def test_toggle_adds_then_removes():
    async with async_session() as session:
        try:
            actor, reactor, ev = await _seed(session)
            added = await service.toggle_reaction(session, ev.id, reactor, "clap")
            assert added["summary"]["counts"]["clap"] == 1
            assert added["added"] is True
            assert added["actor_id_to_ping"] == actor.id

            removed = await service.toggle_reaction(session, ev.id, reactor, "clap")
            assert removed["added"] is False
            assert removed["summary"]["counts"].get("clap", 0) == 0
            assert removed["actor_id_to_ping"] is None
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_self_reaction_does_not_ping():
    async with async_session() as session:
        try:
            actor, reactor, ev = await _seed(session)
            res = await service.toggle_reaction(session, ev.id, actor, "fire")
            assert res["added"] is True
            assert res["actor_id_to_ping"] is None
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_invalid_emoji_raises():
    async with async_session() as session:
        try:
            actor, reactor, ev = await _seed(session)
            with pytest.raises(ValueError):
                await service.toggle_reaction(session, ev.id, reactor, "thumbsup")
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_toggle_reaction_accepts_cancellation_emojis():
    async with async_session() as session:
        try:
            actor, reactor, ev = await _seed(session)
            for emoji in ("ok", "broom", "shrug"):
                res = await service.toggle_reaction(session, ev.id, reactor, emoji)
                assert res["added"] is True
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_two_members_same_emoji_counts_two():
    async with async_session() as session:
        try:
            actor, reactor, ev = await _seed(session)
            await service.toggle_reaction(session, ev.id, actor, "clap")
            res = await service.toggle_reaction(session, ev.id, reactor, "clap")
            assert res["summary"]["counts"]["clap"] == 2
            # mine reflects only the calling member's own reactions
            assert res["summary"]["mine"] == ["clap"]
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_same_member_two_emojis():
    async with async_session() as session:
        try:
            actor, reactor, ev = await _seed(session)
            await service.toggle_reaction(session, ev.id, reactor, "clap")
            res = await service.toggle_reaction(session, ev.id, reactor, "fire")
            assert sorted(res["summary"]["mine"]) == ["clap", "fire"]
            assert res["summary"]["counts"] == {"clap": 1, "fire": 1}
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_event_not_found_raises():
    async with async_session() as session:
        try:
            actor, reactor, ev = await _seed(session)
            with pytest.raises(ValueError):
                await service.toggle_reaction(session, uuid.uuid4(), reactor, "clap")
        finally:
            await session.rollback()
