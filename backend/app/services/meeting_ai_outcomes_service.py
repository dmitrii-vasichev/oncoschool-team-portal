import os
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Meeting, MeetingAIProcessing, TeamMember
from app.db.repositories import MeetingAIProcessingRepository
from app.services.voice_service import DEFAULT_TRANSCRIPTION_MODEL, VoiceService


class MeetingAIOutcomesService:
    def __init__(self) -> None:
        self.processing_repo = MeetingAIProcessingRepository()
        self.voice_service = VoiceService()

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

        processing = await self.processing_repo.get_or_create(session, meeting.id)
        if processing.status == "transcribing":
            raise ValueError("Транскрибация уже выполняется")

        zoom_meeting_id = meeting.zoom_meeting_id
        processing.status = "transcribing"
        processing.started_at = datetime.utcnow()
        processing.completed_at = None
        processing.error_message = None
        processing.transcript_source = None
        processing.transcript_char_count = None
        processing.audio_duration_seconds = None
        processing.estimated_cost_usd = None
        processing.transcription_model = model
        await session.flush()
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
