import logging
import os
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import Meeting, MeetingAIProcessing, TeamMember
from app.db.repositories import MeetingAIProcessingRepository, TeamMemberRepository
from app.services.ai_service import AIService
from app.services.audio_preparation_service import AudioPreparationService, PreparedAudioChunks
from app.services.in_app_notification_service import InAppNotificationService
from app.services.meeting_service import MeetingService
from app.services.task_urgency import normalize_task_urgency
from app.services.voice_service import DEFAULT_TRANSCRIPTION_MODEL, VoiceService

logger = logging.getLogger(__name__)


class MeetingAIOutcomesService:
    def __init__(self) -> None:
        self.processing_repo = MeetingAIProcessingRepository()
        self.voice_service = VoiceService()
        self.ai_service = AIService()
        self.meeting_service = MeetingService()
        self.member_repo = TeamMemberRepository()
        self.audio_preparation_service = AudioPreparationService()
        self.in_app_notifications = InAppNotificationService()

    async def _transcribe_temp_audio(
        self,
        *,
        zoom_service,
        voice_service,
        zoom_meeting_id: str,
        model: str,
    ) -> str:
        temp_path = await zoom_service.download_audio_recording(zoom_meeting_id)
        if not temp_path:
            raise ValueError("Аудиозапись встречи недоступна в Zoom")
        try:
            return await voice_service.transcribe_file(
                temp_path, model=model, language="ru"
            )
        finally:
            try:
                os.unlink(temp_path)
            except FileNotFoundError:
                pass

    async def queue_meeting_audio_transcription(
        self,
        session: AsyncSession,
        *,
        meeting: Meeting,
        zoom_service,
        moderator: TeamMember,
        model: str = DEFAULT_TRANSCRIPTION_MODEL,
    ) -> MeetingAIProcessing:
        if not meeting.zoom_meeting_id or not zoom_service:
            raise ValueError("Zoom-запись недоступна")

        processing = await self.processing_repo.queue_transcription(
            session,
            meeting_id=meeting.id,
            model=model,
            requested_by_id=moderator.id,
        )
        if not processing:
            raise ValueError("Транскрибация уже выполняется")

        await session.flush()
        return processing

    async def transcribe_meeting_audio(
        self,
        session: AsyncSession,
        *,
        meeting: Meeting,
        zoom_service,
        moderator: TeamMember,
        model: str = DEFAULT_TRANSCRIPTION_MODEL,
    ) -> MeetingAIProcessing:
        return await self.queue_meeting_audio_transcription(
            session,
            meeting=meeting,
            zoom_service=zoom_service,
            moderator=moderator,
            model=model,
        )

    async def process_transcription_job(
        self,
        session: AsyncSession,
        *,
        processing: MeetingAIProcessing,
        zoom_service,
        bot=None,
        frontend_url: str = settings.NEXT_PUBLIC_FRONTEND_URL,
    ) -> MeetingAIProcessing:
        meeting = await self._resolve_processing_meeting(session, processing)
        if not meeting or not meeting.zoom_meeting_id or not zoom_service:
            raise ValueError("Zoom-запись недоступна")

        source_path: str | None = None
        prepared: PreparedAudioChunks | None = None
        try:
            await self._set_transcription_progress(
                session, meeting.id, phase="downloading", progress_percent=5
            )
            source_path = await zoom_service.download_audio_recording(meeting.zoom_meeting_id)
            if not source_path:
                raise ValueError("Аудиозапись встречи недоступна в Zoom")

            await self._set_transcription_progress(
                session,
                meeting.id,
                phase="preparing_audio",
                progress_percent=15,
                source_bytes=os.path.getsize(source_path),
            )
            prepared = await self.audio_preparation_service.prepare_chunks(source_path)

            total_chunks = len(prepared.chunk_paths)
            await self._set_transcription_progress(
                session,
                meeting.id,
                phase="transcribing",
                progress_percent=20,
                current_chunk=0,
                total_chunks=total_chunks,
                source_bytes=prepared.source_bytes,
                prepared_bytes=prepared.total_bytes,
            )

            chunk_transcripts: list[str] = []
            model = processing.transcription_model or DEFAULT_TRANSCRIPTION_MODEL
            for index, chunk_path in enumerate(prepared.chunk_paths, start=1):
                await self._set_transcription_progress(
                    session,
                    meeting.id,
                    phase="transcribing",
                    progress_percent=self._chunk_progress(index - 1, total_chunks),
                    current_chunk=index,
                    total_chunks=total_chunks,
                    prepared_bytes=prepared.total_bytes,
                )
                chunk_text = await self.voice_service.transcribe_file(
                    chunk_path, model=model, language="ru"
                )
                if chunk_text and chunk_text.strip():
                    chunk_transcripts.append(chunk_text.strip())
                await self._set_transcription_progress(
                    session,
                    meeting.id,
                    phase="transcribing",
                    progress_percent=self._chunk_progress(index, total_chunks),
                    current_chunk=index,
                    total_chunks=total_chunks,
                    prepared_bytes=prepared.total_bytes,
                )

            transcript = "\n\n".join(chunk_transcripts).strip()
            if not transcript:
                raise ValueError("OpenAI не вернул текст транскрибации")

            await self._set_transcription_progress(
                session, meeting.id, phase="saving", progress_percent=95
            )
            meeting.transcript = transcript
            meeting.transcript_source = "openai_audio"
            completed_processing = await self.processing_repo.mark_transcription_complete(
                session,
                meeting_id=meeting.id,
                transcript_source="openai_audio",
                transcript_char_count=len(transcript),
                audio_duration_seconds=prepared.duration_seconds,
                estimated_cost_usd=None,
            )
            await session.commit()
            await self._notify_transcription_completed(
                session,
                meeting=meeting,
                processing=processing,
                bot=bot,
                frontend_url=frontend_url,
            )
            return completed_processing or processing
        except Exception as exc:
            await self.processing_repo.mark_transcription_failed(
                session,
                meeting_id=meeting.id,
                error_message=str(exc),
            )
            await session.commit()
            await self._notify_transcription_failed(
                session,
                meeting=meeting,
                processing=processing,
                error_message=str(exc),
                bot=bot,
                frontend_url=frontend_url,
            )
            raise
        finally:
            if prepared:
                await self.audio_preparation_service.cleanup(prepared)
            else:
                await self.audio_preparation_service.cleanup(None, source_path=source_path)

    async def _resolve_processing_meeting(
        self, session: AsyncSession, processing: MeetingAIProcessing
    ) -> Meeting | None:
        meeting = getattr(processing, "meeting", None)
        if meeting is not None:
            return meeting
        return await session.get(Meeting, processing.meeting_id)

    async def _set_transcription_progress(
        self,
        session: AsyncSession,
        meeting_id,
        *,
        phase: str,
        progress_percent: int,
        current_chunk: int | None = None,
        total_chunks: int | None = None,
        source_bytes: int | None = None,
        prepared_bytes: int | None = None,
    ) -> None:
        await self.processing_repo.update_transcription_progress(
            session,
            meeting_id=meeting_id,
            phase=phase,
            progress_percent=progress_percent,
            current_chunk=current_chunk,
            total_chunks=total_chunks,
            source_bytes=source_bytes,
            prepared_bytes=prepared_bytes,
        )
        await session.commit()

    @staticmethod
    def _chunk_progress(current_chunk: int, total_chunks: int) -> int:
        if total_chunks <= 0:
            return 20
        return min(90, 20 + int((current_chunk / total_chunks) * 70))

    async def _notify_transcription_completed(
        self,
        session: AsyncSession,
        *,
        meeting: Meeting,
        processing: MeetingAIProcessing,
        bot,
        frontend_url: str,
    ) -> None:
        requester = await self._get_transcription_requester(session, processing)
        if not requester:
            return
        try:
            await self.in_app_notifications.notify_meeting_transcription_completed(
                session,
                meeting=meeting,
                requester=requester,
            )
            await session.commit()
        except Exception:
            logger.warning(
                "Failed to create transcription completion notification",
                exc_info=True,
            )
        await self._send_transcription_telegram_message(
            bot,
            requester=requester,
            text=self._build_transcription_completed_text(
                meeting=meeting,
                frontend_url=frontend_url,
            ),
        )

    async def _notify_transcription_failed(
        self,
        session: AsyncSession,
        *,
        meeting: Meeting,
        processing: MeetingAIProcessing,
        error_message: str,
        bot,
        frontend_url: str,
    ) -> None:
        requester = await self._get_transcription_requester(session, processing)
        if not requester:
            return
        try:
            await self.in_app_notifications.notify_meeting_transcription_failed(
                session,
                meeting=meeting,
                requester=requester,
                error_message=error_message,
            )
            await session.commit()
        except Exception:
            logger.warning(
                "Failed to create transcription failure notification",
                exc_info=True,
            )
        await self._send_transcription_telegram_message(
            bot,
            requester=requester,
            text=self._build_transcription_failed_text(
                meeting=meeting,
                error_message=error_message,
                frontend_url=frontend_url,
            ),
        )

    async def _get_transcription_requester(
        self, session: AsyncSession, processing: MeetingAIProcessing
    ) -> TeamMember | None:
        requester_id = getattr(processing, "transcription_requested_by_id", None)
        if not requester_id:
            return None
        return await self.member_repo.get_by_id(session, requester_id)

    async def _send_transcription_telegram_message(
        self,
        bot,
        *,
        requester: TeamMember,
        text: str,
    ) -> None:
        telegram_id = getattr(requester, "telegram_id", None)
        if not bot or not telegram_id:
            return
        try:
            await bot.send_message(chat_id=telegram_id, text=text)
        except Exception:
            logger.warning(
                "Failed to send transcription Telegram notification to %s",
                telegram_id,
                exc_info=True,
            )

    @staticmethod
    def _build_transcription_completed_text(
        *,
        meeting: Meeting,
        frontend_url: str,
    ) -> str:
        title = getattr(meeting, "title", None) or "Без названия"
        char_count = f"{len(meeting.transcript or ''):,}".replace(",", " ")
        return "\n".join(
            [
                "Транскрибация готова ✅",
                "",
                f"Встреча: {title}",
                f"Текст: {char_count} символов",
                "",
                f"Открыть встречу: {frontend_url.rstrip('/')}/meetings/{meeting.id}",
            ]
        )

    @staticmethod
    def _build_transcription_failed_text(
        *,
        meeting: Meeting,
        error_message: str,
        frontend_url: str,
    ) -> str:
        title = getattr(meeting, "title", None) or "Без названия"
        return "\n".join(
            [
                "Ошибка транскрибации ❌",
                "",
                f"Встреча: {title}",
                f"Причина: {error_message[:300]}",
                "",
                f"Открыть встречу: {frontend_url.rstrip('/')}/meetings/{meeting.id}",
            ]
        )

    async def generate_draft(
        self,
        session: AsyncSession,
        *,
        meeting: Meeting,
    ) -> MeetingAIProcessing:
        if not meeting.transcript:
            raise ValueError("Нет транскрипции для генерации итогов")

        processing = await self.processing_repo.get_or_create(session, meeting.id)
        if processing.status == "published":
            raise ValueError("Итоги встречи уже опубликованы")

        try:
            members = await self.member_repo.get_all_active(session)
            parsed = await self.ai_service.parse_meeting_outcomes(
                session, meeting.transcript, members
            )
        except Exception as exc:
            await self.processing_repo.mark_failed_if_unpublished(
                session,
                meeting_id=meeting.id,
                error_message=str(exc),
            )
            await session.commit()
            raise

        draft_tasks = [
            {
                "title": task.title,
                "description": task.description,
                "assignee_name": task.assignee_name,
                "assignee_id": None,
                "deadline": task.deadline,
                "priority": normalize_task_urgency(task.priority),
                "selected": True,
            }
            for task in parsed.tasks
        ]
        applied_processing = await self.processing_repo.apply_draft_if_unpublished(
            session,
            meeting_id=meeting.id,
            draft_summary=parsed.summary,
            draft_decisions=parsed.decisions,
            draft_tasks=draft_tasks,
        )
        if not applied_processing:
            raise ValueError("Итоги встречи уже опубликованы")
        processing = applied_processing
        await session.flush()
        return processing

    async def publish_outcomes(
        self,
        session: AsyncSession,
        *,
        meeting: Meeting,
        processing: MeetingAIProcessing,
        moderator: TeamMember,
        draft_summary: str,
        draft_decisions: list[str],
        draft_tasks: list[dict],
    ) -> list:
        if processing.status == "published":
            raise ValueError("Итоги встречи уже опубликованы")
        if processing.status != "draft_ready":
            raise ValueError("Черновик итогов встречи ещё не готов")

        claimed_processing = await self.processing_repo.claim_publish(
            session, meeting_id=meeting.id
        )
        if not claimed_processing:
            raise ValueError("Итоги встречи уже опубликованы или черновик больше не готов")
        processing = claimed_processing

        members = await self.member_repo.get_all_active(session)
        members_by_id = {str(member.id): member for member in members}
        selected_tasks = []
        persisted_tasks = []
        for task in draft_tasks:
            task_data = task if isinstance(task, dict) else task.model_dump()
            persisted_task = dict(task_data)
            deadline = persisted_task.get("deadline")
            if hasattr(deadline, "isoformat"):
                persisted_task["deadline"] = deadline.isoformat()
            assignee_id = persisted_task.get("assignee_id")
            if assignee_id:
                persisted_task["assignee_id"] = str(assignee_id)
            persisted_tasks.append(persisted_task)

            if not task_data.get("selected", True):
                continue
            selected_task = dict(persisted_task)
            assignee = members_by_id.get(str(selected_task.get("assignee_id")))
            if assignee:
                selected_task["assignee_name"] = assignee.full_name
            selected_tasks.append(selected_task)

        meeting.parsed_summary = draft_summary
        meeting.decisions = draft_decisions
        if meeting.status != "completed":
            meeting.status = "completed"
        try:
            created_tasks = await self.meeting_service.create_tasks_from_parsed(
                session, meeting, selected_tasks, moderator, members
            )
        except Exception as exc:
            processing.status = "failed"
            processing.error_message = str(exc)
            processing.completed_at = datetime.utcnow()
            await session.flush()
            raise

        processing.status = "published"
        processing.draft_summary = draft_summary
        processing.draft_decisions = draft_decisions
        processing.draft_tasks = persisted_tasks
        processing.published_at = datetime.utcnow()
        processing.published_by_id = moderator.id
        await session.flush()
        return created_tasks
