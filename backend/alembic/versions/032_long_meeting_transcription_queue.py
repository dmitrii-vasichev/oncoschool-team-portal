"""long meeting transcription queue

Revision ID: 032_long_audio_queue
Revises: 031_meeting_board_ai_outcomes
Create Date: 2026-05-07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "032_long_audio_queue"
down_revision: Union[str, None] = "031_meeting_board_ai_outcomes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "meeting_ai_processing",
        sa.Column(
            "transcription_requested_by_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.add_column(
        "meeting_ai_processing",
        sa.Column("transcription_phase", sa.String(length=40), nullable=True),
    )
    op.add_column(
        "meeting_ai_processing",
        sa.Column(
            "transcription_progress_percent",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
    )
    op.add_column(
        "meeting_ai_processing",
        sa.Column(
            "transcription_current_chunk",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
    )
    op.add_column(
        "meeting_ai_processing",
        sa.Column(
            "transcription_total_chunks",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
    )
    op.add_column(
        "meeting_ai_processing",
        sa.Column("transcription_source_bytes", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "meeting_ai_processing",
        sa.Column("transcription_prepared_bytes", sa.BigInteger(), nullable=True),
    )
    op.add_column(
        "meeting_ai_processing",
        sa.Column(
            "transcription_attempt_count",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
    )
    op.add_column(
        "meeting_ai_processing",
        sa.Column("transcription_last_heartbeat_at", sa.DateTime(), nullable=True),
    )
    op.create_foreign_key(
        "fk_meeting_ai_processing_requested_by",
        "meeting_ai_processing",
        "team_members",
        ["transcription_requested_by_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "idx_meeting_ai_processing_phase",
        "meeting_ai_processing",
        ["transcription_phase"],
    )
    op.create_index(
        "idx_meeting_ai_processing_heartbeat",
        "meeting_ai_processing",
        ["transcription_last_heartbeat_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "idx_meeting_ai_processing_heartbeat",
        table_name="meeting_ai_processing",
    )
    op.drop_index(
        "idx_meeting_ai_processing_phase",
        table_name="meeting_ai_processing",
    )
    op.drop_constraint(
        "fk_meeting_ai_processing_requested_by",
        "meeting_ai_processing",
        type_="foreignkey",
    )
    op.drop_column("meeting_ai_processing", "transcription_last_heartbeat_at")
    op.drop_column("meeting_ai_processing", "transcription_attempt_count")
    op.drop_column("meeting_ai_processing", "transcription_prepared_bytes")
    op.drop_column("meeting_ai_processing", "transcription_source_bytes")
    op.drop_column("meeting_ai_processing", "transcription_total_chunks")
    op.drop_column("meeting_ai_processing", "transcription_current_chunk")
    op.drop_column("meeting_ai_processing", "transcription_progress_percent")
    op.drop_column("meeting_ai_processing", "transcription_phase")
    op.drop_column("meeting_ai_processing", "transcription_requested_by_id")
