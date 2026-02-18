"""Compute effective meeting status based on current time."""

from datetime import datetime, timedelta


def compute_effective_status(
    stored_status: str,
    meeting_date: datetime | None,
    duration_minutes: int = 60,
) -> str:
    """Compute effective meeting status.

    Rules:
    - "cancelled" and "completed" stored in DB are final (manual/summary).
    - For "scheduled"/"in_progress": compute based on meeting_date + duration.
    """
    if stored_status in ("cancelled", "completed"):
        return stored_status

    if meeting_date is None:
        return stored_status

    now = datetime.utcnow()
    end_time = meeting_date + timedelta(minutes=duration_minutes)

    if now >= end_time:
        return "completed"
    if now >= meeting_date:
        return "in_progress"

    return "scheduled"
