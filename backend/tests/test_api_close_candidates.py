"""Integration tests: has_close_candidate filter on GET /api/tasks.

Tests run against the live dev DB (Docker container on :5434). They call the
list_tasks endpoint coroutine directly with a REAL session and REAL seeded
rows, then roll back so the dev DB is not polluted.
"""

import uuid
from datetime import date, timedelta

import pytest
import pytest_asyncio

from app.api import tasks as tasks_api
from app.db.database import async_session, engine
from app.db.models import Task, TeamMember
from app.db.repositories import TaskRepository


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
    member = TeamMember(
        full_name=f"Test Actor {uuid.uuid4().hex[:8]}",
        role=role,
        is_active=True,
    )
    session.add(member)
    await session.flush()
    return member


async def _seed_task(
    session,
    member: TeamMember,
    *,
    deadline: date | None,
    status: str = "new",
) -> Task:
    task_repo = TaskRepository()
    task = await task_repo.create(
        session,
        title="Close candidate test task",
        description=None,
        checklist=[],
        priority="normal",
        assignee_id=member.id,
        created_by_id=member.id,
        source="text",
        deadline=deadline,
        reminder_at=None,
        reminder_comment=None,
        reminder_sent_at=None,
        meeting_id=None,
    )
    if status != "new":
        task = await task_repo.update(session, task.id, status=status)
    return task


async def _list_tasks(session, member, **overrides):
    """Call list_tasks with explicit defaults (Query(...) defaults don't apply
    when the coroutine is invoked directly outside FastAPI)."""
    params = dict(
        assignee_id=None,
        created_by_id=None,
        department_id=None,
        status_filter=None,
        priority=None,
        meeting_id=None,
        source=None,
        search=None,
        label_ids=None,
        has_overdue=None,
        has_close_candidate=None,
        completed_since=None,
        sort="created_at_desc",
        page=1,
        per_page=200,
        member=member,
        session=session,
    )
    params.update(overrides)
    return await tasks_api.list_tasks(**params)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_close_candidate_includes_old_overdue_excludes_recent_and_closed():
    """has_close_candidate returns tasks >14d overdue and not done/cancelled."""
    async with async_session() as session:
        try:
            member = await _seed_member(session)

            old = await _seed_task(
                session, member, deadline=date.today() - timedelta(days=20)
            )
            recent = await _seed_task(
                session, member, deadline=date.today() - timedelta(days=5)
            )
            done_old = await _seed_task(
                session,
                member,
                deadline=date.today() - timedelta(days=20),
                status="done",
            )
            cancelled_old = await _seed_task(
                session,
                member,
                deadline=date.today() - timedelta(days=20),
                status="cancelled",
            )
            await session.flush()

            response = await _list_tasks(
                session, member, has_close_candidate=True
            )

            returned_ids = {item.short_id for item in response.items}
            assert old.short_id in returned_ids
            assert recent.short_id not in returned_ids
            assert done_old.short_id not in returned_ids
            assert cancelled_old.short_id not in returned_ids
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_has_overdue_still_works_alongside_close_candidate():
    """has_overdue keeps its day-1 threshold (not the 14-day candidate window)."""
    async with async_session() as session:
        try:
            member = await _seed_member(session)

            recent_overdue = await _seed_task(
                session, member, deadline=date.today() - timedelta(days=5)
            )
            await session.flush()

            response = await _list_tasks(
                session, member, has_overdue=True
            )

            returned_ids = {item.short_id for item in response.items}
            assert recent_overdue.short_id in returned_ids
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_close_candidate_boundary_is_inclusive_at_14_days():
    """A task overdue by exactly 14 days is included; 13 days is excluded.

    Aligns the backend window with the frontend candidate view (>= 14 days).
    """
    async with async_session() as session:
        try:
            member = await _seed_member(session)

            exactly_14 = await _seed_task(
                session, member, deadline=date.today() - timedelta(days=14)
            )
            only_13 = await _seed_task(
                session, member, deadline=date.today() - timedelta(days=13)
            )
            await session.flush()

            response = await _list_tasks(
                session, member, has_close_candidate=True
            )

            returned_ids = {item.short_id for item in response.items}
            assert exactly_14.short_id in returned_ids
            assert only_13.short_id not in returned_ids
        finally:
            await session.rollback()
