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


from app.api import activity as activity_api
from app.api.schemas_activity import KudosRequest


def _no_commit(session):
    async def _flush_instead():
        await session.flush()
    session.commit = _flush_instead


class _Req:
    class app:
        class state:
            bot = None


@pytest.mark.asyncio
async def test_give_kudos_endpoint_creates_event():
    async with async_session() as session:
        try:
            giver = await _seed_member(session, full_name="Giver", role="member")
            recipient = await _seed_member(session, full_name="Recipient")
            _no_commit(session)
            resp = await activity_api.give_kudos(
                request=_Req(),
                data=KudosRequest(recipient_id=recipient.id, message="nice"),
                member=giver, session=session,
            )
            assert resp["event_type"] == "kudos"
            assert resp["recipient_name"] == "Recipient"
            assert resp["message"] == "nice"
        finally:
            await session.rollback()
