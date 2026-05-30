"""Integration tests: pulse-chat settings REST endpoints in app.api.settings.

Tests run against the live dev DB. They call the endpoint coroutine functions
directly with a REAL session and REAL seeded rows, then roll back so the dev DB
is not polluted.

The session passed to the endpoint is a real AsyncSession whose .commit is
patched to .flush so changes stay visible in-session but never persist; the
surrounding `finally` rolls the transaction back.
"""

import uuid

import pytest
import pytest_asyncio

from app.api import settings as settings_api
from app.db.database import async_session, engine
from app.db.models import TeamMember


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


def _no_commit_session(session):
    """Wrap commit so endpoint code "commits" without persisting (flush only)."""
    async def _flush_instead():
        await session.flush()

    session.commit = _flush_instead  # type: ignore[assignment]
    return session


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_put_then_get_pulse_chat_roundtrip():
    """PUT stores chat/thread, GET returns the saved values."""
    async with async_session() as session:
        try:
            member = await _seed_member(session)
            _no_commit_session(session)

            await settings_api.update_pulse_chat(
                data=settings_api.PulseChatUpdateRequest(
                    chat_id=-1001234, thread_id=42
                ),
                member=member,
                session=session,
            )

            response = await settings_api.get_pulse_chat(
                member=member,
                session=session,
            )

            assert response.chat_id == -1001234
            assert response.thread_id == 42
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_get_pulse_chat_unset_returns_null():
    """GET when the setting is unset returns nulls for both fields."""
    async with async_session() as session:
        try:
            member = await _seed_member(session)
            _no_commit_session(session)

            # Ensure the setting is absent for this in-session view.
            existing = await settings_api.app_settings_repo.get(
                session, settings_api.PULSE_CHAT_KEY
            )
            if existing is not None:
                await session.delete(existing)
                await session.flush()

            response = await settings_api.get_pulse_chat(
                member=member,
                session=session,
            )

            assert response.chat_id is None
            assert response.thread_id is None
        finally:
            await session.rollback()
