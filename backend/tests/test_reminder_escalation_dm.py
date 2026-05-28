"""Integration tests: ReminderService 30-day escalation DM job (Task 12).

These tests run against the live dev DB (Docker container on :5434). The job
under test (_check_and_send_escalation_dms) opens its own session and COMMITS,
so we cannot rely on a single rollback. Instead we:
  - seed real members + tasks (committed),
  - run the job,
  - re-query in a fresh session to assert DB state,
  - assert on the AsyncMock bot's send_message calls,
  - delete the seeded rows in a `finally` so the dev DB stays clean.
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from sqlalchemy import delete, select

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
        full_name=f"Esc DM Member {uuid.uuid4().hex[:8]}",
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
    escalation_dm_sent_at: datetime | None = None,
    status: str = "new",
) -> Task:
    # Allocate the next short_id the same way TaskRepository.create does.
    from sqlalchemy import func

    next_short_id = (
        await session.execute(select(func.coalesce(func.max(Task.short_id), 0) + 1))
    ).scalar_one()
    task = Task(
        short_id=next_short_id,
        title="Escalation DM test task",
        status=status,
        priority="normal",
        assignee_id=assignee.id,
        created_by_id=created_by.id,
        source="text",
        deadline=deadline,
        last_activity_at=last_activity_at,
        escalation_dm_sent_at=escalation_dm_sent_at,
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
async def test_first_time_dm_sent_at_35_days():
    """Task 35 days overdue, never DM'd → DM to assignee+author, timestamp set."""
    today = date.today()
    now = datetime.now(timezone.utc)
    task_ids: list[uuid.UUID] = []
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                assignee = await _seed_member(session, telegram_id=900_001)
                author = await _seed_member(session, telegram_id=900_002)
                task = await _seed_task(
                    session,
                    assignee=assignee,
                    created_by=author,
                    deadline=today - timedelta(days=35),
                    last_activity_at=now - timedelta(days=35),
                    escalation_dm_sent_at=None,
                )
                task_ids.append(task.id)
                member_ids.extend([assignee.id, author.id])
                short_id = task.short_id

        service, bot = _make_service()
        await service._check_and_send_escalation_dms()

        # Two DMs: assignee + author.
        assert bot.send_message.await_count == 2
        recipients = {
            c.kwargs.get("chat_id", c.args[0] if c.args else None)
            for c in bot.send_message.await_args_list
        }
        assert recipients == {900_001, 900_002}

        async with async_session() as session:
            refreshed = await session.get(Task, task_ids[0])
            assert refreshed.escalation_dm_sent_at is not None
        # The DM text mentions the task short_id.
        all_texts = " ".join(
            str(c.kwargs.get("text", c.args[1] if len(c.args) > 1 else ""))
            for c in bot.send_message.await_args_list
        )
        assert f"#{short_id}" in all_texts
    finally:
        await _cleanup(task_ids, member_ids)


@pytest.mark.asyncio
async def test_only_10_days_overdue_no_dm():
    """Task only 10 days overdue → no escalation DM."""
    today = date.today()
    now = datetime.now(timezone.utc)
    task_ids: list[uuid.UUID] = []
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                assignee = await _seed_member(session, telegram_id=901_001)
                author = await _seed_member(session, telegram_id=901_002)
                task = await _seed_task(
                    session,
                    assignee=assignee,
                    created_by=author,
                    deadline=today - timedelta(days=10),
                    last_activity_at=now - timedelta(days=10),
                    escalation_dm_sent_at=None,
                )
                task_ids.append(task.id)
                member_ids.extend([assignee.id, author.id])
                short_id = task.short_id

        service, bot = _make_service()
        await service._check_and_send_escalation_dms()

        sent_for_task = [
            c
            for c in bot.send_message.await_args_list
            if f"#{short_id}"
            in str(c.kwargs.get("text", c.args[1] if len(c.args) > 1 else ""))
        ]
        assert sent_for_task == []

        async with async_session() as session:
            refreshed = await session.get(Task, task_ids[0])
            assert refreshed.escalation_dm_sent_at is None
    finally:
        await _cleanup(task_ids, member_ids)


