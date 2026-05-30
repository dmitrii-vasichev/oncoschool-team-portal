import importlib.util
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import func, select, text

from app.db.database import async_session, engine
from app.db.models import ActivityEvent, Department, Task, TaskUpdate, TeamMember


MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "050_backfill_recent_team_pulse_completions.py"
)


@pytest_asyncio.fixture(autouse=True)
async def _dispose_engine_pool():
    await engine.dispose()
    yield
    await engine.dispose()


def _load_migration():
    spec = importlib.util.spec_from_file_location("pulse_backfill_migration", MIGRATION_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


async def _next_short_id(session) -> int:
    return (
        await session.execute(select(func.coalesce(func.max(Task.short_id), 0) + 1))
    ).scalar_one()


async def _seed_task(session, *, title: str, completed_at: datetime, assignee, creator):
    task = Task(
        id=uuid.uuid4(),
        short_id=await _next_short_id(session),
        title=title,
        status="done",
        assignee_id=assignee.id if assignee is not None else None,
        created_by_id=creator.id if creator is not None else None,
        completed_at=completed_at,
    )
    session.add(task)
    await session.flush()
    return task


@pytest.mark.asyncio
async def test_recent_completion_backfill_creates_deduplicated_pulse_events():
    migration = _load_migration()

    async with async_session() as session:
        try:
            now = datetime.utcnow()
            dept = Department(id=uuid.uuid4(), name=f"Pulse Backfill {uuid.uuid4().hex[:6]}")
            session.add(dept)
            await session.flush()

            actor = TeamMember(id=uuid.uuid4(), full_name="Closer", role="member", department_id=dept.id)
            assignee = TeamMember(id=uuid.uuid4(), full_name="Assignee", role="member", department_id=dept.id)
            creator = TeamMember(id=uuid.uuid4(), full_name="Creator", role="member", department_id=dept.id)
            session.add_all([actor, assignee, creator])
            await session.flush()

            with_update = await _seed_task(
                session,
                title="Recent with status update",
                completed_at=now - timedelta(days=1),
                assignee=assignee,
                creator=creator,
            )
            update = TaskUpdate(
                task_id=with_update.id,
                author_id=actor.id,
                content="Статус: review -> done",
                update_type="status_change",
                old_status="review",
                new_status="done",
            )
            session.add(update)

            existing = await _seed_task(
                session,
                title="Recent already backfilled",
                completed_at=now - timedelta(days=2),
                assignee=assignee,
                creator=creator,
            )
            session.add(
                ActivityEvent(
                    event_type="task_completed",
                    actor_id=actor.id,
                    task_id=existing.id,
                    department_id=dept.id,
                    visibility="company",
                    payload={"actor_name": "Closer"},
                    created_at=existing.completed_at,
                )
            )

            old = await _seed_task(
                session,
                title="Old completion",
                completed_at=now - timedelta(days=8),
                assignee=assignee,
                creator=creator,
            )
            fallback = await _seed_task(
                session,
                title="Recent fallback actor",
                completed_at=now - timedelta(hours=3),
                assignee=assignee,
                creator=creator,
            )

            await session.flush()
            await session.execute(text(migration.BACKFILL_SQL))

            events = (
                await session.execute(
                    select(ActivityEvent).where(
                        ActivityEvent.task_id.in_(
                            [with_update.id, existing.id, old.id, fallback.id]
                        )
                    )
                )
            ).scalars().all()

            by_task = {event.task_id: event for event in events}
            assert len([event for event in events if event.task_id == existing.id]) == 1
            assert old.id not in by_task

            status_event = by_task[with_update.id]
            assert status_event.actor_id == actor.id
            assert status_event.department_id == dept.id
            assert status_event.visibility == "company"
            assert status_event.created_at.replace(tzinfo=None) == with_update.completed_at
            assert status_event.payload["actor_name"] == "Closer"
            assert status_event.payload["task_title"] == "Recent with status update"
            assert status_event.payload["task_short_id"] == with_update.short_id
            assert status_event.payload["department_name"] == dept.name

            fallback_event = by_task[fallback.id]
            assert fallback_event.actor_id == assignee.id
            assert fallback_event.payload["actor_name"] == "Assignee"
        finally:
            await session.rollback()
