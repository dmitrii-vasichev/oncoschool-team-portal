import uuid
from datetime import date, datetime, timezone

import pytest
import pytest_asyncio
from sqlalchemy import func, select

from app.db.database import async_session, engine
from app.services.reminder_service import ReminderService


@pytest_asyncio.fixture(autouse=True)
async def _dispose_engine_pool():
    await engine.dispose()
    yield
    await engine.dispose()


async def _seed_member(session, *, full_name="Anna", role="member", telegram_id=None, is_active=True):
    from app.db.models import TeamMember
    m = TeamMember(id=uuid.uuid4(), full_name=full_name, role=role, telegram_id=telegram_id, is_active=is_active)
    session.add(m)
    await session.flush()
    return m


async def _seed_task(session, *, assignee, status="in_progress", deadline=None, completed_at=None):
    from app.db.models import Task
    next_short = (await session.execute(select(func.coalesce(func.max(Task.short_id), 0) + 1))).scalar_one()
    t = Task(id=uuid.uuid4(), short_id=next_short, title="X", status=status,
             assignee_id=assignee.id, created_by_id=assignee.id, deadline=deadline, completed_at=completed_at)
    session.add(t)
    await session.flush()
    return t


def _svc():
    return ReminderService(bot=None, session_maker=None)


@pytest.mark.asyncio
async def test_member_qualifies_when_all_month_tasks_on_time():
    async with async_session() as session:
        try:
            m = await _seed_member(session)
            await _seed_task(session, assignee=m, status="done", deadline=date(2026, 5, 20),
                             completed_at=datetime(2026, 5, 18, 10, 0))
            ok = await _svc()._member_no_overdue(session, m, date(2026, 5, 1), date(2026, 6, 1))
            assert ok is True
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_member_disqualified_by_late_completion():
    async with async_session() as session:
        try:
            m = await _seed_member(session)
            await _seed_task(session, assignee=m, status="done", deadline=date(2026, 5, 20),
                             completed_at=datetime(2026, 5, 25, 10, 0))
            ok = await _svc()._member_no_overdue(session, m, date(2026, 5, 1), date(2026, 6, 1))
            assert ok is False
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_member_disqualified_by_still_open_overdue():
    async with async_session() as session:
        try:
            m = await _seed_member(session)
            await _seed_task(session, assignee=m, status="in_progress", deadline=date(2026, 5, 20))
            ok = await _svc()._member_no_overdue(session, m, date(2026, 5, 1), date(2026, 6, 1))
            assert ok is False
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_member_with_no_month_deadlines_does_not_qualify():
    async with async_session() as session:
        try:
            m = await _seed_member(session)
            ok = await _svc()._member_no_overdue(session, m, date(2026, 5, 1), date(2026, 6, 1))
            assert ok is False
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_member_cancelled_task_is_ignored_but_ontime_qualifies():
    async with async_session() as session:
        try:
            m = await _seed_member(session)
            await _seed_task(session, assignee=m, status="done", deadline=date(2026, 5, 10),
                             completed_at=datetime(2026, 5, 9, 9, 0))
            await _seed_task(session, assignee=m, status="cancelled", deadline=date(2026, 5, 15))
            ok = await _svc()._member_no_overdue(session, m, date(2026, 5, 1), date(2026, 6, 1))
            assert ok is True  # cancelled task ignored; the on-time done task qualifies
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_member_with_only_cancelled_does_not_qualify():
    async with async_session() as session:
        try:
            m = await _seed_member(session)
            await _seed_task(session, assignee=m, status="cancelled", deadline=date(2026, 5, 15))
            ok = await _svc()._member_no_overdue(session, m, date(2026, 5, 1), date(2026, 6, 1))
            assert ok is False  # cancelled ignored -> considered == 0
        finally:
            await session.rollback()
