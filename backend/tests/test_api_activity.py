"""Integration tests: Team Pulse activity REST endpoints in app.api.activity.

Tests run against the live dev DB and call the endpoint coroutine functions
directly with a REAL session whose .commit is patched to .flush, then roll back
so the dev DB is not polluted (mirrors test_api_task_cancellation.py).
"""

import uuid

import pytest
import pytest_asyncio
from fastapi import HTTPException

from app.api import activity as activity_api
from app.api.schemas_activity import ReactionRequest
from app.db.database import async_session, engine
from app.db.models import ActivityEvent, TeamMember


def _no_commit(session):
    async def _flush_instead():
        await session.flush()
    session.commit = _flush_instead


@pytest_asyncio.fixture(autouse=True)
async def _dispose_engine_pool():
    await engine.dispose()
    yield
    await engine.dispose()


@pytest.mark.asyncio
async def test_get_feed_endpoint_returns_items():
    async with async_session() as session:
        try:
            m = TeamMember(id=uuid.uuid4(), full_name="Anna", role="moderator")
            session.add(m)
            await session.flush()
            ev = ActivityEvent(event_type="task_completed", actor_id=m.id, visibility="company",
                               payload={"actor_name": "Anna", "task_title": "X", "task_short_id": 1})
            session.add(ev)
            await session.flush()
            _no_commit(session)
            resp = await activity_api.list_activity(limit=50, offset=0, member=m, session=session)
            assert any(item["id"] == str(ev.id) for item in resp["items"])
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_react_endpoint_toggles():
    async with async_session() as session:
        try:
            actor = TeamMember(id=uuid.uuid4(), full_name="Anna", role="member")
            reactor = TeamMember(id=uuid.uuid4(), full_name="Bob", role="member")
            session.add_all([actor, reactor])
            await session.flush()
            ev = ActivityEvent(event_type="task_completed", actor_id=actor.id, visibility="company", payload={})
            session.add(ev)
            await session.flush()
            _no_commit(session)

            class _Req:
                class app:
                    class state:
                        bot = None

            resp = await activity_api.react(
                request=_Req(), event_id=ev.id, data=ReactionRequest(emoji="clap"),
                member=reactor, session=session,
            )
            assert resp["added"] is True
            assert resp["summary"]["counts"]["clap"] == 1
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_react_endpoint_rejects_bad_emoji():
    # ReactionRequest validation happens at the schema layer; constructing with a bad emoji raises.
    with pytest.raises(Exception):
        ReactionRequest(emoji="nope")


@pytest.mark.asyncio
async def test_react_endpoint_event_not_found_returns_400():
    async with async_session() as session:
        try:
            m = TeamMember(id=uuid.uuid4(), full_name="Bob", role="member")
            session.add(m)
            await session.flush()
            _no_commit(session)

            class _Req:
                class app:
                    class state:
                        bot = None

            with pytest.raises(HTTPException) as exc_info:
                await activity_api.react(
                    request=_Req(), event_id=uuid.uuid4(),
                    data=ReactionRequest(emoji="clap"), member=m, session=session,
                )
            assert exc_info.value.status_code == 400
        finally:
            await session.rollback()
