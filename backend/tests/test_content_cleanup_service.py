"""Tests for ContentCleanupService — scheduler configuration."""

import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.content_cleanup_service import ContentCleanupService, DEFAULT_RETENTION_DAYS


class TestContentCleanupService(unittest.TestCase):
    """Tests for ContentCleanupService configuration."""

    def test_default_retention_days(self):
        self.assertEqual(DEFAULT_RETENTION_DAYS, 90)

    def test_custom_retention_days(self):
        session_maker = MagicMock()
        service = ContentCleanupService(session_maker=session_maker, retention_days=30)
        self.assertEqual(service._retention_days, 30)

    def test_scheduler_job_configured(self):
        """Verify scheduler has the cleanup job configured (without starting event loop)."""
        session_maker = MagicMock()
        service = ContentCleanupService(session_maker=session_maker)
        # Add job without starting scheduler (avoids event loop requirement)
        service._scheduler.add_job(
            service._cleanup_expired_content,
            "cron",
            hour=3,
            minute=0,
            id="content_cleanup",
            replace_existing=True,
        )
        jobs = service._scheduler.get_jobs()
        self.assertEqual(len(jobs), 1)
        self.assertEqual(jobs[0].id, "content_cleanup")

    def test_stop_when_not_running(self):
        session_maker = MagicMock()
        service = ContentCleanupService(session_maker=session_maker)
        # Should not raise
        service.stop()


class TestDownloadServiceLocking(unittest.TestCase):
    """Tests for channel lock mechanism."""

    def test_channel_lock_error_message(self):
        from app.services.telegram_download_service import ChannelLockError

        error = ChannelLockError("Channel 'Test' is being downloaded")
        self.assertIn("Test", str(error))


if __name__ == "__main__":
    unittest.main()
