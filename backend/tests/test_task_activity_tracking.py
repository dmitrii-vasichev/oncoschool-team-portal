"""Integration tests: TaskService must bump last_activity_at on writes.

Tests run against the live dev DB (Docker container on :5434).
Each test creates data, checks the assertion, then rolls back so the
dev DB is not polluted.

Session management:
  - We open a session manually (no session.begin()) to control commits.
  - All DB work is flushed but NOT committed.
  - After each test we rollback explicitly via session.rollback().
"""

import uuid
from datetime import datetime, timezone

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

async def _seed_member(session) -> TeamMember:
    """Create a minimally-valid moderator TeamMember and flush."""
    member = TeamMember(
        full_name=f"Test Actor {uuid.uuid4().hex[:8]}",
        role="moderator",
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
        title="Activity tracking test task",
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
async def test_update_status_bumps_last_activity_at():
    """update_status must advance last_activity_at."""
    svc = TaskService()

    async with async_session() as session:
        try:
            member = await _seed_member(session)
            task = await _seed_task(session, member)

            baseline = task.last_activity_at
            assert baseline is not None, "last_activity_at must be set on creation"

            await svc.update_status(session, task, member, new_status="in_progress")

            fresh = await _reload_task(session, task.id)

            assert fresh.last_activity_at is not None
            assert fresh.last_activity_at > baseline, (
                f"last_activity_at was not bumped after update_status: "
                f"{fresh.last_activity_at} <= {baseline}"
            )
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_complete_task_bumps_last_activity_at():
    """complete_task must advance last_activity_at."""
    svc = TaskService()

    async with async_session() as session:
        try:
            member = await _seed_member(session)
            task = await _seed_task(session, member)

            baseline = task.last_activity_at
            assert baseline is not None

            await svc.complete_task(session, task, member)

            fresh = await _reload_task(session, task.id)

            assert fresh.last_activity_at is not None
            assert fresh.last_activity_at > baseline, (
                f"last_activity_at was not bumped after complete_task: "
                f"{fresh.last_activity_at} <= {baseline}"
            )
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_add_task_update_bumps_last_activity_at():
    """add_task_update must advance last_activity_at."""
    svc = TaskService()

    async with async_session() as session:
        try:
            member = await _seed_member(session)
            task = await _seed_task(session, member)

            baseline = task.last_activity_at
            assert baseline is not None

            await svc.add_task_update(
                session,
                task,
                member,
                content="Progress update",
                update_type="progress",
            )

            fresh = await _reload_task(session, task.id)

            assert fresh.last_activity_at is not None
            assert fresh.last_activity_at > baseline, (
                f"last_activity_at was not bumped after add_task_update: "
                f"{fresh.last_activity_at} <= {baseline}"
            )
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_assign_task_does_not_bump_last_activity_at():
    """assign_task is NOT an activity event — last_activity_at must stay the same."""
    svc = TaskService()

    async with async_session() as session:
        try:
            creator = await _seed_member(session)
            assignee2 = TeamMember(
                full_name=f"Assignee2 {uuid.uuid4().hex[:8]}",
                role="member",
                is_active=True,
            )
            session.add(assignee2)
            await session.flush()

            task = await _seed_task(session, creator)
            baseline = task.last_activity_at
            assert baseline is not None

            await svc.assign_task(session, task, creator, assignee2.id)

            fresh = await _reload_task(session, task.id)

            assert fresh.last_activity_at == baseline, (
                f"last_activity_at should NOT change on assign_task: "
                f"{fresh.last_activity_at} != {baseline}"
            )
        finally:
            await session.rollback()
