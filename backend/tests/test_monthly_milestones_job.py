import uuid
from datetime import date, datetime, timezone

import pytest
import pytest_asyncio
from sqlalchemy import func, select

from app.db.database import async_session, engine
from app.db.models import ActivityEvent, MilestoneAward
from app.services.reminder_service import ReminderService


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


async def _seed_task(session, *, assignee, status="in_progress", deadline=None, completed_at=None):
    from app.db.models import Task
    next_short = (await session.execute(select(func.coalesce(func.max(Task.short_id), 0) + 1))).scalar_one()
    t = Task(id=uuid.uuid4(), short_id=next_short, title="X", status=status,
             assignee_id=assignee.id, created_by_id=assignee.id, deadline=deadline, completed_at=completed_at)
    session.add(t)
    await session.flush()
    return t


@pytest.mark.asyncio
async def test_monthly_job_awards_team_and_personal():
    async with async_session() as session:
        try:
            m = await _seed_member(session, full_name="Reliable")
            await _seed_task(session, assignee=m, status="done", deadline=date(2026, 5, 10),
                             completed_at=datetime(2026, 5, 9, 9, 0))
            ev = ActivityEvent(
                event_type="task_completed", actor_id=m.id, visibility="company",
                payload={"actor_name": "Reliable"},
                created_at=datetime(2026, 5, 9, 9, 0, tzinfo=timezone.utc),
            )
            session.add(ev)
            await session.flush()

            svc = ReminderService(bot=None, session_maker=None)
            dms = await svc._run_monthly_milestones(
                session, period="2026-05",
                start_utc=datetime(2026, 5, 1, tzinfo=timezone.utc),
                end_utc=datetime(2026, 6, 1, tzinfo=timezone.utc),
                month_start=date(2026, 5, 1), month_end=date(2026, 6, 1),
            )
            personal = (await session.execute(
                select(ActivityEvent).where(
                    ActivityEvent.event_type == "milestone_personal",
                    ActivityEvent.actor_id == m.id,
                )
            )).scalars().all()
            assert len(personal) == 1
            team = (await session.execute(
                select(ActivityEvent).where(
                    ActivityEvent.event_type == "milestone_team",
                    ActivityEvent.payload["kind"].astext == "month",
                )
            )).scalars().all()
            assert len(team) == 1
            assert any(mid == m.id for (mid, _text) in dms)
            assert (await session.execute(
                select(func.count()).select_from(MilestoneAward)
            )).scalar_one() >= 2
        finally:
            await session.rollback()
