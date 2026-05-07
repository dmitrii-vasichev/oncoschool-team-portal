import os
import tempfile
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.db.schemas import (
    MeetingAIProcessingResponse,
    MeetingBoardSettingsResponse,
    MeetingBoardTaskDraft,
)
from app.services.meeting_ai_outcomes_service import MeetingAIOutcomesService


def test_board_settings_response_defaults_are_empty() -> None:
    response = MeetingBoardSettingsResponse(
        id=uuid.uuid4(),
        meeting_id=uuid.uuid4(),
        added_member_ids=[],
        added_department_ids=[],
        pinned_task_ids=[],
        materials=[],
        board_notes=None,
        created_by_id=None,
        updated_by_id=None,
        created_at=None,
        updated_at=None,
    )

    assert response.added_member_ids == []
    assert response.materials == []


def test_ai_processing_response_supports_openai_audio_source() -> None:
    response = MeetingAIProcessingResponse(
        id=uuid.uuid4(),
        meeting_id=uuid.uuid4(),
        status="draft_ready",
        transcript_source="openai_audio",
        transcription_model="gpt-4o-mini-transcribe",
        started_at=None,
        completed_at=None,
        error_message=None,
        transcript_char_count=123,
        audio_duration_seconds=None,
        estimated_cost_usd=None,
        draft_summary="Summary",
        draft_decisions=["Decision"],
        draft_tasks=[
            MeetingBoardTaskDraft(
                title="Prepare deck",
                description=None,
                assignee_name=None,
                assignee_id=None,
                deadline=None,
                priority="normal",
                selected=True,
            )
        ],
        published_at=None,
        published_by_id=None,
    )

    assert response.transcript_source == "openai_audio"
    assert response.draft_tasks[0].selected is True


class MeetingAIOutcomesServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_transcribe_audio_deletes_temporary_file_on_failure(self) -> None:
        service = MeetingAIOutcomesService()
        fd, path = tempfile.mkstemp(suffix=".m4a")
        os.close(fd)
        with open(path, "wb") as fh:
            fh.write(b"audio")

        zoom_service = SimpleNamespace(
            download_audio_recording=AsyncMock(return_value=path)
        )
        voice_service = SimpleNamespace(
            transcribe_file=AsyncMock(side_effect=RuntimeError("openai down"))
        )

        with self.assertRaises(RuntimeError):
            await service._transcribe_temp_audio(
                zoom_service=zoom_service,
                voice_service=voice_service,
                zoom_meeting_id="123",
                model="gpt-4o-mini-transcribe",
            )

        self.assertFalse(os.path.exists(path))
