import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.db.database import async_session, engine


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


from app.db.models import ActivityEvent
from app.services.notification_service import NotificationService


class _FakeBot:
    def __init__(self):
        self.sent = []

    async def send_message(self, chat_id, text, reply_markup=None):
        self.sent.append((chat_id, text))


@pytest.mark.asyncio
async def test_notify_kudos_pings_recipient():
    async with async_session() as session:
        try:
            giver = await _seed_member(session, full_name="Giver")
            recipient = await _seed_member(session, full_name="Recipient", telegram_id=12345)
            ev = ActivityEvent(
                event_type="kudos", actor_id=giver.id, visibility="company",
                payload={"recipient_id": str(recipient.id), "message": "ty"},
            )
            session.add(ev)
            await session.flush()
            bot = _FakeBot()
            await NotificationService(bot).notify_kudos(session, ev, giver)
            assert len(bot.sent) == 1
            assert bot.sent[0][0] == 12345
            assert "Giver" in bot.sent[0][1]
        finally:
            await session.rollback()
