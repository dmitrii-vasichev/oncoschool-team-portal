import unittest
import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from app.db.schemas import CFGuestStoryCreate, CFGuestStoryUpdate
from app.services.content_factory.guest_story_service import GuestStoryService


class _FakeScalars:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def scalars(self):
        return _FakeScalars(self._rows)

    def scalar_one_or_none(self):
        return self._rows[0] if self._rows else None


class TestGuestStoryService(unittest.IsolatedAsyncioTestCase):
    async def test_create_guest_story(self):
        session = AsyncMock()
        session.add = Mock()
        session.flush = AsyncMock()
        session.refresh = AsyncMock()
        owner_id = uuid.uuid4()

        payload = CFGuestStoryCreate(
            display_name="Patient story candidate",
            role="patient",
            owner_id=owner_id,
            story_brief="Useful patient experience for a live event.",
            allowed_channels=["telegram", "vk"],
            sensitive_topics=["doctor_name"],
        )

        result = await GuestStoryService.create(session, payload)

        self.assertEqual(result.display_name, payload.display_name)
        self.assertEqual(result.role, "patient")
        self.assertEqual(result.status, "sourced")
        self.assertEqual(result.owner_id, owner_id)
        self.assertEqual(result.allowed_channels, ["telegram", "vk"])
        session.add.assert_called_once()
        session.flush.assert_awaited()
        session.refresh.assert_awaited_with(result)

    async def test_list_guest_stories_returns_rows(self):
        story = SimpleNamespace(
            id=uuid.uuid4(),
            display_name="Candidate",
            status="consent_sent",
            consent_status="sent",
            owner_id=uuid.uuid4(),
            stage_due_at=datetime.now(UTC),
        )
        session = AsyncMock()
        session.execute = AsyncMock(return_value=_FakeResult([story]))

        result = await GuestStoryService.list(
            session,
            status="consent_sent",
            owner_id=story.owner_id,
            consent_status="sent",
            bundle_id=None,
            publication_id=None,
            limit=25,
            offset=0,
        )

        self.assertEqual(result, [story])
        session.execute.assert_awaited_once()

    async def test_update_guest_story_partial(self):
        story = SimpleNamespace(
            id=uuid.uuid4(),
            display_name="Old",
            status="sourced",
            consent_status="not_started",
            allowed_channels=[],
        )
        payload = CFGuestStoryUpdate(
            status="consent_signed",
            consent_status="signed",
            allowed_channels=["telegram"],
        )
        session = AsyncMock()
        session.add = Mock()
        session.flush = AsyncMock()

        with patch.object(GuestStoryService, "get", AsyncMock(return_value=story)):
            result = await GuestStoryService.update(session, story.id, payload)

        self.assertEqual(result.status, "consent_signed")
        self.assertEqual(result.consent_status, "signed")
        self.assertEqual(result.allowed_channels, ["telegram"])
        self.assertEqual(result.display_name, "Old")
        session.flush.assert_awaited()

    async def test_create_comment_event(self):
        session = AsyncMock()
        session.add = Mock()
        session.flush = AsyncMock()
        session.refresh = AsyncMock()
        guest_story_id = uuid.uuid4()
        actor_id = uuid.uuid4()

        result = await GuestStoryService.create_comment(
            session,
            guest_story_id=guest_story_id,
            actor_id=actor_id,
            body="Гость просит не указывать город.",
        )

        self.assertEqual(result.guest_story_id, guest_story_id)
        self.assertEqual(result.actor_id, actor_id)
        self.assertEqual(result.event_type, "comment")
        self.assertEqual(result.body, "Гость просит не указывать город.")
        session.add.assert_called_once()
        session.flush.assert_awaited()
        session.refresh.assert_awaited_with(result)

    async def test_create_comment_event_reply_validates_parent_story(self):
        session = AsyncMock()
        session.add = Mock()
        session.execute = AsyncMock()
        session.flush = AsyncMock()
        session.refresh = AsyncMock()
        guest_story_id = uuid.uuid4()
        parent_event_id = uuid.uuid4()
        parent = SimpleNamespace(id=parent_event_id, guest_story_id=guest_story_id)
        session.execute.return_value = _FakeResult([parent])

        result = await GuestStoryService.create_comment(
            session,
            guest_story_id=guest_story_id,
            actor_id=uuid.uuid4(),
            body="Согласовали формулировку в ответ на прошлый комментарий.",
            parent_event_id=parent_event_id,
        )

        self.assertEqual(result.parent_event_id, parent_event_id)
        session.execute.assert_awaited_once()
        session.add.assert_called_once()

    async def test_create_comment_event_rejects_parent_from_another_story(self):
        session = AsyncMock()
        session.execute = AsyncMock()
        parent_event_id = uuid.uuid4()
        session.execute.return_value = _FakeResult(
            [SimpleNamespace(id=parent_event_id, guest_story_id=uuid.uuid4())]
        )

        with self.assertRaises(ValueError):
            await GuestStoryService.create_comment(
                session,
                guest_story_id=uuid.uuid4(),
                actor_id=uuid.uuid4(),
                body="Ответ не должен перескочить в другую историю.",
                parent_event_id=parent_event_id,
            )

    async def test_update_guest_story_logs_watched_changes(self):
        actor_id = uuid.uuid4()
        story = SimpleNamespace(
            id=uuid.uuid4(),
            display_name="Old",
            status="sourced",
            consent_status="not_started",
            gift_status="not_required",
            follow_up_due_at=None,
        )
        payload = CFGuestStoryUpdate(
            status="consent_sent",
            consent_status="sent",
            gift_status="pending",
            follow_up_due_at=datetime(2026, 5, 16, tzinfo=UTC),
        )
        session = AsyncMock()
        session.add = Mock()
        session.flush = AsyncMock()

        with patch.object(GuestStoryService, "get", AsyncMock(return_value=story)):
            result = await GuestStoryService.update(
                session,
                story.id,
                payload,
                actor_id=actor_id,
            )

        self.assertEqual(result.status, "consent_sent")
        event_types = [
            call.args[0].event_type for call in session.add.call_args_list
        ]
        self.assertEqual(
            event_types,
            [
                "status_changed",
                "consent_changed",
                "gift_changed",
                "follow_up_changed",
            ],
        )
        self.assertTrue(
            all(call.args[0].actor_id == actor_id for call in session.add.call_args_list)
        )


if __name__ == "__main__":
    unittest.main()
