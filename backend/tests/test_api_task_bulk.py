"""Integration tests: bulk task operations in app.api.tasks.

Tests run against the live dev DB (Docker container on :5434). They call the
endpoint coroutine functions directly with a REAL session and REAL seeded
rows, then roll back so the dev DB is not polluted.

The session passed to the endpoint is a real AsyncSession whose .commit is
patched to .flush so changes stay visible in-session but never persist; the
surrounding `finally` rolls the transaction back.
"""

import uuid
from datetime import date, timedelta

import pytest
import pytest_asyncio

from app.api import tasks as tasks_api
from app.db.database import async_session, engine
from app.db.models import Task, TeamMember
from app.db.repositories import TaskRepository
from app.db.schemas import (
    BulkCancelRequest,
    BulkCompleteRequest,
    BulkExtendRequest,
    CancellationReason,
)


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


async def _seed_task(session, member: TeamMember, deadline: date | None = None) -> Task:
    task_repo = TaskRepository()
    return await task_repo.create(
        session,
        title="API bulk test task",
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


def _no_commit_session(session):
    """Wrap commit so endpoint code "commits" without persisting (flush only)."""
    async def _flush_instead():
        await session.flush()

    session.commit = _flush_instead  # type: ignore[assignment]
    return session


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_bulk_routes_not_shadowed_by_short_id():
    """The /bulk/* routes must resolve to the bulk handlers, not /{short_id}."""
    resolved = {
        r.path: r.endpoint.__name__
        for r in tasks_api.router.routes
        if getattr(r, "path", "").startswith("/tasks/bulk/")
    }
    assert resolved["/tasks/bulk/cancel"] == "bulk_cancel"
    assert resolved["/tasks/bulk/complete"] == "bulk_complete"
    assert resolved["/tasks/bulk/extend"] == "bulk_extend"


@pytest.mark.asyncio
async def test_bulk_cancel_three_tasks():
    """POST /bulk/cancel cancels all three tasks; failed is empty."""
    async with async_session() as session:
        try:
            member = await _seed_member(session)
            tasks = [await _seed_task(session, member) for _ in range(3)]
            _no_commit_session(session)

            result = await tasks_api.bulk_cancel(
                payload=BulkCancelRequest(
                    task_short_ids=[t.short_id for t in tasks],
                    reason=CancellationReason.obsolete,
                ),
                member=member,
                session=session,
            )

            assert result.succeeded == 3
            assert result.failed == []
            for t in tasks:
                fresh = await session.get(Task, t.id)
                await session.refresh(fresh)
                assert fresh.status == "cancelled"
                assert fresh.cancellation_reason == "obsolete"
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_bulk_complete_tasks():
    """POST /bulk/complete completes all tasks; statuses become done."""
    async with async_session() as session:
        try:
            member = await _seed_member(session)
            tasks = [await _seed_task(session, member) for _ in range(2)]
            _no_commit_session(session)

            result = await tasks_api.bulk_complete(
                payload=BulkCompleteRequest(
                    task_short_ids=[t.short_id for t in tasks],
                ),
                member=member,
                session=session,
            )

            assert result.succeeded == 2
            assert result.failed == []
            for t in tasks:
                fresh = await session.get(Task, t.id)
                await session.refresh(fresh)
                assert fresh.status == "done"
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_bulk_extend_tasks():
    """POST /bulk/extend pushes deadlines to today+days, bumps activity, clears escalation."""
    async with async_session() as session:
        try:
            member = await _seed_member(session)
            past = date.today() - timedelta(days=40)
            tasks = [await _seed_task(session, member, deadline=past) for _ in range(2)]
            # Simulate an escalation DM having been sent.
            for t in tasks:
                t.escalation_dm_sent_at = tasks_api.task_service._now_utc()
            await session.flush()
            baselines = {t.id: t.last_activity_at for t in tasks}
            _no_commit_session(session)

            result = await tasks_api.bulk_extend(
                payload=BulkExtendRequest(
                    task_short_ids=[t.short_id for t in tasks],
                    days=14,
                ),
                member=member,
                session=session,
            )

            assert result.succeeded == 2
            assert result.failed == []
            expected_deadline = date.today() + timedelta(days=14)
            for t in tasks:
                fresh = await session.get(Task, t.id)
                await session.refresh(fresh)
                assert fresh.deadline == expected_deadline
                assert fresh.last_activity_at > baselines[t.id]
                assert fresh.escalation_dm_sent_at is None
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_bulk_cancel_partial_failure():
    """One valid + one nonexistent short_id → succeeded == 1, one failed entry."""
    async with async_session() as session:
        try:
            member = await _seed_member(session)
            task = await _seed_task(session, member)
            _no_commit_session(session)

            result = await tasks_api.bulk_cancel(
                payload=BulkCancelRequest(
                    task_short_ids=[task.short_id, 999_999_999],
                    reason=CancellationReason.obsolete,
                ),
                member=member,
                session=session,
            )

            assert result.succeeded == 1
            assert len(result.failed) == 1
            assert result.failed[0]["short_id"] == 999_999_999

            fresh = await session.get(Task, task.id)
            await session.refresh(fresh)
            assert fresh.status == "cancelled"
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_bulk_extend_invalid_days_surfaces_in_failed():
    """extend with days not in {7,14,30} → each task lands in failed (ValueError)."""
    async with async_session() as session:
        try:
            member = await _seed_member(session)
            task = await _seed_task(session, member)
            _no_commit_session(session)

            result = await tasks_api.bulk_extend(
                payload=BulkExtendRequest(
                    task_short_ids=[task.short_id],
                    days=3,
                ),
                member=member,
                session=session,
            )

            assert result.succeeded == 0
            assert len(result.failed) == 1
            assert result.failed[0]["short_id"] == task.short_id

            fresh = await session.get(Task, task.id)
            await session.refresh(fresh)
            assert fresh.status != "cancelled"
        finally:
            await session.rollback()
