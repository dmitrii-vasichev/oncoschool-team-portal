import os
import tempfile
import unittest
import uuid
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from sqlalchemy.dialects import postgresql

from app.db.repositories import MeetingAIProcessingRepository
from app.db.schemas import (
    MeetingAIProcessingResponse,
    MeetingBoardSettingsResponse,
    MeetingBoardTaskDraft,
)
from app.services.ai_service import ParsedMeeting, ParsedTask
from app.services.audio_preparation_service import AudioPreparationService, PreparedAudioChunks
from app.services.meeting_ai_outcomes_service import MeetingAIOutcomesService
from app.services.meeting_transcription_scheduler_service import (
    MeetingTranscriptionSchedulerService,
)
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


def test_ai_processing_response_supports_queued_transcription_progress() -> None:
    requester_id = uuid.uuid4()
    response = MeetingAIProcessingResponse(
        id=uuid.uuid4(),
        meeting_id=uuid.uuid4(),
        status="queued",
        transcript_source=None,
        transcription_model="gpt-4o-mini-transcribe",
        started_at=None,
        completed_at=None,
        error_message=None,
        transcript_char_count=None,
        audio_duration_seconds=None,
        estimated_cost_usd=None,
        draft_summary=None,
        draft_decisions=[],
        draft_tasks=[],
        published_at=None,
        published_by_id=None,
        transcription_requested_by_id=requester_id,
        transcription_phase="queued",
        transcription_progress_percent=0,
        transcription_current_chunk=0,
        transcription_total_chunks=0,
        transcription_source_bytes=None,
        transcription_prepared_bytes=None,
        transcription_attempt_count=0,
        transcription_last_heartbeat_at=None,
    )

    assert response.status == "queued"
    assert response.transcription_requested_by_id == requester_id
    assert response.transcription_phase == "queued"
    assert response.transcription_progress_percent == 0


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

    async def test_queue_transcription_rejects_existing_active_job(self) -> None:
        repo = MeetingAIProcessingRepository()
        repo.get_or_create = AsyncMock()
        result = SimpleNamespace(scalar_one_or_none=lambda: None)
        session = SimpleNamespace(execute=AsyncMock(return_value=result))
        meeting_id = uuid.uuid4()
        requester_id = uuid.uuid4()

        queued = await repo.queue_transcription(
            session,
            meeting_id=meeting_id,
            model="gpt-4o-mini-transcribe",
            requested_by_id=requester_id,
        )

        self.assertIsNone(queued)
        repo.get_or_create.assert_awaited_once_with(session, meeting_id)
        stmt = session.execute.await_args.args[0]
        compiled = str(stmt.compile(dialect=postgresql.dialect()))
        self.assertIn("meeting_ai_processing.status NOT IN", compiled)
        params = stmt.compile().params
        self.assertEqual(params["status"], "queued")
        self.assertEqual(params["transcription_phase"], "queued")
        self.assertEqual(params["transcription_requested_by_id"], requester_id)

    async def test_get_next_transcription_job_retries_active_job_without_heartbeat(
        self,
    ) -> None:
        repo = MeetingAIProcessingRepository()
        result = SimpleNamespace(scalar_one_or_none=lambda: None)
        session = SimpleNamespace(execute=AsyncMock(return_value=result))

        await repo.get_next_transcription_job(
            session,
            stale_before=datetime(2026, 5, 8, 12, 0, 0),
            max_attempts=2,
        )

        stmt = session.execute.await_args.args[0]
        compiled = str(stmt.compile(dialect=postgresql.dialect()))
        self.assertIn(
            "meeting_ai_processing.transcription_last_heartbeat_at IS NULL",
            compiled,
        )

    async def test_mark_exhausted_stale_transcription_jobs_failed_uses_active_guard(
        self,
    ) -> None:
        repo = MeetingAIProcessingRepository()
        result = SimpleNamespace(rowcount=2)
        session = SimpleNamespace(execute=AsyncMock(return_value=result))

        count = await repo.mark_exhausted_stale_transcription_jobs_failed(
            session,
            stale_before=datetime(2026, 5, 8, 12, 0, 0),
            max_attempts=2,
        )

        self.assertEqual(count, 2)
        stmt = session.execute.await_args.args[0]
        compiled = str(stmt.compile(dialect=postgresql.dialect()))
        params = stmt.compile().params
        self.assertIn("meeting_ai_processing.status = %(status_1)s", compiled)
        self.assertIn(
            "meeting_ai_processing.transcription_attempt_count >= %(transcription_attempt_count_1)s",
            compiled,
        )
        self.assertIn(
            "meeting_ai_processing.transcription_last_heartbeat_at < %(transcription_last_heartbeat_at_1)s",
            compiled,
        )
        self.assertIn(
            "meeting_ai_processing.transcription_last_heartbeat_at IS NULL",
            compiled,
        )
        self.assertEqual(params["status"], "failed")
        self.assertEqual(params["transcription_phase"], "failed")
        self.assertIn("исчерпала лимит", params["error_message"])

    async def test_claim_publish_uses_draft_ready_guard(self) -> None:
        repo = MeetingAIProcessingRepository()
        repo.get_or_create = AsyncMock()
        result = SimpleNamespace(scalar_one_or_none=lambda: None)
        session = SimpleNamespace(execute=AsyncMock(return_value=result))

        claimed = await repo.claim_publish(session, meeting_id=uuid.uuid4())

        self.assertIsNone(claimed)
        repo.get_or_create.assert_awaited_once()
        stmt = session.execute.await_args.args[0]
        compiled = str(stmt.compile(dialect=postgresql.dialect()))
        self.assertIn("meeting_ai_processing.status = %(status_1)s", compiled)
        self.assertEqual(stmt.compile().params["status_1"], "draft_ready")
        self.assertEqual(stmt.compile().params["status"], "published")

    async def test_apply_draft_if_unpublished_uses_published_guard(self) -> None:
        repo = MeetingAIProcessingRepository()
        result = SimpleNamespace(scalar_one_or_none=lambda: None)
        session = SimpleNamespace(execute=AsyncMock(return_value=result))

        applied = await repo.apply_draft_if_unpublished(
            session,
            meeting_id=uuid.uuid4(),
            draft_summary="Summary",
            draft_decisions=["Decision"],
            draft_tasks=[],
        )

        self.assertIsNone(applied)
        stmt = session.execute.await_args.args[0]
        compiled = str(stmt.compile(dialect=postgresql.dialect()))
        self.assertIn("meeting_ai_processing.status != %(status_1)s", compiled)
        self.assertEqual(stmt.compile().params["status_1"], "published")

    async def test_mark_failed_if_unpublished_uses_published_guard(self) -> None:
        repo = MeetingAIProcessingRepository()
        result = SimpleNamespace(scalar_one_or_none=lambda: None)
        session = SimpleNamespace(execute=AsyncMock(return_value=result))

        marked = await repo.mark_failed_if_unpublished(
            session,
            meeting_id=uuid.uuid4(),
            error_message="openai down",
        )

        self.assertIsNone(marked)
        stmt = session.execute.await_args.args[0]
        compiled = str(stmt.compile(dialect=postgresql.dialect()))
        self.assertIn("meeting_ai_processing.status != %(status_1)s", compiled)
        self.assertEqual(stmt.compile().params["status_1"], "published")

    async def test_queue_transcribe_audio_rejects_second_active_run(self) -> None:
        service = MeetingAIOutcomesService()
        service.processing_repo = SimpleNamespace(
            queue_transcription=AsyncMock(return_value=None)
        )
        session = SimpleNamespace(flush=AsyncMock(), commit=AsyncMock())
        zoom_service = SimpleNamespace(download_audio_recording=AsyncMock())

        with self.assertRaisesRegex(ValueError, "Транскрибация уже выполняется"):
            await service.queue_meeting_audio_transcription(
                session,
                meeting=SimpleNamespace(id=uuid.uuid4(), zoom_meeting_id="123"),
                zoom_service=zoom_service,
                moderator=SimpleNamespace(id=uuid.uuid4()),
            )

        zoom_service.download_audio_recording.assert_not_awaited()
        session.flush.assert_not_awaited()
        session.commit.assert_not_awaited()
        service.processing_repo.queue_transcription.assert_awaited_once()

    async def test_queue_transcribe_audio_returns_queued_without_external_io(self) -> None:
        service = MeetingAIOutcomesService()
        processing = SimpleNamespace(
            status="queued",
            transcript_source=None,
            transcript_char_count=None,
            audio_duration_seconds=None,
            estimated_cost_usd=None,
            transcription_model="gpt-4o-mini-transcribe",
        )
        service.processing_repo = SimpleNamespace(
            queue_transcription=AsyncMock(return_value=processing)
        )
        session = SimpleNamespace(flush=AsyncMock(), commit=AsyncMock())
        zoom_service = SimpleNamespace(
            download_audio_recording=AsyncMock()
        )
        meeting = SimpleNamespace(
            id=uuid.uuid4(),
            zoom_meeting_id="123",
            transcript=None,
            transcript_source=None,
        )

        result = await service.queue_meeting_audio_transcription(
            session,
            meeting=meeting,
            zoom_service=zoom_service,
            moderator=SimpleNamespace(id=uuid.uuid4()),
        )

        self.assertIs(result, processing)
        service.processing_repo.queue_transcription.assert_awaited_once()
        self.assertEqual(result.status, "queued")
        zoom_service.download_audio_recording.assert_not_awaited()
        session.flush.assert_awaited_once()
        session.commit.assert_not_awaited()

    async def test_process_transcription_job_prepares_chunks_and_saves_transcript(self) -> None:
        service = MeetingAIOutcomesService()
        fd, source_path = tempfile.mkstemp(suffix=".m4a")
        os.close(fd)
        chunk_one = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
        chunk_one.write(b"one")
        chunk_one.close()
        chunk_two = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
        chunk_two.write(b"two")
        chunk_two.close()
        prepared = PreparedAudioChunks(
            source_path=source_path,
            chunk_dir=tempfile.mkdtemp(),
            chunk_paths=[chunk_one.name, chunk_two.name],
            duration_seconds=120,
            source_bytes=100,
            total_bytes=6,
        )
        meeting = SimpleNamespace(
            id=uuid.uuid4(),
            zoom_meeting_id="123",
            transcript=None,
            transcript_source=None,
        )
        processing = SimpleNamespace(
            meeting_id=meeting.id,
            meeting=meeting,
            transcription_model="gpt-4o-mini-transcribe",
            transcription_requested_by_id=uuid.uuid4(),
        )
        requester = SimpleNamespace(
            id=processing.transcription_requested_by_id,
            telegram_id=123456,
            full_name="Moderator",
        )
        completed_processing = SimpleNamespace(status="transcript_ready")
        service.processing_repo = SimpleNamespace(
            update_transcription_progress=AsyncMock(),
            mark_transcription_complete=AsyncMock(return_value=completed_processing),
        )
        service.member_repo = SimpleNamespace(get_by_id=AsyncMock(return_value=requester))
        service.in_app_notifications = SimpleNamespace(
            notify_meeting_transcription_completed=AsyncMock(),
            notify_meeting_transcription_failed=AsyncMock(),
        )
        service.audio_preparation_service = SimpleNamespace(
            prepare_chunks=AsyncMock(return_value=prepared),
            cleanup=AsyncMock(),
        )
        service.voice_service = SimpleNamespace(
            transcribe_file=AsyncMock(side_effect=["текст 1", "текст 2"])
        )
        zoom_service = SimpleNamespace(
            download_audio_recording=AsyncMock(return_value=source_path)
        )
        bot = SimpleNamespace(send_message=AsyncMock())
        session = SimpleNamespace(flush=AsyncMock(), commit=AsyncMock())

        result = await service.process_transcription_job(
            session,
            processing=processing,
            zoom_service=zoom_service,
            bot=bot,
            frontend_url="https://portal.example",
        )

        self.assertIs(result, completed_processing)
        self.assertEqual(meeting.transcript, "текст 1\n\nтекст 2")
        self.assertEqual(meeting.transcript_source, "openai_audio")
        service.audio_preparation_service.cleanup.assert_awaited_once_with(prepared)
        service.processing_repo.mark_transcription_complete.assert_awaited_once_with(
            session,
            meeting_id=meeting.id,
            transcript_source="openai_audio",
            transcript_char_count=len("текст 1\n\nтекст 2"),
            audio_duration_seconds=120,
            estimated_cost_usd=None,
        )
        self.assertEqual(service.voice_service.transcribe_file.await_count, 2)
        service.in_app_notifications.notify_meeting_transcription_completed.assert_awaited_once_with(
            session,
            meeting=meeting,
            requester=requester,
        )
        bot.send_message.assert_awaited_once()
        self.assertIn(
            "https://portal.example/meetings/",
            bot.send_message.await_args.kwargs["text"],
        )
        self.assertGreaterEqual(session.commit.await_count, 2)

    async def test_process_transcription_job_failure_marks_failed_and_cleans_up(self) -> None:
        service = MeetingAIOutcomesService()
        meeting = SimpleNamespace(id=uuid.uuid4(), zoom_meeting_id="123")
        processing = SimpleNamespace(
            meeting_id=meeting.id,
            meeting=meeting,
            transcription_model="gpt-4o-mini-transcribe",
            transcription_requested_by_id=None,
        )
        service.processing_repo = SimpleNamespace(
            update_transcription_progress=AsyncMock(),
            mark_transcription_failed=AsyncMock(return_value=SimpleNamespace(status="failed")),
        )
        session = SimpleNamespace(flush=AsyncMock(), commit=AsyncMock())
        zoom_service = SimpleNamespace(
            download_audio_recording=AsyncMock(side_effect=RuntimeError("zoom down"))
        )
        service.audio_preparation_service = SimpleNamespace(cleanup=AsyncMock())

        with self.assertRaisesRegex(RuntimeError, "zoom down"):
            await service.process_transcription_job(
                session,
                processing=processing,
                zoom_service=zoom_service,
                bot=None,
                frontend_url="https://portal.example",
            )

        service.processing_repo.mark_transcription_failed.assert_awaited_once_with(
            session,
            meeting_id=meeting.id,
            error_message="zoom down",
        )
        service.audio_preparation_service.cleanup.assert_awaited_once_with(
            None, source_path=None
        )
        self.assertGreaterEqual(session.commit.await_count, 2)

    async def test_process_transcription_job_preflight_failure_marks_failed(self) -> None:
        service = MeetingAIOutcomesService()
        processing = SimpleNamespace(
            meeting_id=uuid.uuid4(),
            meeting=None,
            transcription_model="gpt-4o-mini-transcribe",
            transcription_requested_by_id=None,
        )
        service.processing_repo = SimpleNamespace(
            mark_transcription_failed=AsyncMock(return_value=SimpleNamespace(status="failed")),
        )
        service.audio_preparation_service = SimpleNamespace(cleanup=AsyncMock())
        session = SimpleNamespace(
            get=AsyncMock(return_value=None),
            flush=AsyncMock(),
            commit=AsyncMock(),
        )

        with self.assertRaisesRegex(ValueError, "Zoom-запись недоступна"):
            await service.process_transcription_job(
                session,
                processing=processing,
                zoom_service=SimpleNamespace(),
                bot=None,
                frontend_url="https://portal.example",
            )

        service.processing_repo.mark_transcription_failed.assert_awaited_once_with(
            session,
            meeting_id=processing.meeting_id,
            error_message="Zoom-запись недоступна",
        )
        service.audio_preparation_service.cleanup.assert_awaited_once_with(
            None, source_path=None
        )
        session.commit.assert_awaited_once()

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
            status="draft_ready",
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
            status="draft_ready",
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

        service.processing_repo.claim_publish.assert_not_awaited()
        service.member_repo.get_all_active.assert_not_awaited()
        service.meeting_service.create_tasks_from_parsed.assert_not_awaited()
        session.flush.assert_not_awaited()

    async def test_publish_rejects_transcript_ready_without_claim_or_tasks(self) -> None:
        service = MeetingAIOutcomesService()
        service.processing_repo = SimpleNamespace(
            claim_publish=AsyncMock(return_value=SimpleNamespace(status="published"))
        )
        service.meeting_service = SimpleNamespace(
            create_tasks_from_parsed=AsyncMock(return_value=[])
        )
        service.member_repo = SimpleNamespace(get_all_active=AsyncMock(return_value=[]))
        session = SimpleNamespace(flush=AsyncMock())
        processing = SimpleNamespace(status="transcript_ready")

        with self.assertRaisesRegex(ValueError, "Черновик итогов встречи ещё не готов"):
            await service.publish_outcomes(
                session,
                meeting=SimpleNamespace(id=uuid.uuid4()),
                processing=processing,
                moderator=SimpleNamespace(id=uuid.uuid4()),
                draft_summary="Arbitrary summary",
                draft_decisions=[],
                draft_tasks=[{"title": "Should not be created", "selected": True}],
            )

        service.processing_repo.claim_publish.assert_not_awaited()
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
        failed_processing = SimpleNamespace(status="failed", error_message="openai down")
        service.processing_repo = SimpleNamespace(
            get_or_create=AsyncMock(return_value=processing),
            mark_failed_if_unpublished=AsyncMock(return_value=failed_processing),
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

        service.processing_repo.mark_failed_if_unpublished.assert_awaited_once()
        assert processing.status == "pending"
        assert processing.error_message is None
        session.flush.assert_not_awaited()
        session.commit.assert_awaited_once()

    async def test_generate_draft_failure_does_not_overwrite_concurrently_published_outcome(
        self,
    ) -> None:
        service = MeetingAIOutcomesService()
        processing = SimpleNamespace(status="draft_ready", error_message=None)
        service.processing_repo = SimpleNamespace(
            get_or_create=AsyncMock(return_value=processing),
            mark_failed_if_unpublished=AsyncMock(return_value=None),
        )
        service.member_repo = SimpleNamespace(get_all_active=AsyncMock(return_value=[]))
        service.ai_service = SimpleNamespace(
            parse_meeting_outcomes=AsyncMock(side_effect=RuntimeError("openai down"))
        )
        session = SimpleNamespace(flush=AsyncMock(), commit=AsyncMock())
        meeting = SimpleNamespace(id=uuid.uuid4(), transcript="Transcript")

        with self.assertRaisesRegex(RuntimeError, "openai down"):
            await service.generate_draft(session, meeting=meeting)

        service.processing_repo.mark_failed_if_unpublished.assert_awaited_once_with(
            session,
            meeting_id=meeting.id,
            error_message="openai down",
        )
        assert processing.status == "draft_ready"
        assert processing.error_message is None
        session.commit.assert_awaited_once()

    async def test_generate_draft_rejects_concurrent_publish_after_ai_parse(self) -> None:
        service = MeetingAIOutcomesService()
        processing = SimpleNamespace(status="draft_ready", error_message=None)
        service.processing_repo = SimpleNamespace(
            get_or_create=AsyncMock(return_value=processing),
            apply_draft_if_unpublished=AsyncMock(return_value=None),
        )
        service.member_repo = SimpleNamespace(get_all_active=AsyncMock(return_value=[]))
        service.ai_service = SimpleNamespace(
            parse_meeting_outcomes=AsyncMock(
                return_value=ParsedMeeting(
                    title="Meeting",
                    summary="Summary",
                    decisions=["Decision"],
                    tasks=[
                        ParsedTask(
                            title="Follow up",
                            description="Send notes",
                            assignee_name="Иван",
                            priority="high",
                            deadline="2026-05-07",
                        )
                    ],
                )
            )
        )
        session = SimpleNamespace(flush=AsyncMock(), commit=AsyncMock())
        meeting = SimpleNamespace(id=uuid.uuid4(), transcript="Transcript")

        with self.assertRaisesRegex(ValueError, "Итоги встречи уже опубликованы"):
            await service.generate_draft(session, meeting=meeting)

        assert processing.status == "draft_ready"
        service.processing_repo.apply_draft_if_unpublished.assert_awaited_once_with(
            session,
            meeting_id=meeting.id,
            draft_summary="Summary",
            draft_decisions=["Decision"],
            draft_tasks=[
                {
                    "title": "Follow up",
                    "description": "Send notes",
                    "assignee_name": "Иван",
                    "assignee_id": None,
                    "deadline": "2026-05-07",
                    "priority": "urgent",
                    "selected": True,
                }
            ],
        )
        session.flush.assert_not_awaited()
        session.commit.assert_not_awaited()


class AudioPreparationServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_prepare_chunks_returns_sorted_paths_and_metadata(self) -> None:
        fd, source_path = tempfile.mkstemp(suffix=".m4a")
        os.close(fd)
        with open(source_path, "wb") as fh:
            fh.write(b"source-audio")

        async def fake_subprocess(*args, **_kwargs):
            if args[0] == "ffprobe":
                return SimpleNamespace(communicate=AsyncMock(return_value=(b"120.5\n", b"")))

            output_pattern = args[-1]
            chunk_dir = os.path.dirname(output_pattern)
            with open(os.path.join(chunk_dir, "chunk_001.mp3"), "wb") as fh:
                fh.write(b"second")
            with open(os.path.join(chunk_dir, "chunk_000.mp3"), "wb") as fh:
                fh.write(b"first")
            return SimpleNamespace(communicate=AsyncMock(return_value=(b"", b"")))

        service = AudioPreparationService()
        with patch(
            "app.services.audio_preparation_service.asyncio.create_subprocess_exec",
            AsyncMock(side_effect=fake_subprocess),
        ):
            prepared = await service.prepare_chunks(source_path)

        self.assertEqual([os.path.basename(path) for path in prepared.chunk_paths], [
            "chunk_000.mp3",
            "chunk_001.mp3",
        ])
        self.assertEqual(prepared.duration_seconds, 120)
        self.assertEqual(prepared.source_bytes, len(b"source-audio"))
        self.assertEqual(prepared.total_bytes, len(b"first") + len(b"second"))
        await service.cleanup(prepared)
        self.assertFalse(os.path.exists(source_path))
        self.assertFalse(os.path.exists(prepared.chunk_dir))

    async def test_prepare_chunks_rejects_oversized_chunks_after_retry(self) -> None:
        fd, source_path = tempfile.mkstemp(suffix=".m4a")
        os.close(fd)
        with open(source_path, "wb") as fh:
            fh.write(b"source-audio")

        async def fake_subprocess(*args, **_kwargs):
            if args[0] == "ffprobe":
                return SimpleNamespace(communicate=AsyncMock(return_value=(b"", b"")))

            output_pattern = args[-1]
            chunk_dir = os.path.dirname(output_pattern)
            with open(os.path.join(chunk_dir, "chunk_000.mp3"), "wb") as fh:
                fh.write(b"too-large")
            return SimpleNamespace(communicate=AsyncMock(return_value=(b"", b"")))

        service = AudioPreparationService()
        service.safe_chunk_bytes = 1
        with patch(
            "app.services.audio_preparation_service.asyncio.create_subprocess_exec",
            AsyncMock(side_effect=fake_subprocess),
        ):
            with self.assertRaisesRegex(ValueError, "фрагмент больше 25 МБ"):
                await service.prepare_chunks(source_path)

        await service.cleanup(None, source_path=source_path)

    async def test_cleanup_removes_source_and_chunk_directory(self) -> None:
        fd, source_path = tempfile.mkstemp(suffix=".m4a")
        os.close(fd)
        chunk_dir = tempfile.mkdtemp()
        chunk_path = os.path.join(chunk_dir, "chunk_000.mp3")
        with open(chunk_path, "wb") as fh:
            fh.write(b"chunk")

        prepared = PreparedAudioChunks(
            source_path=source_path,
            chunk_dir=chunk_dir,
            chunk_paths=[chunk_path],
            duration_seconds=None,
            source_bytes=0,
            total_bytes=5,
        )

        service = AudioPreparationService()
        await service.cleanup(prepared)

        self.assertFalse(os.path.exists(source_path))
        self.assertFalse(os.path.exists(chunk_dir))


class MeetingTranscriptionSchedulerServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_scheduler_claims_and_processes_one_due_job(self) -> None:
        session = SimpleNamespace(commit=AsyncMock())

        class FakeSessionMaker:
            def __call__(self):
                return self

            async def __aenter__(self):
                return session

            async def __aexit__(self, *_args):
                return False

        processing = SimpleNamespace(id=uuid.uuid4())
        zoom_service = SimpleNamespace()
        scheduler = MeetingTranscriptionSchedulerService(
            bot=SimpleNamespace(),
            session_maker=FakeSessionMaker(),
            zoom_service=zoom_service,
            frontend_url="https://portal.example",
        )
        scheduler.processing_repo = SimpleNamespace(
            mark_exhausted_stale_transcription_jobs_failed=AsyncMock(return_value=0),
            get_next_transcription_job=AsyncMock(return_value=processing)
        )
        scheduler.outcomes_service = SimpleNamespace(
            process_transcription_job=AsyncMock()
        )

        await scheduler._process_due_jobs()

        scheduler.processing_repo.get_next_transcription_job.assert_awaited_once()
        scheduler.processing_repo.mark_exhausted_stale_transcription_jobs_failed.assert_awaited_once()
        session.commit.assert_awaited_once()
        scheduler.outcomes_service.process_transcription_job.assert_awaited_once_with(
            session,
            processing=processing,
            zoom_service=zoom_service,
            bot=scheduler.bot,
            frontend_url="https://portal.example",
        )

    async def test_scheduler_marks_exhausted_stale_jobs_before_claiming_next(
        self,
    ) -> None:
        session = SimpleNamespace(commit=AsyncMock())

        class FakeSessionMaker:
            def __call__(self):
                return self

            async def __aenter__(self):
                return session

            async def __aexit__(self, *_args):
                return False

        scheduler = MeetingTranscriptionSchedulerService(
            bot=SimpleNamespace(),
            session_maker=FakeSessionMaker(),
            zoom_service=SimpleNamespace(),
            frontend_url="https://portal.example",
        )
        scheduler.processing_repo = SimpleNamespace(
            mark_exhausted_stale_transcription_jobs_failed=AsyncMock(return_value=1),
            get_next_transcription_job=AsyncMock(return_value=None),
        )
        scheduler.outcomes_service = SimpleNamespace(
            process_transcription_job=AsyncMock()
        )

        await scheduler._process_due_jobs()

        scheduler.processing_repo.mark_exhausted_stale_transcription_jobs_failed.assert_awaited_once()
        scheduler.processing_repo.get_next_transcription_job.assert_awaited_once()
        scheduler.outcomes_service.process_transcription_job.assert_not_awaited()
        self.assertEqual(session.commit.await_count, 1)


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

    async def test_download_audio_recording_allows_oversized_metadata_for_chunking(
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

        class FakeStreamResponse:
            headers = {"Content-Length": str(AUDIO_TRANSCRIPTION_MAX_BYTES + 1)}

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_args):
                return False

            def raise_for_status(self):
                return None

            async def aiter_bytes(self):
                yield b"audio"

        class FakeClient:
            def __init__(self, *_args, **_kwargs):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_args):
                return False

            def stream(self, *_args, **_kwargs):
                return FakeStreamResponse()

        with patch("app.services.zoom_service.httpx.AsyncClient", FakeClient):
            path = await service.download_audio_recording("123")

        service._get_token.assert_awaited_once()
        self.assertTrue(os.path.exists(path))
        os.unlink(path)
