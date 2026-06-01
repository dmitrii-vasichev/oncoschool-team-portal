import uuid
import pytest
import pytest_asyncio
from sqlalchemy import func, select
from app.db.database import async_session, engine
from app.db.models import ActivityEvent, Task, TeamMember, Department
from app.services.activity_service import ActivityService

service = ActivityService()


@pytest_asyncio.fixture(autouse=True)
async def _dispose_engine_pool():
    await engine.dispose()
    yield
    await engine.dispose()


async def _seed(session):
    dept = Department(id=uuid.uuid4(), name=f"Marketing-{uuid.uuid4().hex[:6]}")
    session.add(dept)
    await session.flush()
    actor = TeamMember(id=uuid.uuid4(), full_name="Anna", role="member", department_id=dept.id)
    session.add(actor)
    await session.flush()
    # short_id is UNIQUE with no DB-side default; allocate it the same way
    # TaskRepository.create does to avoid NOT NULL / collision errors.
    next_short_id = (
        await session.execute(select(func.coalesce(func.max(Task.short_id), 0) + 1))
    ).scalar_one()
    task = Task(id=uuid.uuid4(), short_id=next_short_id, title="Landing page", status="new", assignee_id=actor.id)
    session.add(task)
    await session.flush()
    return dept, actor, task


@pytest.mark.asyncio
async def test_record_task_completed_is_company_visible_with_snapshot():
    async with async_session() as session:
        try:
            dept, actor, task = await _seed(session)
            event = await service.record(session, event_type="task_completed", actor=actor, task=task)
            assert event.visibility == "company"
            assert event.department_id == dept.id
            assert event.payload["task_title"] == "Landing page"
            assert event.payload["actor_name"] == "Anna"
            assert event.payload["department_name"] == dept.name
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_record_blocker_is_department_visible():
    async with async_session() as session:
        try:
            dept, actor, task = await _seed(session)
            event = await service.record(
                session, event_type="blocker_raised", actor=actor, task=task,
                extra={"blocker_text": "waiting on access"},
            )
            assert event.visibility == "department"
            assert event.payload["blocker_text"] == "waiting on access"
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_record_without_task_has_minimal_payload():
    async with async_session() as session:
        try:
            actor = TeamMember(id=uuid.uuid4(), full_name="Anna", role="member")
            session.add(actor)
            await session.flush()
            event = await service.record(session, event_type="task_completed", actor=actor)
            assert event.task_id is None
            assert event.department_id is None
            # No task means no task/department snapshot keys are added.
            # (actor_avatar_url is always snapshotted alongside actor_name.)
            assert event.payload == {"actor_name": "Anna", "actor_avatar_url": None}
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_record_unassigned_task_has_no_department():
    async with async_session() as session:
        try:
            actor = TeamMember(id=uuid.uuid4(), full_name="Anna", role="member")
            session.add(actor)
            await session.flush()
            next_short_id = (
                await session.execute(select(func.coalesce(func.max(Task.short_id), 0) + 1))
            ).scalar_one()
            task = Task(
                id=uuid.uuid4(), short_id=next_short_id, title="Orphan task",
                status="new", assignee_id=None,
            )
            session.add(task)
            await session.flush()
            event = await service.record(
                session, event_type="progress_update", actor=actor, task=task,
                extra={"progress_percent": 30},
            )
            assert event.department_id is None
            assert event.payload["progress_percent"] == 30
            assert event.payload["task_short_id"] == task.short_id
            # A task was given, so department_name key is present (value None).
            assert "department_name" in event.payload
            assert event.payload["department_name"] is None
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_feed_serializes_cancelled_event_with_reason_and_avatar():
    async with async_session() as session:
        try:
            dept, actor, task = await _seed(session)
            actor.avatar_url = "/static/avatars/x.webp"
            viewer = TeamMember(id=uuid.uuid4(), full_name="Mod", role="moderator")
            session.add_all([actor, viewer])
            await session.flush()

            await service.record(
                session,
                event_type="task_cancelled",
                actor=actor,
                task=task,
                extra={"reason": "дубликат"},
            )
            await session.flush()

            feed = await service.get_feed(session, viewer)
            ev = next(e for e in feed if e["event_type"] == "task_cancelled")
            assert ev["actor_avatar_url"] == "/static/avatars/x.webp"
            assert ev["visibility"] == "company"
            assert ev["reason"] == "дубликат"
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_feed_uses_live_actor_avatar_when_payload_has_none():
    """Backfilled events have no avatar snapshot in their payload. The feed must
    fall back to the actor's CURRENT avatar so photos still render (regression)."""
    async with async_session() as session:
        try:
            dept, actor, task = await _seed(session)
            actor.avatar_url = "/static/avatars/live.webp"
            viewer = TeamMember(id=uuid.uuid4(), full_name="Mod", role="moderator")
            session.add_all([actor, viewer])
            await session.flush()

            # Simulate a backfilled event: payload WITHOUT actor_avatar_url.
            ev = ActivityEvent(
                event_type="task_completed",
                actor_id=actor.id,
                task_id=task.id,
                department_id=dept.id,
                visibility="company",
                payload={
                    "actor_name": actor.full_name,
                    "task_title": task.title,
                    "task_short_id": task.short_id,
                },
            )
            session.add(ev)
            await session.flush()

            feed = await service.get_feed(session, viewer)
            row = next(e for e in feed if e["id"] == str(ev.id))
            assert row["actor_avatar_url"] == "/static/avatars/live.webp"
        finally:
            await session.rollback()
