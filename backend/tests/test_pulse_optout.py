"""Integration tests: personal Pulse block opt-out (Task 16).

The personal Pulse block in the daily digest is opt-OUT: ON by default, off
only when the member has an explicit ``pulse_personal`` NotificationSubscription
with ``is_active=False``. These run against the live dev DB (Docker container on
:5434): seed committed rows, exercise the helper / digest, clean up in a
``finally``. Mirrors tests/test_digest_close_candidates_integration.py.
"""

import uuid
from datetime import date, datetime, time, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from sqlalchemy import delete, func, select

from app.db.database import async_session, engine
from app.db.models import (
    ActivityEvent,
    NotificationSubscription,
    ReminderSettings,
    Task,
    TaskUpdate,
    TeamMember,
)
from app.services.reminder_service import ReminderService


@pytest_asyncio.fixture(autouse=True)
async def _dispose_engine_pool():
    await engine.dispose()
    yield
    await engine.dispose()


# ---------------------------------------------------------------------------
# Seed / cleanup helpers
# ---------------------------------------------------------------------------

async def _seed_member(session, *, telegram_id: int | None) -> TeamMember:
    member = TeamMember(
        full_name=f"Pulse Member {uuid.uuid4().hex[:8]}",
        role="member",
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
    assignee: TeamMember,
    created_by: TeamMember,
    deadline: date | None,
    last_activity_at: datetime,
    status: str = "new",
    title: str = "Pulse optout task",
) -> Task:
    next_short_id = (
        await session.execute(select(func.coalesce(func.max(Task.short_id), 0) + 1))
    ).scalar_one()
    task = Task(
        short_id=next_short_id,
        title=title,
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


async def _seed_event(
    session,
    *,
    task: Task,
    actor: TeamMember,
    event_type: str,
    created_at: datetime,
) -> ActivityEvent:
    event = ActivityEvent(
        event_type=event_type,
        actor_id=actor.id,
        task_id=task.id,
        visibility="company",
        payload={"actor_name": actor.full_name},
        created_at=created_at,
    )
    session.add(event)
    await session.flush()
    return event


async def _cleanup(
    task_ids: list[uuid.UUID],
    rs_ids: list[uuid.UUID],
    member_ids: list[uuid.UUID],
    event_ids: list[uuid.UUID],
) -> None:
    async with async_session() as session:
        async with session.begin():
            if event_ids:
                await session.execute(
                    delete(ActivityEvent).where(ActivityEvent.id.in_(event_ids))
                )
            if task_ids:
                await session.execute(
                    delete(TaskUpdate).where(TaskUpdate.task_id.in_(task_ids))
                )
                await session.execute(delete(Task).where(Task.id.in_(task_ids)))
            if member_ids:
                await session.execute(
                    delete(NotificationSubscription).where(
                        NotificationSubscription.member_id.in_(member_ids)
                    )
                )
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
# _is_pulse_personal_enabled helper
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_pulse_enabled_default_when_no_subscription():
    """Member with no subscription row → Pulse block enabled by default."""
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                member = await _seed_member(session, telegram_id=940_001)
                member_ids.append(member.id)

        service, _ = _make_service()
        async with async_session() as session:
            assert await service._is_pulse_personal_enabled(session, member_ids[0])
    finally:
        await _cleanup([], [], member_ids, [])


@pytest.mark.asyncio
async def test_pulse_disabled_when_subscription_inactive():
    """Explicit pulse_personal is_active=False → Pulse block disabled."""
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                member = await _seed_member(session, telegram_id=940_002)
                member_ids.append(member.id)
                await ReminderService(
                    bot=AsyncMock(), session_maker=async_session
                ).sub_repo.upsert(session, member.id, "pulse_personal", False)

        service, _ = _make_service()
        async with async_session() as session:
            assert not await service._is_pulse_personal_enabled(session, member_ids[0])
    finally:
        await _cleanup([], [], member_ids, [])


@pytest.mark.asyncio
async def test_pulse_enabled_when_subscription_active():
    """Explicit pulse_personal is_active=True → Pulse block enabled."""
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                member = await _seed_member(session, telegram_id=940_003)
                member_ids.append(member.id)
                await ReminderService(
                    bot=AsyncMock(), session_maker=async_session
                ).sub_repo.upsert(session, member.id, "pulse_personal", True)

        service, _ = _make_service()
        async with async_session() as session:
            assert await service._is_pulse_personal_enabled(session, member_ids[0])
    finally:
        await _cleanup([], [], member_ids, [])


# ---------------------------------------------------------------------------
# Toggle round-trip (replicates the /pulse handler core: get → flip → upsert)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_toggle_flips_state_round_trip():
    """A toggle flips default-ON → off, and a second toggle flips back on.

    Replicates the handler's pure core (get_by_member → compute current →
    upsert(not current)) and checks both the persisted row and the helper.
    """
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                member = await _seed_member(session, telegram_id=940_004)
                member_ids.append(member.id)
        member_id = member_ids[0]

        service, _ = _make_service()

        async def _toggle() -> bool:
            async with async_session() as session:
                async with session.begin():
                    subs = await service.sub_repo.get_by_member(session, member_id)
                    current = True
                    for s in subs:
                        if s.event_type == "pulse_personal":
                            current = s.is_active
                            break
                    new_state = not current
                    await service.sub_repo.upsert(
                        session, member_id, "pulse_personal", new_state
                    )
            return new_state

        # First toggle: default True → False
        assert await _toggle() is False
        async with async_session() as session:
            assert not await service._is_pulse_personal_enabled(session, member_id)

        # Second toggle: False → True
        assert await _toggle() is True
        async with async_session() as session:
            assert await service._is_pulse_personal_enabled(session, member_id)
    finally:
        await _cleanup([], [], member_ids, [])


# ---------------------------------------------------------------------------
# Digest integration: default-ON shows Pulse, opted-OUT hides it
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_digest_shows_pulse_block_by_default():
    """Default (no opt-out) → digest contains the personal Pulse block."""
    today = date.today()
    now = datetime.now(timezone.utc)
    task_ids: list[uuid.UUID] = []
    rs_ids: list[uuid.UUID] = []
    member_ids: list[uuid.UUID] = []
    event_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                member = await _seed_member(session, telegram_id=941_001)
                actor = await _seed_member(session, telegram_id=941_002)
                rs = await _seed_reminder_settings(session, member)
                task = await _seed_task(
                    session,
                    assignee=member,
                    created_by=member,
                    deadline=today + timedelta(days=3),
                    last_activity_at=now,
                    title="Свежая задача",
                )
                event = await _seed_event(
                    session,
                    task=task,
                    actor=actor,
                    event_type="progress_update",
                    created_at=now - timedelta(hours=2),
                )
                task_ids.append(task.id)
                rs_ids.append(rs.id)
                member_ids.extend([member.id, actor.id])
                event_ids.append(event.id)

        service, bot = _make_service()
        async with async_session() as session:
            member = await session.get(TeamMember, member_ids[0])
            rs = await session.get(ReminderSettings, rs_ids[0])
            await service._send_daily_digest(session, member, rs, today)

        text = _sent_texts(bot)
        assert "Что изменилось" in text
    finally:
        await _cleanup(task_ids, rs_ids, member_ids, event_ids)


@pytest.mark.asyncio
async def test_digest_hides_pulse_block_when_opted_out():
    """Opted out (pulse_personal is_active=False) → no Pulse text, no action rows.

    The rest of the digest (header, sections) is unchanged from pre-Task-15.
    """
    today = date.today()
    now = datetime.now(timezone.utc)
    task_ids: list[uuid.UUID] = []
    rs_ids: list[uuid.UUID] = []
    member_ids: list[uuid.UUID] = []
    event_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                member = await _seed_member(session, telegram_id=942_001)
                actor = await _seed_member(session, telegram_id=942_002)
                rs = await _seed_reminder_settings(session, member)
                task = await _seed_task(
                    session,
                    assignee=member,
                    created_by=member,
                    deadline=today + timedelta(days=3),
                    last_activity_at=now,
                    title="Свежая задача",
                )
                event = await _seed_event(
                    session,
                    task=task,
                    actor=actor,
                    event_type="progress_update",
                    created_at=now - timedelta(hours=2),
                )
                await ReminderService(
                    bot=AsyncMock(), session_maker=async_session
                ).sub_repo.upsert(session, member.id, "pulse_personal", False)
                task_ids.append(task.id)
                rs_ids.append(rs.id)
                member_ids.extend([member.id, actor.id])
                event_ids.append(event.id)

        service, bot = _make_service()
        async with async_session() as session:
            member = await session.get(TeamMember, member_ids[0])
            rs = await session.get(ReminderSettings, rs_ids[0])
            await service._send_daily_digest(session, member, rs, today)

        # Digest still sent (normal sections), but no Pulse text and no one-tap
        # action rows beyond the single "open my tasks" button.
        assert bot.send_message.await_count >= 1
        text = _sent_texts(bot)
        assert "Что изменилось" not in text
        call = bot.send_message.await_args_list[-1]
        markup = call.kwargs.get("reply_markup")
        assert markup is not None
        assert len(markup.inline_keyboard) == 1
    finally:
        await _cleanup(task_ids, rs_ids, member_ids, event_ids)
