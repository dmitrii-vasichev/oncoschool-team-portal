"""Service for periodic cleanup of expired Telegram content.

Runs as an APScheduler job — deletes content older than retention_days (default 90).
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.db.repositories import TelegramContentRepository

logger = logging.getLogger(__name__)

DEFAULT_RETENTION_DAYS = 90


class ContentCleanupService:
    """APScheduler-based service for data retention cleanup."""

    def __init__(self, session_maker: async_sessionmaker, retention_days: int = DEFAULT_RETENTION_DAYS):
        self._session_maker = session_maker
        self._retention_days = retention_days
        self._repo = TelegramContentRepository()
        self._scheduler = AsyncIOScheduler()

    def start(self) -> None:
        """Start the cleanup scheduler (daily at 3:00 AM)."""
        self._scheduler.add_job(
            self._cleanup_expired_content,
            "cron",
            hour=3,
            minute=0,
            id="content_cleanup",
            replace_existing=True,
        )
        self._scheduler.start()
        logger.info(
            "ContentCleanupService started (retention=%d days, schedule=daily 03:00)",
            self._retention_days,
        )

    def stop(self) -> None:
        """Stop the cleanup scheduler."""
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)
            logger.info("ContentCleanupService stopped")

    async def _cleanup_expired_content(self) -> None:
        """Delete telegram_content records older than retention_days."""
        try:
            async with self._session_maker() as session:
                async with session.begin():
                    deleted = await self._repo.delete_expired(session, self._retention_days)

                if deleted > 0:
                    logger.info(
                        "Content cleanup: deleted %d records older than %d days",
                        deleted, self._retention_days,
                    )
        except Exception:
            logger.exception("Content cleanup job failed")
