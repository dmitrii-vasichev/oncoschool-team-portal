"""meeting board and ai outcomes

Revision ID: 031_meeting_board_ai_outcomes
Revises: 030
Create Date: 2026-05-07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "031_meeting_board_ai_outcomes"
down_revision: Union[str, None] = "030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "meeting_board_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("meeting_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "added_member_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            server_default="{}",
            nullable=False,
        ),
        sa.Column(
            "added_department_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            server_default="{}",
            nullable=False,
        ),
        sa.Column(
            "pinned_task_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("materials", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("board_notes", sa.Text(), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["created_by_id"], ["team_members.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["updated_by_id"], ["team_members.id"], ondelete="SET NULL"
        ),
        sa.UniqueConstraint("meeting_id", name="uq_meeting_board_settings_meeting_id"),
    )
    op.create_index(
        "idx_meeting_board_settings_meeting_id",
        "meeting_board_settings",
        ["meeting_id"],
    )

    op.create_table(
        "meeting_ai_processing",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("meeting_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=40), server_default="idle", nullable=False),
        sa.Column("transcript_source", sa.String(length=40), nullable=True),
        sa.Column("transcription_model", sa.String(length=80), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("transcript_char_count", sa.Integer(), nullable=True),
        sa.Column("audio_duration_seconds", sa.Integer(), nullable=True),
        sa.Column("estimated_cost_usd", sa.Numeric(10, 4), nullable=True),
        sa.Column("draft_summary", sa.Text(), nullable=True),
        sa.Column(
            "draft_decisions", postgresql.JSONB(), server_default="[]", nullable=False
        ),
        sa.Column("draft_tasks", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("published_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["meeting_id"], ["meetings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["published_by_id"], ["team_members.id"], ondelete="SET NULL"
        ),
        sa.UniqueConstraint("meeting_id", name="uq_meeting_ai_processing_meeting_id"),
    )
    op.create_index(
        "idx_meeting_ai_processing_status", "meeting_ai_processing", ["status"]
    )


def downgrade() -> None:
    op.drop_index("idx_meeting_ai_processing_status", table_name="meeting_ai_processing")
    op.drop_table("meeting_ai_processing")
    op.drop_index(
        "idx_meeting_board_settings_meeting_id", table_name="meeting_board_settings"
    )
    op.drop_table("meeting_board_settings")
