import uuid
import pytest
import pytest_asyncio
from app.db.database import async_session, engine
from app.db.models import ActivityEvent, Department, TeamMember
from app.services.activity_service import ActivityService

service = ActivityService()


@pytest_asyncio.fixture(autouse=True)
async def _dispose_engine_pool():
    await engine.dispose()
    yield
    await engine.dispose()


async def _dept(session, name):
    d = Department(id=uuid.uuid4(), name=f"{name}-{uuid.uuid4().hex[:6]}")
    session.add(d)
    await session.flush()
    return d


@pytest.mark.asyncio
async def test_member_sees_company_event_redacted_outside_department():
    async with async_session() as session:
        try:
            d_mkt = await _dept(session, "Mkt")
            d_other = await _dept(session, "Other")
            viewer = TeamMember(id=uuid.uuid4(), full_name="Viewer", role="member", department_id=d_other.id)
            actor = TeamMember(id=uuid.uuid4(), full_name="Anna", role="member", department_id=d_mkt.id)
            session.add_all([viewer, actor])
            await session.flush()
            ev = ActivityEvent(
                event_type="task_completed", actor_id=actor.id, department_id=d_mkt.id,
                visibility="company",
                payload={"actor_name": "Anna", "department_name": d_mkt.name, "task_title": "Secret", "task_short_id": 7},
            )
            session.add(ev)
            await session.flush()
            feed = await service.get_feed(session, viewer, limit=50, offset=0)
            row = next(r for r in feed if r["id"] == str(ev.id))
            assert row["actor_name"] == "Anna"
            assert row["department_name"] == d_mkt.name
            assert "task_title" not in row
            assert row["can_open"] is False
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_member_does_not_see_other_department_blocker():
    async with async_session() as session:
        try:
            d_mkt = await _dept(session, "Mkt")
            d_other = await _dept(session, "Other")
            viewer = TeamMember(id=uuid.uuid4(), full_name="Viewer", role="member", department_id=d_other.id)
            actor = TeamMember(id=uuid.uuid4(), full_name="Anna", role="member", department_id=d_mkt.id)
            session.add_all([viewer, actor])
            await session.flush()
            ev = ActivityEvent(
                event_type="blocker_raised", actor_id=actor.id, department_id=d_mkt.id,
                visibility="department", payload={"actor_name": "Anna", "blocker_text": "x"},
            )
            session.add(ev)
            await session.flush()
            feed = await service.get_feed(session, viewer, limit=50, offset=0)
            assert all(r["id"] != str(ev.id) for r in feed)
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_member_sees_own_department_blocker_full():
    async with async_session() as session:
        try:
            d_mkt = await _dept(session, "Mkt")
            viewer = TeamMember(id=uuid.uuid4(), full_name="Viewer", role="member", department_id=d_mkt.id)
            actor = TeamMember(id=uuid.uuid4(), full_name="Anna", role="member", department_id=d_mkt.id)
            session.add_all([viewer, actor])
            await session.flush()
            ev = ActivityEvent(
                event_type="blocker_raised", actor_id=actor.id, department_id=d_mkt.id,
                visibility="department", payload={"actor_name": "Anna", "task_title": "T", "task_short_id": 3, "blocker_text": "x"},
            )
            session.add(ev)
            await session.flush()
            feed = await service.get_feed(session, viewer, limit=50, offset=0)
            row = next(r for r in feed if r["id"] == str(ev.id))
            assert row["can_open"] is True
            assert row["task_title"] == "T"
            assert row["blocker_text"] == "x"
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_moderator_sees_full_payload():
    async with async_session() as session:
        try:
            d_mkt = await _dept(session, "Mkt")
            mod = TeamMember(id=uuid.uuid4(), full_name="Mod", role="moderator")
            actor = TeamMember(id=uuid.uuid4(), full_name="Anna", role="member", department_id=d_mkt.id)
            session.add_all([mod, actor])
            await session.flush()
            ev = ActivityEvent(
                event_type="task_completed", actor_id=actor.id, department_id=d_mkt.id,
                visibility="company",
                payload={"actor_name": "Anna", "department_name": d_mkt.name, "task_title": "Visible", "task_short_id": 9},
            )
            session.add(ev)
            await session.flush()
            feed = await service.get_feed(session, mod, limit=50, offset=0)
            row = next(r for r in feed if r["id"] == str(ev.id))
            assert row["task_title"] == "Visible"
            assert row["can_open"] is True
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_member_without_department_sees_company_only():
    async with async_session() as session:
        try:
            d_mkt = await _dept(session, "Mkt")
            viewer = TeamMember(id=uuid.uuid4(), full_name="NoDept", role="member", department_id=None)
            actor = TeamMember(id=uuid.uuid4(), full_name="Anna", role="member", department_id=d_mkt.id)
            session.add_all([viewer, actor])
            await session.flush()
            company_ev = ActivityEvent(
                event_type="task_completed", actor_id=actor.id, department_id=d_mkt.id,
                visibility="company", payload={"actor_name": "Anna", "department_name": d_mkt.name, "task_title": "C", "task_short_id": 1},
            )
            dept_ev = ActivityEvent(
                event_type="blocker_raised", actor_id=actor.id, department_id=d_mkt.id,
                visibility="department", payload={"actor_name": "Anna", "blocker_text": "x"},
            )
            session.add_all([company_ev, dept_ev])
            await session.flush()
            feed = await service.get_feed(session, viewer, limit=50, offset=0)
            ids = {r["id"] for r in feed}
            assert str(company_ev.id) in ids          # sees company event
            assert str(dept_ev.id) not in ids          # but not the department event
            company_row = next(r for r in feed if r["id"] == str(company_ev.id))
            assert company_row["can_open"] is False     # redacted (no dept scope)
            assert "task_title" not in company_row
        finally:
            await session.rollback()


@pytest.mark.asyncio
async def test_feed_reaction_counts_and_mine():
    async with async_session() as session:
        try:
            from app.db.models import ActivityReaction
            mod = TeamMember(id=uuid.uuid4(), full_name="Mod", role="moderator")
            other = TeamMember(id=uuid.uuid4(), full_name="Other", role="moderator")
            session.add_all([mod, other])
            await session.flush()
            ev = ActivityEvent(event_type="task_completed", actor_id=other.id, visibility="company",
                               payload={"actor_name": "Other"})
            session.add(ev)
            await session.flush()
            # mod reacts clap; other reacts clap + fire
            session.add_all([
                ActivityReaction(event_id=ev.id, member_id=mod.id, emoji="clap"),
                ActivityReaction(event_id=ev.id, member_id=other.id, emoji="clap"),
                ActivityReaction(event_id=ev.id, member_id=other.id, emoji="fire"),
            ])
            await session.flush()
            feed = await service.get_feed(session, mod, limit=50, offset=0)
            row = next(r for r in feed if r["id"] == str(ev.id))
            assert row["reactions"]["counts"]["clap"] == 2
            assert row["reactions"]["counts"]["fire"] == 1
            assert row["reactions"]["mine"] == ["clap"]   # only mod's own reaction
        finally:
            await session.rollback()
