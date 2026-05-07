"""reset legacy audio transcription failures

Revision ID: 033_reset_audio_failures
Revises: 032_long_audio_queue
Create Date: 2026-05-07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "033_reset_audio_failures"
down_revision: Union[str, None] = "032_long_audio_queue"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


LEGACY_AUDIO_ERRORS = (
    "Аудиофайл больше 25 МБ. Для этой записи пока нужна ручная обработка или сжатие.",
    "Аудиозапись встречи недоступна в Zoom",
)


def upgrade() -> None:
    statement = sa.text(
        """
        UPDATE meeting_ai_processing
        SET
            status = 'idle',
            started_at = NULL,
            completed_at = NULL,
            error_message = NULL,
            transcription_phase = NULL,
            transcription_progress_percent = 0,
            transcription_current_chunk = 0,
            transcription_total_chunks = 0,
            transcription_source_bytes = NULL,
            transcription_prepared_bytes = NULL,
            transcription_attempt_count = 0,
            transcription_last_heartbeat_at = NULL
        WHERE status = 'failed'
          AND transcription_requested_by_id IS NULL
          AND transcription_phase IS NULL
          AND error_message IN :legacy_errors
        """
    ).bindparams(sa.bindparam("legacy_errors", expanding=True))
    op.get_bind().execute(
        statement,
        {"legacy_errors": list(LEGACY_AUDIO_ERRORS)},
    )


def downgrade() -> None:
    pass
