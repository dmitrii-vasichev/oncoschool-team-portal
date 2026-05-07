import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.api import meetings as meetings_api


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
        session = SimpleNamespace(commit=AsyncMock())
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
        session.commit.assert_awaited_once()
