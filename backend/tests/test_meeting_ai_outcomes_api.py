import unittest
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.api import meetings as meetings_api
from app.db.schemas import MeetingAIPublishRequest, MeetingBoardTaskDraft


class MeetingAIOutcomesApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_transcribe_audio_requires_moderator_dependency_contract(self) -> None:
        meeting_id = uuid.uuid4()
        member = SimpleNamespace(id=uuid.uuid4(), role="moderator")
        meeting = SimpleNamespace(id=meeting_id, zoom_meeting_id="123")
        processing = SimpleNamespace(
            id=uuid.uuid4(),
            meeting_id=meeting_id,
            status="transcript_ready",
            transcript_source="openai_audio",
            transcription_model="gpt-4o-mini-transcribe",
            started_at=None,
            completed_at=None,
            error_message=None,
            transcript_char_count=50,
            audio_duration_seconds=None,
            estimated_cost_usd=None,
            draft_summary=None,
            draft_decisions=[],
            draft_tasks=[],
            published_at=None,
            published_by_id=None,
        )
        session = SimpleNamespace(commit=AsyncMock(), rollback=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(zoom_service=SimpleNamespace()))
        )

        with (
            patch.object(
                meetings_api.meeting_service,
                "get_meeting_by_id",
                AsyncMock(return_value=meeting),
            ),
            patch.object(
                meetings_api.meeting_ai_outcomes_service,
                "transcribe_meeting_audio",
                AsyncMock(return_value=processing),
            ),
        ):
            response = await meetings_api.transcribe_meeting_audio(
                meeting_id=meeting_id,
                request=request,
                member=member,
                session=session,
            )

        self.assertEqual(response.status, "transcript_ready")
        session.commit.assert_not_awaited()
        session.rollback.assert_not_awaited()

    async def test_transcribe_audio_value_error_returns_422_without_endpoint_commit(
        self,
    ) -> None:
        meeting_id = uuid.uuid4()
        member = SimpleNamespace(id=uuid.uuid4(), role="moderator")
        meeting = SimpleNamespace(id=meeting_id, zoom_meeting_id="123")
        session = SimpleNamespace(commit=AsyncMock(), rollback=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(zoom_service=SimpleNamespace()))
        )

        with (
            patch.object(
                meetings_api.meeting_service,
                "get_meeting_by_id",
                AsyncMock(return_value=meeting),
            ),
            patch.object(
                meetings_api.meeting_ai_outcomes_service,
                "transcribe_meeting_audio",
                AsyncMock(side_effect=ValueError("Транскрибация уже выполняется")),
            ),
        ):
            with self.assertRaises(meetings_api.HTTPException) as exc:
                await meetings_api.transcribe_meeting_audio(
                    meeting_id=meeting_id,
                    request=request,
                    member=member,
                    session=session,
                )

        self.assertEqual(exc.exception.status_code, 422)
        self.assertEqual(exc.exception.detail, "Транскрибация уже выполняется")
        session.commit.assert_not_awaited()
        session.rollback.assert_not_awaited()

    async def test_transcribe_audio_unexpected_error_rolls_back_and_returns_502(
        self,
    ) -> None:
        meeting_id = uuid.uuid4()
        member = SimpleNamespace(id=uuid.uuid4(), role="moderator")
        meeting = SimpleNamespace(id=meeting_id, zoom_meeting_id="123")
        session = SimpleNamespace(commit=AsyncMock(), rollback=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(zoom_service=SimpleNamespace()))
        )

        with (
            patch.object(
                meetings_api.meeting_service,
                "get_meeting_by_id",
                AsyncMock(return_value=meeting),
            ),
            patch.object(
                meetings_api.meeting_ai_outcomes_service,
                "transcribe_meeting_audio",
                AsyncMock(side_effect=RuntimeError("openai down")),
            ),
        ):
            with self.assertRaises(meetings_api.HTTPException) as exc:
                await meetings_api.transcribe_meeting_audio(
                    meeting_id=meeting_id,
                    request=request,
                    member=member,
                    session=session,
                )

        self.assertEqual(exc.exception.status_code, 502)
        self.assertIn("openai down", exc.exception.detail)
        session.commit.assert_not_awaited()
        session.rollback.assert_awaited_once()

    async def test_generate_draft_value_error_returns_422_without_commit(self) -> None:
        meeting_id = uuid.uuid4()
        member = SimpleNamespace(id=uuid.uuid4(), role="moderator")
        meeting = SimpleNamespace(id=meeting_id, transcript=None)
        session = SimpleNamespace(commit=AsyncMock())

        with (
            patch.object(
                meetings_api.meeting_service,
                "get_meeting_by_id",
                AsyncMock(return_value=meeting),
            ),
            patch.object(
                meetings_api.meeting_ai_outcomes_service,
                "generate_draft",
                AsyncMock(side_effect=ValueError("Нет транскрипции для генерации итогов")),
            ),
        ):
            with self.assertRaises(meetings_api.HTTPException) as exc:
                await meetings_api.generate_meeting_outcome_draft(
                    meeting_id=meeting_id,
                    member=member,
                    session=session,
                )

        self.assertEqual(exc.exception.status_code, 422)
        self.assertEqual(exc.exception.detail, "Нет транскрипции для генерации итогов")
        session.commit.assert_not_awaited()

    async def test_publish_endpoint_commits_once_and_returns_tasks_created(self) -> None:
        meeting_id = uuid.uuid4()
        member = SimpleNamespace(id=uuid.uuid4(), role="moderator")
        meeting = SimpleNamespace(
            id=meeting_id,
            title="Weekly",
            raw_summary=None,
            parsed_summary="Final summary",
            decisions=["Decision"],
            notes=None,
            meeting_date=datetime(2026, 5, 6, tzinfo=timezone.utc),
            created_by_id=member.id,
            created_at=datetime(2026, 5, 6, tzinfo=timezone.utc),
            schedule_id=None,
            zoom_meeting_id=None,
            zoom_join_url=None,
            zoom_recording_url=None,
            transcript="Transcript",
            transcript_source="openai_audio",
            status="completed",
            duration_minutes=60,
            participants=[],
            schedule=None,
        )
        processing = SimpleNamespace(id=uuid.uuid4(), meeting_id=meeting_id, status="draft_ready")
        created_tasks = [SimpleNamespace(id=uuid.uuid4()), SimpleNamespace(id=uuid.uuid4())]
        session = SimpleNamespace(commit=AsyncMock())
        data = MeetingAIPublishRequest(
            draft_summary="Final summary",
            draft_decisions=["Decision"],
            draft_tasks=[
                MeetingBoardTaskDraft(
                    title="Selected",
                    priority="normal",
                    selected=True,
                )
            ],
        )

        get_meeting = AsyncMock(return_value=meeting)
        get_or_create = AsyncMock(return_value=processing)
        publish_outcomes = AsyncMock(return_value=created_tasks)

        with (
            patch.object(meetings_api.meeting_service, "get_meeting_by_id", get_meeting),
            patch.object(
                meetings_api.meeting_ai_outcomes_service.processing_repo,
                "get_or_create",
                get_or_create,
            ),
            patch.object(
                meetings_api.meeting_ai_outcomes_service,
                "publish_outcomes",
                publish_outcomes,
            ),
        ):
            response = await meetings_api.publish_meeting_outcomes(
                meeting_id=meeting_id,
                data=data,
                member=member,
                session=session,
            )

        get_or_create.assert_awaited_once_with(session, meeting_id)
        publish_outcomes.assert_awaited_once()
        session.commit.assert_awaited_once()
        self.assertEqual(get_meeting.await_count, 2)
        self.assertEqual(response.tasks_created, 2)
        self.assertEqual(response.meeting.id, meeting_id)
