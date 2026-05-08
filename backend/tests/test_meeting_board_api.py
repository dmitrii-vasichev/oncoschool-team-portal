import unittest
import uuid
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.api import meetings as meetings_api
from app.db.schemas import MeetingBoardSettingsUpdate


class MeetingBoardApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_update_board_requires_moderator(self) -> None:
        member = SimpleNamespace(id=uuid.uuid4(), role="member")
        session = SimpleNamespace()

        with self.assertRaises(meetings_api.HTTPException) as ctx:
            await meetings_api.update_meeting_board_settings(
                meeting_id=uuid.uuid4(),
                data=MeetingBoardSettingsUpdate(board_notes="Notes"),
                member=member,
                session=session,
            )

        self.assertEqual(ctx.exception.status_code, 403)

    async def test_get_board_returns_service_response(self) -> None:
        meeting_id = uuid.uuid4()
        member = SimpleNamespace(id=uuid.uuid4(), role="member")
        meeting = SimpleNamespace(
            id=meeting_id,
            title="Meeting",
            raw_summary=None,
            parsed_summary=None,
            decisions=[],
            notes=None,
            meeting_date=None,
            created_by_id=None,
            created_at=datetime.utcnow(),
            participants=[],
            zoom_join_url=None,
            zoom_meeting_id=None,
            schedule=None,
            status="scheduled",
            duration_minutes=60,
        )
        settings = SimpleNamespace(
            id=uuid.uuid4(),
            meeting_id=meeting_id,
            added_member_ids=[],
            added_department_ids=[],
            pinned_task_ids=[],
            focus_label_ids=[],
            materials=[],
            board_notes=None,
            created_by_id=None,
            updated_by_id=None,
            created_at=None,
            updated_at=None,
        )
        groups = SimpleNamespace(
            urgent=[],
            new=[],
            in_progress=[],
            review=[],
            done_this_week=[],
        )
        session = SimpleNamespace(commit=AsyncMock())

        with patch.object(
            meetings_api.meeting_service,
            "get_meeting_by_id",
            AsyncMock(return_value=meeting),
        ), patch.object(
            meetings_api.meeting_board_service,
            "get_board",
            AsyncMock(return_value=(settings, groups)),
        ):
            response = await meetings_api.get_meeting_board(
                meeting_id=meeting_id,
                member=member,
                session=session,
            )

        self.assertEqual(response.settings.meeting_id, meeting_id)
        self.assertEqual(response.urgent, [])
        self.assertEqual(response.new, [])
        session.commit.assert_awaited_once()

    async def test_update_board_settings_persists_board_notes(self) -> None:
        meeting_id = uuid.uuid4()
        member = SimpleNamespace(id=uuid.uuid4(), role="moderator")
        meeting = SimpleNamespace(id=meeting_id)
        existing_settings = SimpleNamespace(id=uuid.uuid4(), meeting_id=meeting_id)
        updated_settings = SimpleNamespace(
            id=existing_settings.id,
            meeting_id=meeting_id,
            added_member_ids=[],
            added_department_ids=[],
            pinned_task_ids=[],
            focus_label_ids=[],
            materials=[],
            board_notes="Notes",
            created_by_id=None,
            updated_by_id=member.id,
            created_at=None,
            updated_at=None,
        )
        session = SimpleNamespace(commit=AsyncMock())

        get_or_create = AsyncMock(return_value=existing_settings)
        update = AsyncMock(return_value=updated_settings)
        with patch.object(
            meetings_api.meeting_service,
            "get_meeting_by_id",
            AsyncMock(return_value=meeting),
        ), patch.object(
            meetings_api.meeting_board_service.board_repo,
            "get_or_create",
            get_or_create,
        ), patch.object(
            meetings_api.meeting_board_service.board_repo,
            "update",
            update,
        ):
            response = await meetings_api.update_meeting_board_settings(
                meeting_id=meeting_id,
                data=MeetingBoardSettingsUpdate(board_notes="Notes"),
                member=member,
                session=session,
            )

        get_or_create.assert_awaited_once_with(session, meeting_id, member)
        update.assert_awaited_once_with(
            session,
            existing_settings,
            member=member,
            board_notes="Notes",
        )
        session.commit.assert_awaited_once()
        self.assertEqual(response.board_notes, "Notes")
        self.assertEqual(response.updated_by_id, member.id)

    async def test_update_board_settings_persists_focus_label_ids(self) -> None:
        meeting_id = uuid.uuid4()
        focus_label_ids = [uuid.uuid4(), uuid.uuid4()]
        member = SimpleNamespace(id=uuid.uuid4(), role="moderator")
        meeting = SimpleNamespace(id=meeting_id)
        existing_settings = SimpleNamespace(id=uuid.uuid4(), meeting_id=meeting_id)
        updated_settings = SimpleNamespace(
            id=existing_settings.id,
            meeting_id=meeting_id,
            added_member_ids=[],
            added_department_ids=[],
            pinned_task_ids=[],
            focus_label_ids=focus_label_ids,
            materials=[],
            board_notes=None,
            created_by_id=None,
            updated_by_id=member.id,
            created_at=None,
            updated_at=None,
        )
        session = SimpleNamespace(commit=AsyncMock())

        get_or_create = AsyncMock(return_value=existing_settings)
        update = AsyncMock(return_value=updated_settings)
        with patch.object(
            meetings_api.meeting_service,
            "get_meeting_by_id",
            AsyncMock(return_value=meeting),
        ), patch.object(
            meetings_api.meeting_board_service.board_repo,
            "get_or_create",
            get_or_create,
        ), patch.object(
            meetings_api.meeting_board_service.board_repo,
            "update",
            update,
        ):
            response = await meetings_api.update_meeting_board_settings(
                meeting_id=meeting_id,
                data=MeetingBoardSettingsUpdate(focus_label_ids=focus_label_ids),
                member=member,
                session=session,
            )

        update.assert_awaited_once_with(
            session,
            existing_settings,
            member=member,
            focus_label_ids=focus_label_ids,
        )
        session.commit.assert_awaited_once()
        self.assertEqual(response.focus_label_ids, focus_label_ids)