@pytest.mark.asyncio
async def test_dm_not_resent_after_only_one_day():
    """DM sent 1 day ago → NOT resent (repeat needs 7+ days)."""
    today = date.today()
    now = datetime.now(timezone.utc)
    task_ids: list[uuid.UUID] = []
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                assignee = await _seed_member(session, telegram_id=902_001)
                author = await _seed_member(session, telegram_id=902_002)
                dm_sent = now - timedelta(days=1)
                task = await _seed_task(
                    session,
                    assignee=assignee,
                    created_by=author,
                    deadline=today - timedelta(days=35),
                    last_activity_at=now - timedelta(days=35),
                    escalation_dm_sent_at=dm_sent,
                )
                task_ids.append(task.id)
                member_ids.extend([assignee.id, author.id])
                short_id = task.short_id

        service, bot = _make_service()
        await service._check_and_send_escalation_dms()

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
async def test_repeat_dm_after_week_of_inactivity():
    """DM 8 days ago + no activity since → repeat DM sent, timestamp advanced."""
    today = date.today()
    now = datetime.now(timezone.utc)
    task_ids: list[uuid.UUID] = []
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                assignee = await _seed_member(session, telegram_id=903_001)
                author = await _seed_member(session, telegram_id=903_002)
                dm_sent = now - timedelta(days=8)
                task = await _seed_task(
                    session,
                    assignee=assignee,
                    created_by=author,
                    deadline=today - timedelta(days=40),
                    last_activity_at=now - timedelta(days=40),
                    escalation_dm_sent_at=dm_sent,
                )
                task_ids.append(task.id)
                member_ids.extend([assignee.id, author.id])
                short_id = task.short_id

        service, bot = _make_service()
        await service._check_and_send_escalation_dms()

        sent_for_task = [
            c
            for c in bot.send_message.await_args_list
            if f"#{short_id}"
            in str(c.kwargs.get("text", c.args[1] if len(c.args) > 1 else ""))
        ]
        assert len(sent_for_task) == 2

        async with async_session() as session:
            refreshed = await session.get(Task, task_ids[0])
            assert refreshed.escalation_dm_sent_at > dm_sent
    finally:
        await _cleanup(task_ids, member_ids)


@pytest.mark.asyncio
async def test_repeat_dm_skipped_when_activity_after_dm():
    """DM 8 days ago BUT activity happened after the DM → no repeat."""
    today = date.today()
    now = datetime.now(timezone.utc)
    task_ids: list[uuid.UUID] = []
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                assignee = await _seed_member(session, telegram_id=904_001)
                author = await _seed_member(session, telegram_id=904_002)
                dm_sent = now - timedelta(days=8)
                task = await _seed_task(
                    session,
                    assignee=assignee,
                    created_by=author,
                    deadline=today - timedelta(days=40),
                    # Activity is more recent than the DM → not stuck.
                    last_activity_at=now - timedelta(days=2),
                    escalation_dm_sent_at=dm_sent,
                )
                task_ids.append(task.id)
                member_ids.extend([assignee.id, author.id])
                short_id = task.short_id

        service, bot = _make_service()
        await service._check_and_send_escalation_dms()

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
async def test_done_task_not_escalated():
    """A done task 35 days overdue → never DM'd."""
    today = date.today()
    now = datetime.now(timezone.utc)
    task_ids: list[uuid.UUID] = []
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                assignee = await _seed_member(session, telegram_id=905_001)
                author = await _seed_member(session, telegram_id=905_002)
                task = await _seed_task(
                    session,
                    assignee=assignee,
                    created_by=author,
                    deadline=today - timedelta(days=35),
                    last_activity_at=now - timedelta(days=35),
                    escalation_dm_sent_at=None,
                    status="done",
                )
                task_ids.append(task.id)
                member_ids.extend([assignee.id, author.id])
                short_id = task.short_id

        service, bot = _make_service()
        await service._check_and_send_escalation_dms()

        sent_for_task = [
            c
            for c in bot.send_message.await_args_list
            if f"#{short_id}"
            in str(c.kwargs.get("text", c.args[1] if len(c.args) > 1 else ""))
        ]
        assert sent_for_task == []
    finally:
        await _cleanup(task_ids, member_ids)
