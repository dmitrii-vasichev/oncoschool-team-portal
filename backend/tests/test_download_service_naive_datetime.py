"""Regression test for #50: download_missing must use naive datetimes.

The telegram_content.message_date column is TIMESTAMP WITHOUT TIME ZONE.
All datetime parameters passed to repository queries must be timezone-naive,
otherwise asyncpg raises DataError.
"""

import os
import unittest


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


if __name__ == "__main__":
    unittest.main()
