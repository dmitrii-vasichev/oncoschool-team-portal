import os
import tempfile
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

from sqlalchemy.dialects import postgresql

from app.db.repositories import MeetingAIProcessingRepository
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
    async def test_claim_transcription_returns_none_when_already_transcribing(self) -> None:
        repo = MeetingAIProcessingRepository()
        repo.get_or_create = AsyncMock()
        result = SimpleNamespace(scalar_one_or_none=lambda: None)
        session = SimpleNamespace(execute=AsyncMock(return_value=result))

        claimed = await repo.claim_transcription(
            session,
            meeting_id=uuid.uuid4(),
            model="gpt-4o-mini-transcribe",
        )

        self.assertIsNone(claimed)
        repo.get_or_create.assert_awaited_once()
        stmt = session.execute.await_args.args[0]
        compiled = str(stmt.compile(dialect=postgresql.dialect()))
        self.assertIn("meeting_ai_processing.status != %(status_1)s", compiled)

    async def test_claim_publish_returns_none_when_already_published(self) -> None:
        repo = MeetingAIProcessingRepository()
        repo.get_or_create = AsyncMock()
        result = SimpleNamespace(scalar_one_or_none=lambda: None)
        session = SimpleNamespace(execute=AsyncMock(return_value=result))

        claimed = await repo.claim_publish(session, meeting_id=uuid.uuid4())

        self.assertIsNone(claimed)
        repo.get_or_create.assert_awaited_once()
        stmt = session.execute.await_args.args[0]
        compiled = str(stmt.compile(dialect=postgresql.dialect()))
        self.assertIn("meeting_ai_processing.status != %(status_1)s", compiled)
        self.assertEqual(stmt.compile().params["status"], "published")

    async def test_transcribe_audio_rejects_second_run_while_transcribing(self) -> None:
        service = MeetingAIOutcomesService()
        service.processing_repo = SimpleNamespace(
            claim_transcription=AsyncMock(return_value=None)
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
        service.processing_repo.claim_transcription.assert_awaited_once()

    async def test_transcribe_audio_commits_transcribing_before_external_io(self) -> None:
        service = MeetingAIOutcomesService()
        processing = SimpleNamespace(
            status="transcribing",
            transcript_source=None,
            transcript_char_count=None,
            audio_duration_seconds=None,
            estimated_cost_usd=None,
            transcription_model="gpt-4o-mini-transcribe",
        )
        service.processing_repo = SimpleNamespace(
            claim_transcription=AsyncMock(return_value=processing)
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
        service.processing_repo.claim_transcription.assert_awaited_once_with(
            session, meeting_id=meeting.id, model="gpt-4o-mini-transcribe"
        )
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
        processing = SimpleNamespace(status="transcribing")
        service.processing_repo = SimpleNamespace(
            claim_transcription=AsyncMock(return_value=processing)
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

    async def test_publish_creates_only_selected_task_candidates(self) -> None:
        service = MeetingAIOutcomesService()
        meeting = SimpleNamespace(id=uuid.uuid4(), parsed_summary=None, decisions=[], status="scheduled")
        moderator = SimpleNamespace(id=uuid.uuid4(), role="moderator")
        created = SimpleNamespace(id=uuid.uuid4())
        service.meeting_service = SimpleNamespace(
            create_tasks_from_parsed=AsyncMock(return_value=[created])
        )
        service.member_repo = SimpleNamespace(get_all_active=AsyncMock(return_value=[]))
        processing = SimpleNamespace(
            status="published",
            draft_summary="Summary",
            draft_decisions=["Decision"],
            draft_tasks=[],
            published_at=None,
            published_by_id=None,
        )
        service.processing_repo = SimpleNamespace(
            claim_publish=AsyncMock(return_value=processing)
        )
        session = SimpleNamespace(flush=AsyncMock())

        result = await service.publish_outcomes(
            session,
            meeting=meeting,
            processing=processing,
            moderator=moderator,
            draft_summary="Final summary",
            draft_decisions=["Decision"],
            draft_tasks=[
                {"title": "Selected", "priority": "normal", "selected": True},
                {"title": "Rejected", "priority": "normal", "selected": False},
            ],
        )

        assert result == [created]
        assert meeting.parsed_summary == "Final summary"
        assert meeting.decisions == ["Decision"]
        assert meeting.status == "completed"
        assert processing.status == "published"
        assert processing.draft_summary == "Final summary"
        assert processing.draft_decisions == ["Decision"]
        assert processing.draft_tasks == [
            {"title": "Selected", "priority": "normal", "selected": True},
            {"title": "Rejected", "priority": "normal", "selected": False},
        ]
        assert processing.published_at is not None
        assert processing.published_by_id == moderator.id
        session.flush.assert_awaited_once()
        service.processing_repo.claim_publish.assert_awaited_once_with(
            session, meeting_id=meeting.id
        )
        service.meeting_service.create_tasks_from_parsed.assert_awaited_once()
        args = service.meeting_service.create_tasks_from_parsed.await_args.args
        assert args[2] == [{"title": "Selected", "priority": "normal", "selected": True}]

    async def test_publish_preserves_assignee_id_as_string_and_resolves_name(self) -> None:
        service = MeetingAIOutcomesService()
        meeting = SimpleNamespace(
            id=uuid.uuid4(),
            parsed_summary=None,
            decisions=[],
            status="scheduled",
        )
        moderator = SimpleNamespace(id=uuid.uuid4(), role="moderator")
        assignee_id = uuid.uuid4()
        assignee = SimpleNamespace(id=assignee_id, full_name="Мария Иванова")
        service.meeting_service = SimpleNamespace(
            create_tasks_from_parsed=AsyncMock(return_value=[])
        )
        service.member_repo = SimpleNamespace(
            get_all_active=AsyncMock(return_value=[assignee])
        )
        processing = SimpleNamespace(
            status="published",
            draft_summary=None,
            draft_decisions=[],
            draft_tasks=[],
            published_at=None,
            published_by_id=None,
        )
        service.processing_repo = SimpleNamespace(
            claim_publish=AsyncMock(return_value=processing)
        )
        session = SimpleNamespace(flush=AsyncMock())
        draft_task = MeetingBoardTaskDraft(
            title="Prepare agenda",
            priority="normal",
            selected=True,
            assignee_id=assignee_id,
        )

        await service.publish_outcomes(
            session,
            meeting=meeting,
            processing=processing,
            moderator=moderator,
            draft_summary="Final summary",
            draft_decisions=[],
            draft_tasks=[draft_task],
        )

        assert processing.draft_tasks[0]["assignee_id"] == str(assignee_id)
        service.meeting_service.create_tasks_from_parsed.assert_awaited_once()
        selected_tasks = service.meeting_service.create_tasks_from_parsed.await_args.args[
            2
        ]
        assert selected_tasks[0]["assignee_name"] == "Мария Иванова"

    async def test_publish_rejects_already_published_without_creating_tasks(self) -> None:
        service = MeetingAIOutcomesService()
        service.processing_repo = SimpleNamespace(
            claim_publish=AsyncMock(return_value=None)
        )
        service.meeting_service = SimpleNamespace(
            create_tasks_from_parsed=AsyncMock(return_value=[])
        )
        service.member_repo = SimpleNamespace(get_all_active=AsyncMock(return_value=[]))
        session = SimpleNamespace(flush=AsyncMock())
        processing = SimpleNamespace(status="published")

        with self.assertRaisesRegex(ValueError, "Итоги встречи уже опубликованы"):
            await service.publish_outcomes(
                session,
                meeting=SimpleNamespace(id=uuid.uuid4()),
                processing=processing,
                moderator=SimpleNamespace(id=uuid.uuid4()),
                draft_summary="Final summary",
                draft_decisions=[],
                draft_tasks=[{"title": "Selected", "selected": True}],
            )

        service.processing_repo.claim_publish.assert_awaited_once()
        service.member_repo.get_all_active.assert_not_awaited()
        service.meeting_service.create_tasks_from_parsed.assert_not_awaited()
        session.flush.assert_not_awaited()

    async def test_publish_uses_claimed_processing_for_publish_fields(self) -> None:
        service = MeetingAIOutcomesService()
        meeting = SimpleNamespace(
            id=uuid.uuid4(),
            parsed_summary=None,
            decisions=[],
            status="scheduled",
        )
        endpoint_processing = SimpleNamespace(status="draft_ready", draft_summary=None)
        claimed_processing = SimpleNamespace(
            status="published",
            draft_summary=None,
            draft_decisions=[],
            draft_tasks=[],
            published_at=None,
            published_by_id=None,
        )
        service.processing_repo = SimpleNamespace(
            claim_publish=AsyncMock(return_value=claimed_processing)
        )
        service.member_repo = SimpleNamespace(get_all_active=AsyncMock(return_value=[]))
        service.meeting_service = SimpleNamespace(
            create_tasks_from_parsed=AsyncMock(return_value=[])
        )
        session = SimpleNamespace(flush=AsyncMock())
        moderator = SimpleNamespace(id=uuid.uuid4())

        await service.publish_outcomes(
            session,
            meeting=meeting,
            processing=endpoint_processing,
            moderator=moderator,
            draft_summary="Final summary",
            draft_decisions=["Decision"],
            draft_tasks=[],
        )

        service.processing_repo.claim_publish.assert_awaited_once_with(
            session, meeting_id=meeting.id
        )
        service.meeting_service.create_tasks_from_parsed.assert_awaited_once()
        assert claimed_processing.draft_summary == "Final summary"
        assert claimed_processing.draft_decisions == ["Decision"]
        assert claimed_processing.published_by_id == moderator.id
        assert endpoint_processing.draft_summary is None

    async def test_publish_claim_none_does_not_create_tasks(self) -> None:
        service = MeetingAIOutcomesService()
        service.processing_repo = SimpleNamespace(
            claim_publish=AsyncMock(return_value=None)
        )
        service.member_repo = SimpleNamespace(get_all_active=AsyncMock(return_value=[]))
        service.meeting_service = SimpleNamespace(
            create_tasks_from_parsed=AsyncMock(return_value=[])
        )
        session = SimpleNamespace(flush=AsyncMock())

        with self.assertRaisesRegex(ValueError, "Итоги встречи уже опубликованы"):
            await service.publish_outcomes(
                session,
                meeting=SimpleNamespace(id=uuid.uuid4()),
                processing=SimpleNamespace(status="draft_ready"),
                moderator=SimpleNamespace(id=uuid.uuid4()),
                draft_summary="Final summary",
                draft_decisions=[],
                draft_tasks=[],
            )

        service.member_repo.get_all_active.assert_not_awaited()
        service.meeting_service.create_tasks_from_parsed.assert_not_awaited()
        session.flush.assert_not_awaited()

    async def test_generate_draft_rejects_already_published(self) -> None:
        service = MeetingAIOutcomesService()
        processing = SimpleNamespace(status="published")
        service.processing_repo = SimpleNamespace(
            get_or_create=AsyncMock(return_value=processing)
        )
        service.member_repo = SimpleNamespace(get_all_active=AsyncMock(return_value=[]))
        service.ai_service = SimpleNamespace(parse_meeting_outcomes=AsyncMock())
        session = SimpleNamespace(flush=AsyncMock(), commit=AsyncMock())

        with self.assertRaisesRegex(ValueError, "Итоги встречи уже опубликованы"):
            await service.generate_draft(
                session,
                meeting=SimpleNamespace(id=uuid.uuid4(), transcript="Transcript"),
            )

        service.member_repo.get_all_active.assert_not_awaited()
        service.ai_service.parse_meeting_outcomes.assert_not_awaited()
        session.flush.assert_not_awaited()
        session.commit.assert_not_awaited()

    async def test_generate_draft_failure_marks_processing_failed_and_commits(self) -> None:
        service = MeetingAIOutcomesService()
        processing = SimpleNamespace(status="pending", error_message=None)
        service.processing_repo = SimpleNamespace(
            get_or_create=AsyncMock(return_value=processing)
        )
        service.member_repo = SimpleNamespace(get_all_active=AsyncMock(return_value=[]))
        service.ai_service = SimpleNamespace(
            parse_meeting_outcomes=AsyncMock(side_effect=RuntimeError("openai down"))
        )
        session = SimpleNamespace(flush=AsyncMock(), commit=AsyncMock())

        with self.assertRaisesRegex(RuntimeError, "openai down"):
            await service.generate_draft(
                session,
                meeting=SimpleNamespace(id=uuid.uuid4(), transcript="Transcript"),
            )

        assert processing.status == "failed"
        assert processing.error_message == "openai down"
        session.flush.assert_awaited_once()
        session.commit.assert_awaited_once()


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
