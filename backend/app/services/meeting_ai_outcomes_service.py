import os
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Meeting, MeetingAIProcessing, TeamMember
from app.db.repositories import MeetingAIProcessingRepository, TeamMemberRepository
from app.services.ai_service import AIService
from app.services.meeting_service import MeetingService
from app.services.task_urgency import normalize_task_urgency
from app.services.voice_service import DEFAULT_TRANSCRIPTION_MODEL, VoiceService


class MeetingAIOutcomesService:
    def __init__(self) -> None:
        self.processing_repo = MeetingAIProcessingRepository()
        self.voice_service = VoiceService()
        self.ai_service = AIService()
        self.meeting_service = MeetingService()
        self.member_repo = TeamMemberRepository()

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

    async def transcribe_meeting_audio(
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

        processing = await self.processing_repo.claim_transcription(
            session, meeting_id=meeting.id, model=model
        )
        if not processing:
            raise ValueError("Транскрибация уже выполняется")

        zoom_meeting_id = meeting.zoom_meeting_id
        await session.commit()

        try:
            transcript = await self._transcribe_temp_audio(
                zoom_service=zoom_service,
                voice_service=self.voice_service,
                zoom_meeting_id=zoom_meeting_id,
                model=model,
            )
        except Exception as exc:
            processing.status = "failed"
            processing.error_message = str(exc)
            processing.completed_at = datetime.utcnow()
            await session.flush()
            await session.commit()
            raise

        meeting.transcript = transcript
        meeting.transcript_source = "openai_audio"
        processing.status = "transcript_ready"
        processing.transcript_source = "openai_audio"
        processing.transcript_char_count = len(transcript)
        processing.completed_at = datetime.utcnow()
        await session.flush()
        await session.commit()
        return processing

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
            processing.status = "failed"
            processing.error_message = str(exc)
            processing.completed_at = datetime.utcnow()
            await session.flush()
            await session.commit()
            raise

        processing.status = "draft_ready"
        processing.draft_summary = parsed.summary
        processing.draft_decisions = parsed.decisions
        processing.draft_tasks = [
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
        claimed_processing = await self.processing_repo.claim_publish(
            session, meeting_id=meeting.id
        )
        if not claimed_processing:
            raise ValueError("Итоги встречи уже опубликованы")
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
