import unittest
from datetime import datetime

from app.services.meeting_scheduler_service import MeetingSchedulerService


class MeetingSchedulerTranscriptTests(unittest.TestCase):
    def test_has_meeting_finished_returns_true_after_end(self) -> None:
        meeting_date = datetime(2026, 2, 19, 10, 0)
        now_utc_naive = datetime(2026, 2, 19, 11, 1)

        self.assertTrue(
            MeetingSchedulerService._has_meeting_finished(
                meeting_date=meeting_date,
                duration_minutes=60,
                status="scheduled",
                now_utc_naive=now_utc_naive,
            )
        )

    def test_has_meeting_finished_returns_false_while_in_progress(self) -> None:
        meeting_date = datetime(2026, 2, 19, 10, 0)
        now_utc_naive = datetime(2026, 2, 19, 10, 30)

        self.assertFalse(
            MeetingSchedulerService._has_meeting_finished(
                meeting_date=meeting_date,
                duration_minutes=60,
                status="in_progress",
                now_utc_naive=now_utc_naive,
            )
        )

    def test_has_meeting_finished_uses_default_duration(self) -> None:
        meeting_date = datetime(2026, 2, 19, 10, 0)
        now_utc_naive = datetime(2026, 2, 19, 11, 0)

        self.assertTrue(
            MeetingSchedulerService._has_meeting_finished(
                meeting_date=meeting_date,
                duration_minutes=None,
                status="scheduled",
                now_utc_naive=now_utc_naive,
            )
        )

    def test_has_meeting_finished_returns_true_when_status_completed(self) -> None:
        meeting_date = datetime(2026, 2, 19, 10, 0)
        now_utc_naive = datetime(2026, 2, 19, 10, 10)

        self.assertTrue(
            MeetingSchedulerService._has_meeting_finished(
                meeting_date=meeting_date,
                duration_minutes=60,
                status="completed",
                now_utc_naive=now_utc_naive,
            )
        )
