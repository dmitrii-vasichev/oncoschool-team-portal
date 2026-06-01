import uuid

import pytest
import pytest_asyncio
from sqlalchemy import func, select

from app.db.database import async_session, engine
from app.services.activity_service import ActivityService, COMPANY_EVENT_TYPES

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
async def test_record_allows_none_actor_for_team_milestone():
    async with async_session() as session:
        try:
            ev = await service.record(
                session, event_type="milestone_team", actor=None,
                extra={"kind": "month", "count": 42, "period": "2026-05"},
            )
            assert ev.actor_id is None
            assert ev.visibility == "company"
            assert ev.payload["count"] == 42
        finally:
            await session.rollback()


def test_new_event_types_are_company_visible():
    assert {"kudos", "milestone_team", "milestone_personal"} <= COMPANY_EVENT_TYPES
