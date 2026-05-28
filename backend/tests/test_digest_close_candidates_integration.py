"""Integration tests: close-candidates + moderator escalation digest sections.

These run against the live dev DB (Docker container on :5434). We seed
committed rows, call ReminderService._send_daily_digest directly with a real
ReminderSettings row, inspect the AsyncMock bot's send_message calls, and clean
up seeded rows in a `finally`. Mirrors tests/test_reminder_autocancel.py.
"""

import uuid
from datetime import date, datetime, time, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from sqlalchemy import delete, func, select

from app.db.database import async_session, engine
from app.db.models import ReminderSettings, Task, TaskUpdate, TeamMember
from app.services.reminder_service import ReminderService


@pytest_asyncio.fixture(autouse=True)
async def _dispose_engine_pool():
    await engine.dispose()
    yield
    await engine.dispose()


# ---------------------------------------------------------------------------
# Seed / cleanup helpers
# ---------------------------------------------------------------------------

async def _seed_member(
    session, *, telegram_id: int | None, role: str = "member"
) -> TeamMember:
    member = TeamMember(
        full_name=f"Digest Member {uuid.uuid4().hex[:8]}",
        role=role,
        is_active=True,
        telegram_id=telegram_id,
    )
    session.add(member)
    await session.flush()
    return member


async def _seed_reminder_settings(session, member: TeamMember) -> ReminderSettings:
    rs = ReminderSettings(
        member_id=member.id,
        is_enabled=True,
        reminder_time=time(9, 0),
        timezone="Europe/Moscow",
        days_of_week=[1, 2, 3, 4, 5],
        include_overdue=True,
        include_upcoming=True,
        include_in_progress=True,
        include_new=True,
    )
    session.add(rs)
    await session.flush()
    return rs


async def _seed_task(
    session,
    *,
    assignee: TeamMember | None,
    created_by: TeamMember | None,
    deadline: date | None,
    last_activity_at: datetime,
    status: str = "new",
    cancellation_reason: str | None = None,
    escalation_dm_sent_at: datetime | None = None,
    title: str = "Digest test task",
) -> Task:
    next_short_id = (
        await session.execute(select(func.coalesce(func.max(Task.short_id), 0) + 1))
    ).scalar_one()
    task = Task(
        short_id=next_short_id,
        title=title,
        status=status,
        priority="normal",
        assignee_id=assignee.id if assignee else None,
        created_by_id=created_by.id if created_by else None,
        source="text",
        deadline=deadline,
        last_activity_at=last_activity_at,
        cancellation_reason=cancellation_reason,
        escalation_dm_sent_at=escalation_dm_sent_at,
    )
    session.add(task)
    await session.flush()
    return task


async def _cleanup(
    task_ids: list[uuid.UUID],
    rs_ids: list[uuid.UUID],
    member_ids: list[uuid.UUID],
) -> None:
    async with async_session() as session:
        async with session.begin():
            if task_ids:
                await session.execute(
                    delete(TaskUpdate).where(TaskUpdate.task_id.in_(task_ids))
                )
                await session.execute(delete(Task).where(Task.id.in_(task_ids)))
            if rs_ids:
                await session.execute(
                    delete(ReminderSettings).where(ReminderSettings.id.in_(rs_ids))
                )
            if member_ids:
                await session.execute(
                    delete(TeamMember).where(TeamMember.id.in_(member_ids))
                )


def _make_service() -> tuple[ReminderService, AsyncMock]:
    bot = AsyncMock()
    service = ReminderService(bot=bot, session_maker=async_session)
    return service, bot


def _sent_texts(bot: AsyncMock) -> str:
    return " ".join(
        str(c.kwargs.get("text", c.args[1] if len(c.args) > 1 else ""))
        for c in bot.send_message.await_args_list
    )


# ---------------------------------------------------------------------------
# Close-candidates section
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_digest_assigned_overdue_task_in_close_candidates():
    """Member assigned a task 18 days overdue → digest shows close candidates."""
    today = date.today()
    now = datetime.now(timezone.utc)
    task_ids: list[uuid.UUID] = []
    rs_ids: list[uuid.UUID] = []
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                member = await _seed_member(session, telegram_id=920_001)
                rs = await _seed_reminder_settings(session, member)
                task = await _seed_task(
                    session,
                    assignee=member,
                    created_by=member,
                    deadline=today - timedelta(days=18),
                    last_activity_at=now - timedelta(days=18),
                    title="Закрыть кандидата",
                )
                task_ids.append(task.id)
                rs_ids.append(rs.id)
                member_ids.append(member.id)
                short_id = task.short_id

        service, bot = _make_service()
        async with async_session() as session:
            member = await session.get(TeamMember, member_ids[0])
            rs = await session.get(ReminderSettings, rs_ids[0])
            await service._send_daily_digest(session, member, rs, today)

        text = _sent_texts(bot)
        assert "Кандидаты на закрытие" in text
        assert f"#{short_id}" in text
        assert "Закрыть кандидата" in text
        assert "18 дней" in text
    finally:
        await _cleanup(task_ids, rs_ids, member_ids)


