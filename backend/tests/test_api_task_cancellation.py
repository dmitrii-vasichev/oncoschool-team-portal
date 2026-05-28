"""Integration tests: cancellation REST endpoints in app.api.tasks.

Tests run against the live dev DB (Docker container on :5434). They call the
endpoint coroutine functions directly with a REAL session and REAL seeded
rows, then roll back so the dev DB is not polluted.

The session passed to the endpoint is a real AsyncSession whose .commit is
patched to .flush so changes stay visible in-session but never persist; the
surrounding `finally` rolls the transaction back.
"""

import uuid
from types import SimpleNamespace

import pytest
import pytest_asyncio
from fastapi import HTTPException

from app.api import tasks as tasks_api
from app.db.database import async_session, engine
from app.db.models import Task, TeamMember
from app.db.repositories import TaskRepository
from app.db.schemas import CancelTaskRequest, CancellationReason, TaskEdit


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


async def _seed_task(session, member: TeamMember) -> Task:
    task_repo = TaskRepository()
    return await task_repo.create(
        session,
        title="API cancellation test task",
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


def _no_commit_session(session):
    """Wrap commit so endpoint code "commits" without persisting (flush only)."""
    async def _flush_instead():
        await session.flush()

    session.commit = _flush_instead  # type: ignore[assignment]
    return session


def _request_no_bot():
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(bot=None)))


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_cancel_endpoint_cancels_task():
    """POST /{short_id}/cancel with a valid reason cancels the task."""
    async with async_session() as session:
        try:
            member = await _seed_member(session)
            task = await _seed_task(session, member)
            _no_commit_session(session)

            response = await tasks_api.cancel_task_endpoint(
                short_id=task.short_id,
                data=CancelTaskRequest(reason=CancellationReason.obsolete),
                member=member,
                session=session,
            )

            assert response.status == "cancelled"
            assert response.cancellation_reason == "obsolete"
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_cancel_endpoint_missing_reason_is_422():
    """A missing/invalid reason fails Pydantic validation (422 at the API layer)."""
    # CancelTaskRequest requires `reason`; building it without one raises a
    # pydantic ValidationError, which FastAPI surfaces as HTTP 422.
    import pydantic

    with pytest.raises(pydantic.ValidationError):
        CancelTaskRequest()

    with pytest.raises(pydantic.ValidationError):
        CancelTaskRequest(reason="not_a_reason")


@pytest.mark.asyncio
async def test_cancel_endpoint_404_when_task_missing():
    """Unknown short_id returns 404."""
    async with async_session() as session:
        try:
            member = await _seed_member(session)
            _no_commit_session(session)

            with pytest.raises(HTTPException) as exc_info:
                await tasks_api.cancel_task_endpoint(
                    short_id=999_999_999,
                    data=CancelTaskRequest(reason=CancellationReason.obsolete),
                    member=member,
                    session=session,
                )

            assert exc_info.value.status_code == 404
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_patch_status_cancelled_is_rejected():
    """PATCH /{short_id} with status=cancelled is rejected with 400."""
    async with async_session() as session:
        try:
            member = await _seed_member(session)
            task = await _seed_task(session, member)
            _no_commit_session(session)

            with pytest.raises(HTTPException) as exc_info:
                await tasks_api.update_task(
                    request=_request_no_bot(),
                    short_id=task.short_id,
                    data=TaskEdit(status="cancelled"),
                    member=member,
                    session=session,
                )

            assert exc_info.value.status_code == 400
            assert "/cancel" in exc_info.value.detail

            # Task must NOT have been cancelled.
            fresh = await session.get(Task, task.id)
            await session.refresh(fresh)
            assert fresh.status != "cancelled"
        finally:
            await session.rollback()
