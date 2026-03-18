"""Regression tests for TelegramDownloadService.

#50: download_missing must use naive datetimes (TIMESTAMP WITHOUT TIME ZONE).
#57: _make_naive must strip tz, offset_date must be used, FloodWait must retry.
"""

import os
import unittest
from datetime import datetime, timezone, timedelta


SERVICE_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "app",
    "services",
    "telegram_download_service.py",
)


class TestDatetimeNaive(unittest.TestCase):
    """Ensure TelegramDownloadService does not pass aware datetimes to naive columns."""

    def test_no_timezone_utc_in_datetime_combine(self):
        """Regression #50: datetime.combine() calls must NOT include tzinfo.

        Previously download_missing() used `tzinfo=timezone.utc` which caused
        asyncpg DataError when comparing against TIMESTAMP WITHOUT TIME ZONE column.
        """
        with open(SERVICE_PATH) as f:
            source = f.read()

        self.assertNotIn(
            "tzinfo=timezone.utc",
            source,
            "telegram_download_service.py must not use timezone.utc in datetime.combine() "
            "— the message_date column is TIMESTAMP WITHOUT TIME ZONE",
        )

    def test_datetime_combine_present(self):
        """Sanity check: datetime.combine() is still used for date range construction."""
        with open(SERVICE_PATH) as f:
            source = f.read()

        self.assertIn("datetime.combine(", source)


class TestMakeNaive(unittest.TestCase):
    """Regression #57: _make_naive logic must convert tz-aware datetimes to naive UTC.

    Tests the same algorithm used in TelegramDownloadService._make_naive
    without importing the full module (avoids heavy dependencies).
    """

    @staticmethod
    def _make_naive(dt):
        """Mirror of TelegramDownloadService._make_naive."""
        if dt is None:
            return None
        if dt.tzinfo is not None:
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt

    def test_naive_passthrough(self):
        """Naive datetimes pass through unchanged."""
        dt = datetime(2026, 3, 10, 12, 0, 0)
        result = self._make_naive(dt)
        self.assertEqual(result, dt)
        self.assertIsNone(result.tzinfo)

    def test_aware_to_naive(self):
        """Tz-aware datetimes are converted to naive UTC."""
        dt_aware = datetime(2026, 3, 10, 15, 0, 0, tzinfo=timezone(timedelta(hours=3)))
        result = self._make_naive(dt_aware)
        self.assertIsNone(result.tzinfo)
        # 15:00 MSK = 12:00 UTC
        self.assertEqual(result, datetime(2026, 3, 10, 12, 0, 0))

    def test_utc_aware_to_naive(self):
        """UTC tz-aware datetimes become the same time but naive."""
        dt_utc = datetime(2026, 3, 10, 12, 0, 0, tzinfo=timezone.utc)
        result = self._make_naive(dt_utc)
        self.assertIsNone(result.tzinfo)
        self.assertEqual(result, datetime(2026, 3, 10, 12, 0, 0))

    def test_none_returns_none(self):
        """None input returns None."""
        self.assertIsNone(self._make_naive(None))


class TestCodePatterns(unittest.TestCase):
    """Regression #57: verify key code patterns in the service."""

    def test_offset_date_used(self):
        """get_chat_history must use offset_date to avoid scanning all newer messages."""
        with open(SERVICE_PATH) as f:
            source = f.read()

        self.assertIn("offset_date=", source)

    def test_flood_wait_retries(self):
        """FloodWait handling must include retry logic (not just sleep and give up)."""
        with open(SERVICE_PATH) as f:
            source = f.read()

        self.assertIn("MAX_FLOOD_RETRIES", source)
        self.assertIn("flood_retries", source)

    def test_make_naive_called(self):
        """_make_naive must be called on message.date before comparison."""
        with open(SERVICE_PATH) as f:
            source = f.read()

        self.assertIn("_make_naive(message.date)", source)
        self.assertIn("_make_naive(reply.date)", source)

    def test_discussion_replies_used(self):
        """Comments must be fetched via get_discussion_replies, not get_chat_history."""
        with open(SERVICE_PATH) as f:
            source = f.read()

        self.assertIn("get_discussion_replies", source)
        self.assertIn("COMMENT_ID_OFFSET", source)


if __name__ == "__main__":
    unittest.main()
