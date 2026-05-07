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
from app.services.zoom_service import AUDIO_TRANSCRIPTION_MAX_BYTES, ZoomService


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
    async def test_transcribe_audio_rejects_second_run_while_transcribing(self) -> None:
        service = MeetingAIOutcomesService()
        processing = SimpleNamespace(status="transcribing")
        service.processing_repo = SimpleNamespace(
            get_or_create=AsyncMock(return_value=processing)
        )
        session = SimpleNamespace(flush=AsyncMock(), commit=AsyncMock())
        zoom_service = SimpleNamespace(download_audio_recording=AsyncMock())

        with self.assertRaisesRegex(ValueError, "Транскрибация уже выполняется"):
            await service.transcribe_meeting_audio(
                session,
                meeting=SimpleNamespace(id=uuid.uuid4(), zoom_meeting_id="123"),
                zoom_service=zoom_service,
                moderator=SimpleNamespace(id=uuid.uuid4()),
            )

        zoom_service.download_audio_recording.assert_not_awaited()
        session.flush.assert_not_awaited()
        session.commit.assert_not_awaited()

    async def test_transcribe_audio_commits_transcribing_before_external_io(self) -> None:
        service = MeetingAIOutcomesService()
        processing = SimpleNamespace(
            status="idle",
            transcript_source="zoom_api",
            transcript_char_count=10,
            audio_duration_seconds=30,
            estimated_cost_usd=1,
        )
        service.processing_repo = SimpleNamespace(
            get_or_create=AsyncMock(return_value=processing)
        )
        fd, path = tempfile.mkstemp(suffix=".m4a")
        os.close(fd)
        with open(path, "wb") as fh:
            fh.write(b"audio")

        async def download_audio_recording(_meeting_id):
            self.assertEqual(session.commit.await_count, 1)
            return path

        session = SimpleNamespace(flush=AsyncMock(), commit=AsyncMock())
        zoom_service = SimpleNamespace(
            download_audio_recording=AsyncMock(side_effect=download_audio_recording)
        )
        service.voice_service = SimpleNamespace(
            transcribe_file=AsyncMock(return_value="готовый текст")
        )
        meeting = SimpleNamespace(
            id=uuid.uuid4(),
            zoom_meeting_id="123",
            transcript=None,
            transcript_source=None,
        )

        result = await service.transcribe_meeting_audio(
            session,
            meeting=meeting,
            zoom_service=zoom_service,
            moderator=SimpleNamespace(id=uuid.uuid4()),
        )

        self.assertIs(result, processing)
        self.assertEqual(processing.status, "transcript_ready")
        self.assertEqual(processing.transcript_source, "openai_audio")
        self.assertEqual(processing.transcript_char_count, len("готовый текст"))
        self.assertIsNone(processing.audio_duration_seconds)
        self.assertIsNone(processing.estimated_cost_usd)
        self.assertEqual(meeting.transcript, "готовый текст")
        self.assertEqual(meeting.transcript_source, "openai_audio")
        self.assertEqual(session.commit.await_count, 2)

    async def test_transcribe_audio_failure_marks_failed_and_commits(self) -> None:
        service = MeetingAIOutcomesService()
        processing = SimpleNamespace(status="idle")
        service.processing_repo = SimpleNamespace(
            get_or_create=AsyncMock(return_value=processing)
        )
        session = SimpleNamespace(flush=AsyncMock(), commit=AsyncMock())
        zoom_service = SimpleNamespace(
            download_audio_recording=AsyncMock(side_effect=RuntimeError("zoom down"))
        )

        with self.assertRaisesRegex(RuntimeError, "zoom down"):
            await service.transcribe_meeting_audio(
                session,
                meeting=SimpleNamespace(id=uuid.uuid4(), zoom_meeting_id="123"),
                zoom_service=zoom_service,
                moderator=SimpleNamespace(id=uuid.uuid4()),
            )

        self.assertEqual(processing.status, "failed")
        self.assertEqual(processing.error_message, "zoom down")
        self.assertIsNotNone(processing.completed_at)
        self.assertEqual(session.commit.await_count, 2)

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


class ZoomAudioRecordingDownloadTests(unittest.IsolatedAsyncioTestCase):
    async def test_select_audio_recording_file_prefers_m4a_over_mp4(self) -> None:
        service = ZoomService("account", "client", "secret")

        selected = service._select_audio_recording_file(
            {
                "recording_files": [
                    {"file_type": "MP4", "download_url": "https://example.test/video"},
                    {"file_type": "M4A", "download_url": "https://example.test/audio"},
                ]
            }
        )

        self.assertEqual(selected["file_type"], "M4A")
        self.assertEqual(selected["download_url"], "https://example.test/audio")

    async def test_download_audio_recording_rejects_oversized_metadata_before_download_token(
        self,
    ) -> None:
        service = ZoomService("account", "client", "secret")
        service.get_recordings = AsyncMock(
            return_value={
                "recording_files": [
                    {
                        "file_type": "M4A",
                        "download_url": "https://example.test/audio",
                        "file_size": AUDIO_TRANSCRIPTION_MAX_BYTES + 1,
                    }
                ]
            }
        )
        service._get_token = AsyncMock(return_value="token")

        with self.assertRaisesRegex(ValueError, "Аудиофайл больше 25 МБ"):
            await service.download_audio_recording("123")

        service._get_token.assert_not_awaited()
