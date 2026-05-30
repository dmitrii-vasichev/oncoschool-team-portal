import uuid

import pytest
import pytest_asyncio
from sqlalchemy import func, select

from app.db.database import async_session, engine
from app.db.models import ActivityEvent, Task, TeamMember
from app.services.task_service import TaskService

service = TaskService()


@pytest_asyncio.fixture(autouse=True)
async def _dispose_engine_pool():
    await engine.dispose()
    yield
    await engine.dispose()


async def _seed(session):
    m = TeamMember(id=uuid.uuid4(), full_name="Anna", role="member")
    session.add(m)
    await session.flush()
    # short_id is NOT NULL with no Python-side default; assign max+1 explicitly.
    next_short = (
        await session.execute(
            select(func.coalesce(func.max(Task.short_id), 0) + 1)
        )
    ).scalar_one()
    t = Task(
        id=uuid.uuid4(),
        short_id=next_short,
        title="X",
        status="in_progress",
        assignee_id=m.id,
        created_by_id=m.id,
    )
    session.add(t)
    await session.flush()
    return m, t


@pytest.mark.asyncio
async def test_complete_task_emits_task_completed_event():
    async with async_session() as session:
        try:
            m, t = await _seed(session)
            await service.complete_task(session, t, m)
            events = (
                await session.execute(
                    select(ActivityEvent).where(
                        ActivityEvent.task_id == t.id,
                        ActivityEvent.event_type == "task_completed",
                    )
                )
            ).scalars().all()
            assert len(events) == 1
            assert events[0].visibility == "company"
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_blocker_update_emits_blocker_raised_event():
    async with async_session() as session:
        try:
            m, t = await _seed(session)
            await service.add_task_update(
                session, t, m, content="blocked!", update_type="blocker"
            )
            events = (
                await session.execute(
                    select(ActivityEvent).where(
                        ActivityEvent.task_id == t.id,
                        ActivityEvent.event_type == "blocker_raised",
                    )
                )
            ).scalars().all()
            assert len(events) == 1
            assert events[0].payload["blocker_text"] == "blocked!"
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_progress_update_emits_progress_event():
    async with async_session() as session:
        try:
            m, t = await _seed(session)
            await service.add_task_update(
                session,
                t,
                m,
                content="60%",
                update_type="progress",
                progress_percent=60,
            )
            events = (
                await session.execute(
                    select(ActivityEvent).where(
                        ActivityEvent.task_id == t.id,
                        ActivityEvent.event_type == "progress_update",
                    )
                )
            ).scalars().all()
            assert len(events) == 1
            assert events[0].payload["progress_percent"] == 60
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_plain_progress_update_without_percent_emits_no_event():
    async with async_session() as session:
        try:
            m, t = await _seed(session)
            # Neither a blocker nor a progress-with-percent: must emit nothing.
            await service.add_task_update(
                session, t, m, content="just a note", update_type="progress"
            )
            events = (
                await session.execute(
                    select(ActivityEvent).where(ActivityEvent.task_id == t.id)
                )
            ).scalars().all()
            assert events == []
        finally:
            await session.rollback()
