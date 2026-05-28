"""Integration tests: TaskService.cancel_task with a required reason.

Tests run against the live dev DB (Docker container on :5434).
Each test creates data, checks the assertion, then rolls back so the
dev DB is not polluted.

Session management:
  - We open a session manually (no session.begin()) to control commits.
  - All DB work is flushed but NOT committed.
  - After each test we rollback explicitly via session.rollback().
"""

import uuid

import pytest
import pytest_asyncio
from app.db.database import async_session, engine
from app.db.models import Task, TeamMember
from app.db.repositories import TaskRepository
from app.services.task_service import TaskService


# ---------------------------------------------------------------------------
# Engine pool disposal — mirrors the pattern in other DB-backed tests
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture(autouse=True)
async def _dispose_engine_pool():
    await engine.dispose()
    yield
    await engine.dispose()


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------

async def _seed_member(session, role: str = "moderator") -> TeamMember:
    """Create a minimally-valid TeamMember and flush."""
    member = TeamMember(
        full_name=f"Test Actor {uuid.uuid4().hex[:8]}",
        role=role,
        is_active=True,
    )
    session.add(member)
    await session.flush()
    return member


async def _seed_task(session, member: TeamMember) -> Task:
    """Create a task via TaskRepository (handles short_id) and flush."""
    task_repo = TaskRepository()
    return await task_repo.create(
        session,
        title="Cancellation test task",
        description=None,
        checklist=[],
        priority="normal",
        assignee_id=member.id,
        created_by_id=member.id,
        source="text",
        deadline=None,
        reminder_at=None,
        reminder_comment=None,
        reminder_sent_at=None,
        meeting_id=None,
    )


async def _reload_task(session, task_id: uuid.UUID) -> Task:
    """Expire and re-fetch the task to see the current in-session state."""
    task = await session.get(Task, task_id)
    await session.refresh(task)
    return task


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cancel_task_sets_status_and_reason():
    """cancel_task sets status=cancelled and stores cancellation_reason."""
    svc = TaskService()

    async with async_session() as session:
        try:
            member = await _seed_member(session)
            task = await _seed_task(session, member)

            await svc.cancel_task(session, task, member, reason="obsolete")

            fresh = await _reload_task(session, task.id)

            assert fresh.status == "cancelled"
            assert fresh.cancellation_reason == "obsolete"
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_cancel_task_creates_cancellation_update():
    """cancel_task auto-creates a TaskUpdate of type cancellation."""
    svc = TaskService()

    async with async_session() as session:
        try:
            member = await _seed_member(session)
            task = await _seed_task(session, member)

            await svc.cancel_task(session, task, member, reason="obsolete")

            updates = await svc.get_task_updates(session, task.id)
            cancellation_updates = [
                u for u in updates if u.update_type == "cancellation"
            ]
            assert len(cancellation_updates) == 1
            update = cancellation_updates[0]
            assert update.new_status == "cancelled"
            assert update.author_id == member.id
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_cancel_task_invalid_reason_raises_value_error():
    """An unknown reason value must raise ValueError."""
    svc = TaskService()

    async with async_session() as session:
        try:
            member = await _seed_member(session)
            task = await _seed_task(session, member)

            with pytest.raises(ValueError):
                await svc.cancel_task(session, task, member, reason="not_a_reason")
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_cancel_task_other_reason_stores_custom_text():
    """reason='other' with reason_text stores the custom text in the update."""
    svc = TaskService()

    async with async_session() as session:
        try:
            member = await _seed_member(session)
            task = await _seed_task(session, member)

            await svc.cancel_task(
                session,
                task,
                member,
                reason="other",
                reason_text="custom",
            )

            updates = await svc.get_task_updates(session, task.id)
            cancellation_updates = [
                u for u in updates if u.update_type == "cancellation"
            ]
            assert len(cancellation_updates) == 1
            assert cancellation_updates[0].content == "custom"
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_cancel_task_bumps_last_activity_at():
    """cancel_task must advance last_activity_at."""
    svc = TaskService()

    async with async_session() as session:
        try:
            member = await _seed_member(session)
            task = await _seed_task(session, member)

            baseline = task.last_activity_at
            assert baseline is not None, "last_activity_at must be set on creation"

            await svc.cancel_task(session, task, member, reason="obsolete")

            fresh = await _reload_task(session, task.id)

            assert fresh.last_activity_at is not None
            assert fresh.last_activity_at > baseline, (
                f"last_activity_at was not bumped after cancel_task: "
                f"{fresh.last_activity_at} <= {baseline}"
            )
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_reopening_cancelled_task_clears_cancellation_reason():
    """Moving a cancelled task back to an active status clears the stale reason."""
    svc = TaskService()

    async with async_session() as session:
        try:
            member = await _seed_member(session)
            task = await _seed_task(session, member)

            await svc.cancel_task(session, task, member, reason="obsolete")
            cancelled = await _reload_task(session, task.id)
            assert cancelled.cancellation_reason == "obsolete"

            await svc.update_status(session, cancelled, member, new_status="new")
            reopened = await _reload_task(session, task.id)

            assert reopened.status == "new"
            assert reopened.cancellation_reason is None
        finally:
            await session.rollback()
