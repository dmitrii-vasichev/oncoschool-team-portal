import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.api import meetings as meetings_api


class MeetingUpdatePermissionsTests(unittest.IsolatedAsyncioTestCase):
    async def test_member_creator_can_update_title_only(self) -> None:
        creator_id = uuid.uuid4()
        meeting_id = uuid.uuid4()
        meeting = SimpleNamespace(
            id=meeting_id,
            created_by_id=creator_id,
            zoom_meeting_id=None,
        )
        updated = SimpleNamespace(id=meeting_id)
        session = SimpleNamespace(commit=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(zoom_service=None))
        )
        member = SimpleNamespace(id=creator_id, role="member")

        with patch.object(
            meetings_api.meeting_service,
            "get_meeting_by_id",
            AsyncMock(side_effect=[meeting, updated]),
        ) as get_by_id_mock, patch.object(
            meetings_api.meeting_service,
            "update_meeting",
            AsyncMock(return_value=updated),
        ) as update_mock, patch.object(
            meetings_api,
            "_meeting_response",
            lambda payload: payload,
        ):
            response = await meetings_api.update_meeting(
                meeting_id=meeting_id,
                data=meetings_api.MeetingUpdate(title="  Новое название  "),
                request=request,
                member=member,
                session=session,
            )

        self.assertIs(response, updated)
        update_mock.assert_awaited_once_with(
            session, meeting_id, title="Новое название"
        )
        session.commit.assert_awaited_once()
        self.assertEqual(get_by_id_mock.await_count, 2)

    async def test_member_creator_cannot_update_non_title_fields(self) -> None:
        creator_id = uuid.uuid4()
        meeting_id = uuid.uuid4()
        meeting = SimpleNamespace(
            id=meeting_id,
            created_by_id=creator_id,
            zoom_meeting_id=None,
        )
        session = SimpleNamespace(commit=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(zoom_service=None))
        )
        member = SimpleNamespace(id=creator_id, role="member")

        with patch.object(
            meetings_api.meeting_service,
            "get_meeting_by_id",
            AsyncMock(return_value=meeting),
        ), patch.object(
            meetings_api.meeting_service,
            "update_meeting",
            AsyncMock(),
        ) as update_mock:
            with self.assertRaises(HTTPException) as ctx:
                await meetings_api.update_meeting(
                    meeting_id=meeting_id,
                    data=meetings_api.MeetingUpdate(notes="Поправить протокол"),
                    request=request,
                    member=member,
                    session=session,
                )

        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("только заголовок", str(ctx.exception.detail))
        update_mock.assert_not_awaited()
        session.commit.assert_not_awaited()

    async def test_member_non_creator_cannot_update_title(self) -> None:
        creator_id = uuid.uuid4()
        member_id = uuid.uuid4()
        meeting_id = uuid.uuid4()
        meeting = SimpleNamespace(
            id=meeting_id,
            created_by_id=creator_id,
            zoom_meeting_id=None,
        )
        session = SimpleNamespace(commit=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(zoom_service=None))
        )
        member = SimpleNamespace(id=member_id, role="member")

        with patch.object(
            meetings_api.meeting_service,
            "get_meeting_by_id",
            AsyncMock(return_value=meeting),
        ), patch.object(
            meetings_api.meeting_service,
            "update_meeting",
            AsyncMock(),
        ) as update_mock:
            with self.assertRaises(HTTPException) as ctx:
                await meetings_api.update_meeting(
                    meeting_id=meeting_id,
                    data=meetings_api.MeetingUpdate(title="Новый заголовок"),
                    request=request,
                    member=member,
                    session=session,
                )

        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("Нет прав", str(ctx.exception.detail))
        update_mock.assert_not_awaited()
        session.commit.assert_not_awaited()

    async def test_moderator_can_update_other_fields(self) -> None:
        creator_id = uuid.uuid4()
        moderator_id = uuid.uuid4()
        meeting_id = uuid.uuid4()
        meeting = SimpleNamespace(
            id=meeting_id,
            created_by_id=creator_id,
            zoom_meeting_id=None,
        )
        updated = SimpleNamespace(id=meeting_id)
        session = SimpleNamespace(commit=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(zoom_service=None))
        )
        moderator = SimpleNamespace(id=moderator_id, role="moderator")

        with patch.object(
            meetings_api.meeting_service,
            "get_meeting_by_id",
            AsyncMock(side_effect=[meeting, updated]),
        ), patch.object(
            meetings_api.meeting_service,
            "update_meeting",
            AsyncMock(return_value=updated),
        ) as update_mock, patch.object(
            meetings_api,
            "_meeting_response",
            lambda payload: payload,
        ):
            response = await meetings_api.update_meeting(
                meeting_id=meeting_id,
                data=meetings_api.MeetingUpdate(notes="Обновлённые заметки"),
                request=request,
                member=moderator,
                session=session,
            )

        self.assertIs(response, updated)
        update_mock.assert_awaited_once_with(
            session, meeting_id, notes="Обновлённые заметки"
        )
        session.commit.assert_awaited_once()
