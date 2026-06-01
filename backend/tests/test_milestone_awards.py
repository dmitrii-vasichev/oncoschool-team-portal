import uuid

import pytest
import pytest_asyncio
from sqlalchemy import func, select

from app.db.database import async_session, engine
from app.db.models import MilestoneAward
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
async def test_claim_milestone_is_idempotent():
    async with async_session() as session:
        try:
            key = f"test:{uuid.uuid4()}"
            first = await service.claim_milestone(session, key)
            second = await service.claim_milestone(session, key)
            assert first is True
            assert second is False
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_claim_milestone_records_member_id():
    async with async_session() as session:
        try:
            m = await _seed_member(session)
            key = f"test:{uuid.uuid4()}"
            assert await service.claim_milestone(session, key, member_id=m.id) is True
            row = (await session.execute(
                select(MilestoneAward).where(MilestoneAward.milestone_key == key)
            )).scalar_one()
            assert row.member_id == m.id
        finally:
            await session.rollback()
