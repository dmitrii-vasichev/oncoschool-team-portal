import unittest
import uuid
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.api import meetings as meetings_api


def _meeting_result(rows):
    return SimpleNamespace(
        scalars=lambda: SimpleNamespace(all=lambda: rows),
    )


class MeetingDeleteBehaviorTests(unittest.IsolatedAsyncioTestCase):
    async def test_delete_schedule_meeting_removes_active_series(self) -> None:
        schedule_id = uuid.uuid4()
        meeting_id = uuid.uuid4()
        sibling_id = uuid.uuid4()

        meeting = SimpleNamespace(
            id=meeting_id,
            schedule_id=schedule_id,
            title="Планерка",
            meeting_date=datetime(2026, 3, 2, 9, 0),
            participants=[],
            zoom_meeting_id="111111111",
        )
        sibling = SimpleNamespace(
            id=sibling_id,
            schedule_id=schedule_id,
            status="scheduled",
            zoom_meeting_id="222222222",
        )
        schedule = SimpleNamespace(
            id=schedule_id,
            is_active=True,
            recurrence="weekly",
            next_occurrence_at=datetime(2026, 3, 9, 9, 0),
            next_occurrence_skip=False,
            next_occurrence_time_override=None,
            telegram_targets=[],
            title="Планерка",
        )
        session = SimpleNamespace(
            get=AsyncMock(return_value=schedule),
            execute=AsyncMock(return_value=_meeting_result([meeting, sibling])),
            commit=AsyncMock(),
        )
        zoom_service = SimpleNamespace(delete_meeting=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(zoom_service=zoom_service))
        )
        moderator = SimpleNamespace(id=uuid.uuid4(), role="moderator")

        with patch.object(
            meetings_api.meeting_service,
            "get_meeting_by_id",
            AsyncMock(return_value=meeting),
        ), patch.object(
            meetings_api.meeting_repo,
            "delete",
            AsyncMock(return_value=True),
        ) as delete_mock:
            await meetings_api.delete_meeting(
                meeting_id=meeting_id,
                request=request,
                notify_participants=False,
                member=moderator,
                session=session,
            )

        self.assertFalse(schedule.is_active)
        self.assertIsNone(schedule.next_occurrence_time_override)
        session.execute.assert_awaited_once()
        session.commit.assert_awaited_once()

        deleted_ids = {call.args[1] for call in delete_mock.await_args_list}
        self.assertEqual(deleted_ids, {meeting_id, sibling_id})
        self.assertEqual(delete_mock.await_count, 2)

        deleted_zoom_ids = {call.args[0] for call in zoom_service.delete_meeting.await_args_list}
        self.assertEqual(deleted_zoom_ids, {"111111111", "222222222"})
        self.assertEqual(zoom_service.delete_meeting.await_count, 2)

    async def test_delete_manual_meeting_keeps_series_logic_unused(self) -> None:
        meeting_id = uuid.uuid4()
        meeting = SimpleNamespace(
            id=meeting_id,
            schedule_id=None,
            title="Разовая встреча",
            meeting_date=datetime(2026, 3, 2, 9, 0),
            participants=[],
            zoom_meeting_id="333333333",
        )
        session = SimpleNamespace(
            get=AsyncMock(),
            execute=AsyncMock(),
            commit=AsyncMock(),
        )
        zoom_service = SimpleNamespace(delete_meeting=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(zoom_service=zoom_service))
        )
        moderator = SimpleNamespace(id=uuid.uuid4(), role="moderator")

        with patch.object(
            meetings_api.meeting_service,
            "get_meeting_by_id",
            AsyncMock(return_value=meeting),
        ), patch.object(
            meetings_api.meeting_repo,
            "delete",
            AsyncMock(return_value=True),
        ) as delete_mock:
            await meetings_api.delete_meeting(
                meeting_id=meeting_id,
                request=request,
                notify_participants=False,
                member=moderator,
                session=session,
            )

        session.get.assert_not_awaited()
        session.execute.assert_not_awaited()
        session.commit.assert_awaited_once()

        delete_mock.assert_awaited_once_with(session, meeting_id)
        zoom_service.delete_meeting.assert_awaited_once_with("333333333")
