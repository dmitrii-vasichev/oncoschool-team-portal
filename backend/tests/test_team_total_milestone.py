import uuid

import pytest
import pytest_asyncio
from sqlalchemy import func, select

from app.db.database import async_session, engine


@pytest_asyncio.fixture(autouse=True)
async def _dispose_engine_pool():
    await engine.dispose()
    yield
    await engine.dispose()


async def _seed_member(session, *, full_name="Anna", role="member"):
    from app.db.models import TeamMember
    m = TeamMember(id=uuid.uuid4(), full_name=full_name, role=role)
    session.add(m)
    await session.flush()
    return m


from app.db.models import ActivityEvent
from app.services.task_service import TaskService, TEAM_TOTAL_THRESHOLDS

service = TaskService()


@pytest.mark.asyncio
async def test_award_emits_milestone_when_threshold_reached():
    async with async_session() as session:
        try:
            closer = await _seed_member(session, full_name="Closer")
            t = TEAM_TOTAL_THRESHOLDS[0]  # 100
            await service._award_team_total_milestones(session, closer, t)
            events = (await session.execute(
                select(ActivityEvent).where(ActivityEvent.event_type == "milestone_team")
            )).scalars().all()
            assert any(e.payload.get("count") == t and e.payload.get("kind") == "total" for e in events)
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_award_is_idempotent_on_repeat():
    async with async_session() as session:
        try:
            closer = await _seed_member(session)
            t = TEAM_TOTAL_THRESHOLDS[0]
            await service._award_team_total_milestones(session, closer, t)
            await service._award_team_total_milestones(session, closer, t)  # again
            events = (await session.execute(
                select(ActivityEvent).where(
                    ActivityEvent.event_type == "milestone_team",
                    ActivityEvent.payload["count"].astext == str(t),
                )
            )).scalars().all()
            assert len(events) == 1
        finally:
            await session.rollback()
