"""Integration tests: ReminderService daily company Pulse digest job.

These tests run against the live dev DB. The job under test
(_send_company_pulse_digest) opens its OWN session via session_maker, so
seeded rows must be COMMITTED to be visible to that fresh session. We mirror
the pattern in test_reminder_escalation_dm.py:
  - seed real members + activity_events + the pulse_chat_id app_setting
    (committed),
  - run the job (it opens its own session),
  - assert on the AsyncMock bot's send_message calls,
  - delete the seeded rows in a `finally` so the dev DB stays clean.
"""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from aiogram.types import InlineKeyboardMarkup
from sqlalchemy import delete

from app.api.settings import PULSE_CHAT_KEY
from app.db.database import async_session, engine
from app.db.models import ActivityEvent, AppSettings, TeamMember
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

async def _seed_member(session, full_name: str) -> TeamMember:
    member = TeamMember(
        full_name=full_name,
        role="member",
        is_active=True,
    )
    session.add(member)
    await session.flush()
    return member


async def _seed_event(
    session,
    *,
    actor: TeamMember,
    event_type: str,
    payload: dict,
    created_at: datetime,
) -> ActivityEvent:
    event = ActivityEvent(
        event_type=event_type,
        actor_id=actor.id,
        visibility="company",
        payload=payload,
        created_at=created_at,
    )
    session.add(event)
    await session.flush()
    return event


async def _set_pulse_chat(session, value: dict) -> None:
    session.add(AppSettings(key=PULSE_CHAT_KEY, value=value))
    await session.flush()


async def _cleanup(
    event_ids: list[uuid.UUID],
    member_ids: list[uuid.UUID],
    *,
    drop_pulse_setting: bool,
) -> None:
    async with async_session() as session:
        async with session.begin():
            if event_ids:
                await session.execute(
                    delete(ActivityEvent).where(ActivityEvent.id.in_(event_ids))
                )
            if member_ids:
                await session.execute(
                    delete(TeamMember).where(TeamMember.id.in_(member_ids))
                )
            if drop_pulse_setting:
                await session.execute(
                    delete(AppSettings).where(AppSettings.key == PULSE_CHAT_KEY)
                )


def _make_service() -> tuple[ReminderService, AsyncMock]:
    bot = AsyncMock()
    service = ReminderService(bot=bot, session_maker=async_session)
    return service, bot


def _yesterday_dt() -> datetime:
    """A UTC datetime guaranteed to be inside yesterday's local window.

    Subtracting a full day from "now" lands on yesterday's calendar date in
    any timezone close to UTC (incl. Europe/Moscow), avoiding midnight edge
    cases regardless of the moment the test runs.
    """
    return datetime.now(timezone.utc) - timedelta(days=1)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_digest_sent_for_yesterday_events():
    """Yesterday completion + chat configured → digest posted to chat."""
    event_ids: list[uuid.UUID] = []
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                actor = await _seed_member(session, "Pulse Actor Anna")
                await _set_pulse_chat(
                    session, {"chat_id": -100123, "thread_id": None}
                )
                event = await _seed_event(
                    session,
                    actor=actor,
                    event_type="task_completed",
                    payload={
                        "actor_name": "Pulse Actor Anna",
                        "department_name": "Marketing",
                    },
                    created_at=_yesterday_dt(),
                )
                event_ids.append(event.id)
                member_ids.append(actor.id)

        service, bot = _make_service()
        await service._send_company_pulse_digest()

        bot.send_message.assert_awaited_once()
        call = bot.send_message.await_args
        assert call.kwargs.get("chat_id") == -100123
        assert "Pulse Actor Anna" in call.kwargs.get("text", "")

        # Regression guard: the per-completion 👏 reaction keyboard must be
        # carried through to send_message (Team Pulse Task 13).
        markup = call.kwargs.get("reply_markup")
        assert markup is not None
        assert isinstance(markup, InlineKeyboardMarkup)
        buttons = [b for row in markup.inline_keyboard for b in row]
        assert any(
            b.callback_data.startswith("pulse:react:clap:") for b in buttons
        )
    finally:
        await _cleanup(event_ids, member_ids, drop_pulse_setting=True)


@pytest.mark.asyncio
async def test_no_send_on_empty_day():
    """Chat configured but no events in yesterday's window → nothing sent."""
    member_ids: list[uuid.UUID] = []
    try:
        async with async_session() as session:
            async with session.begin():
                # Seed a member but NO activity events.
                actor = await _seed_member(session, "Pulse Actor Empty")
                await _set_pulse_chat(
                    session, {"chat_id": -100124, "thread_id": None}
                )
                member_ids.append(actor.id)

        service, bot = _make_service()
        await service._send_company_pulse_digest()

        bot.send_message.assert_not_awaited()
    finally:
        await _cleanup([], member_ids, drop_pulse_setting=True)


@pytest.mark.asyncio
async def test_no_send_when_chat_not_configured():
    """Yesterday events but no pulse_chat_id setting → nothing sent."""
    event_ids: list[uuid.UUID] = []
    member_ids: list[uuid.UUID] = []
    try:
        # Make sure the setting is absent (another test may have left one).
        await _cleanup([], [], drop_pulse_setting=True)

        async with async_session() as session:
            async with session.begin():
                actor = await _seed_member(session, "Pulse Actor NoChat")
                event = await _seed_event(
                    session,
                    actor=actor,
                    event_type="task_completed",
                    payload={
                        "actor_name": "Pulse Actor NoChat",
                        "department_name": "Sales",
                    },
                    created_at=_yesterday_dt(),
                )
                event_ids.append(event.id)
                member_ids.append(actor.id)

        service, bot = _make_service()
        await service._send_company_pulse_digest()

        bot.send_message.assert_not_awaited()
    finally:
        await _cleanup(event_ids, member_ids, drop_pulse_setting=False)
