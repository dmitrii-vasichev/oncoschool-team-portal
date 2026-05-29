"""Integration tests: ReminderService 60-day auto-cancel job (Task 13).

These tests run against the live dev DB (Docker container on :5434). The job
under test (_daily_autocancel_job) opens its own session and COMMITS, so we
cannot rely on a single rollback. Instead we seed committed rows, run the job,
re-query, assert, and delete the seeded rows in a `finally`.
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from sqlalchemy import delete, func, select

from app.db.database import async_session, engine
from app.db.models import Task, TaskUpdate, TeamMember
from app.services.reminder_service import ReminderService


# ---------------------------------------------------------------------------
# Engine pool disposal — mirrors the pattern in other DB-backed tests
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture(autouse=True)
async def _dispose_engine_pool():
    await engine.dispose()
    yield
    await engine.dispose()


# ---------------------------------------------------------------------------
# Seed / cleanup helpers
# ---------------------------------------------------------------------------

async def _seed_member(session, telegram_id: int | None) -> TeamMember:
    member = TeamMember(
        full_name=f"Autocancel Member {uuid.uuid4().hex[:8]}",
        role="member",
        is_active=True,
        telegram_id=telegram_id,
    )
    session.add(member)
    await session.flush()
    return member


async def _seed_task(
    session,
    *,
    assignee: TeamMember,
    created_by: TeamMember,
    deadline: date,
    last_activity_at: datetime,
    status: str = "new",
) -> Task:
    next_short_id = (
        await session.execute(select(func.coalesce(func.max(Task.short_id), 0) + 1))
    ).scalar_one()
    task = Task(
        short_id=next_short_id,
        title="Autocancel test task",
        status=status,
        priority="normal",
        assignee_id=assignee.id,
        created_by_id=created_by.id,
        source="text",
        deadline=deadline,
        last_activity_at=last_activity_at,
    )
    session.add(task)
    await session.flush()
    return task


async def _cleanup(task_ids: list[uuid.UUID], member_ids: list[uuid.UUID]) -> None:
    async with async_session() as session:
        async with session.begin():
            if task_ids:
                await session.execute(
                    delete(TaskUpdate).where(TaskUpdate.task_id.in_(task_ids))
                )
                await session.execute(delete(Task).where(Task.id.in_(task_ids)))
            if member_ids:
                await session.execute(
                    delete(TeamMember).where(TeamMember.id.in_(member_ids))
                )


def _make_service() -> tuple[ReminderService, AsyncMock]:
    bot = AsyncMock()
    service = ReminderService(bot=bot, session_maker=async_session)
    return service, bot


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_autocancel_fires_at_65_days():
    """Task 65 days overdue + 65 days inactive → cancelled, reason auto_inactivity."""
    today = date.today()
    now = datetime.now(timezone.utc)
    task_ids: list[uuid.UUID] = []
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                assignee = await _seed_member(session, telegram_id=910_001)
                author = await _seed_member(session, telegram_id=910_002)
                task = await _seed_task(
                    session,
                    assignee=assignee,
                    created_by=author,
                    deadline=today - timedelta(days=65),
                    last_activity_at=now - timedelta(days=65),
                )
                task_ids.append(task.id)
                member_ids.extend([assignee.id, author.id])

        service, bot = _make_service()
        await service._daily_autocancel_job()

        async with async_session() as session:
            refreshed = await session.get(Task, task_ids[0])
            assert refreshed.status == "cancelled"
            assert refreshed.cancellation_reason == "auto_inactivity"

        # DM to both assignee + author.
        assert bot.send_message.await_count == 2
        recipients = {
            c.kwargs.get("chat_id", c.args[0] if c.args else None)
            for c in bot.send_message.await_args_list
        }
        assert recipients == {910_001, 910_002}
        all_texts = " ".join(
            str(c.kwargs.get("text", c.args[1] if len(c.args) > 1 else "")).lower()
            for c in bot.send_message.await_args_list
        )
        assert "автоматически отменена" in all_texts
        # The DM names the task (number + title), not just the number.
        assert "autocancel test task" in all_texts
    finally:
        await _cleanup(task_ids, member_ids)


@pytest.mark.asyncio
async def test_autocancel_skips_recent_activity():
    """Task 70 days overdue but active 10 days ago → NOT cancelled."""
    today = date.today()
    now = datetime.now(timezone.utc)
    task_ids: list[uuid.UUID] = []
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                assignee = await _seed_member(session, telegram_id=911_001)
                author = await _seed_member(session, telegram_id=911_002)
                task = await _seed_task(
                    session,
                    assignee=assignee,
                    created_by=author,
                    deadline=today - timedelta(days=70),
                    last_activity_at=now - timedelta(days=10),
                )
                task_ids.append(task.id)
                member_ids.extend([assignee.id, author.id])
                short_id = task.short_id

        service, bot = _make_service()
        await service._daily_autocancel_job()

        async with async_session() as session:
            refreshed = await session.get(Task, task_ids[0])
            assert refreshed.status != "cancelled"
            assert refreshed.cancellation_reason is None

        sent_for_task = [
            c
            for c in bot.send_message.await_args_list
            if f"#{short_id}"
            in str(c.kwargs.get("text", c.args[1] if len(c.args) > 1 else ""))
        ]
        assert sent_for_task == []
    finally:
        await _cleanup(task_ids, member_ids)


@pytest.mark.asyncio
async def test_autocancel_skips_done_task():
    """An already-done task 65 days overdue → untouched."""
    today = date.today()
    now = datetime.now(timezone.utc)
    task_ids: list[uuid.UUID] = []
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                assignee = await _seed_member(session, telegram_id=912_001)
                author = await _seed_member(session, telegram_id=912_002)
                task = await _seed_task(
                    session,
                    assignee=assignee,
                    created_by=author,
                    deadline=today - timedelta(days=65),
                    last_activity_at=now - timedelta(days=65),
                    status="done",
                )
                task_ids.append(task.id)
                member_ids.extend([assignee.id, author.id])

        service, bot = _make_service()
        await service._daily_autocancel_job()

        async with async_session() as session:
            refreshed = await session.get(Task, task_ids[0])
            assert refreshed.status == "done"
            assert refreshed.cancellation_reason is None
    finally:
        await _cleanup(task_ids, member_ids)


@pytest.mark.asyncio
async def test_autocancel_does_not_create_task_update():
    """Auto-cancel must NOT create a TaskUpdate (no system author available)."""
    today = date.today()
    now = datetime.now(timezone.utc)
    task_ids: list[uuid.UUID] = []
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                assignee = await _seed_member(session, telegram_id=913_001)
                author = await _seed_member(session, telegram_id=913_002)
                task = await _seed_task(
                    session,
                    assignee=assignee,
                    created_by=author,
                    deadline=today - timedelta(days=65),
                    last_activity_at=now - timedelta(days=65),
                )
                task_ids.append(task.id)
                member_ids.extend([assignee.id, author.id])

        service, _bot = _make_service()
        await service._daily_autocancel_job()

        async with async_session() as session:
            count = (
                await session.execute(
                    select(func.count())
                    .select_from(TaskUpdate)
                    .where(TaskUpdate.task_id == task_ids[0])
                )
            ).scalar_one()
            assert count == 0
    finally:
        await _cleanup(task_ids, member_ids)