@pytest.mark.asyncio
async def test_digest_authored_overdue_task_in_close_candidates():
    """A task the member AUTHORED (not assigned) 20 days overdue still shows."""
    today = date.today()
    now = datetime.now(timezone.utc)
    task_ids: list[uuid.UUID] = []
    rs_ids: list[uuid.UUID] = []
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                author = await _seed_member(session, telegram_id=921_001)
                assignee = await _seed_member(session, telegram_id=921_002)
                rs = await _seed_reminder_settings(session, author)
                # Give the author at least one active assigned task so the digest
                # is not short-circuited by the no-active-tasks early return.
                own_task = await _seed_task(
                    session,
                    assignee=author,
                    created_by=author,
                    deadline=today + timedelta(days=5),
                    last_activity_at=now,
                    title="Свежая задача автора",
                )
                authored = await _seed_task(
                    session,
                    assignee=assignee,
                    created_by=author,
                    deadline=today - timedelta(days=20),
                    last_activity_at=now - timedelta(days=20),
                    title="Авторская просрочка",
                )
                task_ids.extend([own_task.id, authored.id])
                rs_ids.append(rs.id)
                member_ids.extend([author.id, assignee.id])
                authored_short_id = authored.short_id

        service, bot = _make_service()
        async with async_session() as session:
            author = await session.get(TeamMember, member_ids[0])
            rs = await session.get(ReminderSettings, rs_ids[0])
            await service._send_daily_digest(session, author, rs, today)

        text = _sent_texts(bot)
        assert "Кандидаты на закрытие" in text
        assert f"#{authored_short_id}" in text
        assert "Авторская просрочка" in text
        assert "20 дней" in text
    finally:
        await _cleanup(task_ids, rs_ids, member_ids)


@pytest.mark.asyncio
async def test_digest_no_close_candidates_section_when_none():
    """Member with no ≥14d overdue tasks → no close-candidates section."""
    today = date.today()
    now = datetime.now(timezone.utc)
    task_ids: list[uuid.UUID] = []
    rs_ids: list[uuid.UUID] = []
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                member = await _seed_member(session, telegram_id=922_001)
                rs = await _seed_reminder_settings(session, member)
                task = await _seed_task(
                    session,
                    assignee=member,
                    created_by=member,
                    deadline=today + timedelta(days=3),
                    last_activity_at=now,
                    title="Не кандидат",
                )
                task_ids.append(task.id)
                rs_ids.append(rs.id)
                member_ids.append(member.id)

        service, bot = _make_service()
        async with async_session() as session:
            member = await session.get(TeamMember, member_ids[0])
            rs = await session.get(ReminderSettings, rs_ids[0])
            await service._send_daily_digest(session, member, rs, today)

        text = _sent_texts(bot)
        assert "Кандидаты на закрытие" not in text
    finally:
        await _cleanup(task_ids, rs_ids, member_ids)


# ---------------------------------------------------------------------------
# Moderator escalation block
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_moderator_digest_shows_stuck_task():
    """Moderator with a 35-day stuck task (DM sent) → digest shows Контроль."""
    today = date.today()
    now = datetime.now(timezone.utc)
    task_ids: list[uuid.UUID] = []
    rs_ids: list[uuid.UUID] = []
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                moderator = await _seed_member(
                    session, telegram_id=923_001, role="moderator"
                )
                assignee = await _seed_member(session, telegram_id=923_002)
                rs = await _seed_reminder_settings(session, moderator)
                # Moderator's own active task so the digest is built normally.
                own_task = await _seed_task(
                    session,
                    assignee=moderator,
                    created_by=moderator,
                    deadline=today + timedelta(days=2),
                    last_activity_at=now,
                    title="Личная задача модератора",
                )
                stuck = await _seed_task(
                    session,
                    assignee=assignee,
                    created_by=assignee,
                    deadline=today - timedelta(days=35),
                    last_activity_at=now - timedelta(days=35),
                    escalation_dm_sent_at=now - timedelta(days=5),
                    title="Застрявшая команда",
                )
                task_ids.extend([own_task.id, stuck.id])
                rs_ids.append(rs.id)
                member_ids.extend([moderator.id, assignee.id])
                stuck_short_id = stuck.short_id

        service, bot = _make_service()
        async with async_session() as session:
            moderator = await session.get(TeamMember, member_ids[0])
            rs = await session.get(ReminderSettings, rs_ids[0])
            await service._send_daily_digest(session, moderator, rs, today)

        text = _sent_texts(bot)
        assert "Контроль" in text
        assert f"#{stuck_short_id}" in text
        assert "35 дней" in text
    finally:
        await _cleanup(task_ids, rs_ids, member_ids)


@pytest.mark.asyncio
async def test_moderator_with_no_active_tasks_still_gets_escalation_block():
    """Moderator with NO active personal tasks but a non-empty escalation block
    still receives a digest containing Контроль (the edge case)."""
    today = date.today()
    now = datetime.now(timezone.utc)
    task_ids: list[uuid.UUID] = []
    rs_ids: list[uuid.UUID] = []
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                moderator = await _seed_member(
                    session, telegram_id=924_001, role="moderator"
                )
                assignee = await _seed_member(session, telegram_id=924_002)
                rs = await _seed_reminder_settings(session, moderator)
                # Moderator has NO active task; only a team-wide stuck task exists.
                stuck = await _seed_task(
                    session,
                    assignee=assignee,
                    created_by=assignee,
                    deadline=today - timedelta(days=40),
                    last_activity_at=now - timedelta(days=40),
                    escalation_dm_sent_at=now - timedelta(days=6),
                    title="Никем не тронутая",
                )
                task_ids.append(stuck.id)
                rs_ids.append(rs.id)
                member_ids.extend([moderator.id, assignee.id])
                stuck_short_id = stuck.short_id

        service, bot = _make_service()
        async with async_session() as session:
            moderator = await session.get(TeamMember, member_ids[0])
            rs = await session.get(ReminderSettings, rs_ids[0])
            await service._send_daily_digest(session, moderator, rs, today)

        # A message must have been sent and must contain the escalation block.
        assert bot.send_message.await_count >= 1
        text = _sent_texts(bot)
        assert "Контроль" in text
        assert f"#{stuck_short_id}" in text
        # And NOT the "no active tasks" celebration message.
        assert "нет активных задач" not in text
    finally:
        await _cleanup(task_ids, rs_ids, member_ids)
