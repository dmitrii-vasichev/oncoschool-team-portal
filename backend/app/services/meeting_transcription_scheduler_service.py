import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.db.repositories import MeetingAIProcessingRepository
from app.services.meeting_ai_outcomes_service import MeetingAIOutcomesService

logger = logging.getLogger(__name__)


class MeetingTranscriptionSchedulerService:
    """Processes queued long-running meeting audio transcription jobs."""

    def __init__(
        self,
        *,
        bot,
        session_maker: async_sessionmaker,
        zoom_service,
        frontend_url: str,
    ) -> None:
        self.bot = bot
        self.session_maker = session_maker
        self.zoom_service = zoom_service
        self.frontend_url = frontend_url.rstrip("/")
        self.scheduler = AsyncIOScheduler()
        self.processing_repo = MeetingAIProcessingRepository()
        self.outcomes_service = MeetingAIOutcomesService()
        self.max_attempts = 2
        self.stale_after_minutes = 30

    def start(self) -> None:
        if self.scheduler.running:
            logger.info("MeetingTranscriptionSchedulerService already running")
            return

        self.scheduler.add_job(
            self._process_due_jobs,
            "interval",
            minutes=1,
            id="meeting_transcription_scheduler",
            replace_existing=True,
            max_instances=1,
        )
        self.scheduler.start()
        logger.info("MeetingTranscriptionSchedulerService started")

    def stop(self) -> None:
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("MeetingTranscriptionSchedulerService stopped")

    async def _process_due_jobs(self) -> None:
        if not self.zoom_service:
            return

        stale_before = datetime.utcnow() - timedelta(minutes=self.stale_after_minutes)
        async with self.session_maker() as session:
            failed_count = (
                await self.processing_repo.mark_exhausted_stale_transcription_jobs_failed(
                    session,
                    stale_before=stale_before,
                    max_attempts=self.max_attempts,
                )
            )
            if failed_count:
                logger.warning(
                    "Marked %s exhausted meeting transcription job(s) as failed",
                    failed_count,
                )

            processing = await self.processing_repo.get_next_transcription_job(
                session,
                stale_before=stale_before,
                max_attempts=self.max_attempts,
            )
            if failed_count or processing:
                await session.commit()
            if not processing:
                return

            try:
                await self.outcomes_service.process_transcription_job(
                    session,
                    processing=processing,
                    zoom_service=self.zoom_service,
                    bot=self.bot,
                    frontend_url=self.frontend_url,
                )
            except Exception:
                logger.exception(
                    "Meeting transcription job failed meeting_id=%s",
                    getattr(processing, "meeting_id", None),
                )
