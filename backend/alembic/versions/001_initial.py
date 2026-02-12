"""Initial migration — all tables + seed data

Revision ID: 001
Revises:
Create Date: 2026-02-11

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── team_members ──
    op.create_table(
        "team_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("telegram_id", sa.BigInteger(), unique=True, nullable=True),
        sa.Column("telegram_username", sa.String(100), nullable=True),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("name_variants", postgresql.ARRAY(sa.String()), server_default="{}"),
        sa.Column("role", sa.String(50), server_default="member"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_team_telegram", "team_members", ["telegram_id"])

    # ── meetings ──
    op.create_table(
        "meetings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("raw_summary", sa.Text(), nullable=False),
        sa.Column("parsed_summary", sa.Text(), nullable=True),
        sa.Column("decisions", postgresql.ARRAY(sa.String()), server_default="{}"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("meeting_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_meetings_date", "meetings", [sa.text("meeting_date DESC")])

    # ── tasks ──
    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("short_id", sa.Integer(), autoincrement=True, unique=True, nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(50), server_default="new"),
        sa.Column("priority", sa.String(20), server_default="medium"),
        sa.Column("assignee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id"), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id"), nullable=True),
        sa.Column("meeting_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("meetings.id"), nullable=True),
        sa.Column("source", sa.String(20), server_default="text"),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_tasks_assignee", "tasks", ["assignee_id"])
    op.create_index("idx_tasks_status", "tasks", ["status"])
    op.create_index("idx_tasks_meeting", "tasks", ["meeting_id"])
    op.create_index("idx_tasks_short_id", "tasks", ["short_id"])
    op.create_index("idx_tasks_deadline", "tasks", ["deadline"])
    op.create_index("idx_tasks_source", "tasks", ["source"])

    # ── task_updates ──
    op.create_table(
        "task_updates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("update_type", sa.String(30), server_default="progress"),
        sa.Column("old_status", sa.String(50), nullable=True),
        sa.Column("new_status", sa.String(50), nullable=True),
        sa.Column("progress_percent", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(20), server_default="telegram"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_task_updates_task", "task_updates", ["task_id"])
    op.create_index("idx_task_updates_created", "task_updates", [sa.text("created_at DESC")])

    # ── meeting_participants ──
    op.create_table(
        "meeting_participants",
        sa.Column("meeting_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("member_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id", ondelete="CASCADE"), primary_key=True),
    )

    # ── notification_subscriptions ──
    op.create_table(
        "notification_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("member_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("member_id", "event_type"),
    )
    op.create_index("idx_notification_subs_member", "notification_subscriptions", ["member_id"])

    # ── reminder_settings ──
    op.create_table(
        "reminder_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("member_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("is_enabled", sa.Boolean(), server_default="false"),
        sa.Column("reminder_time", sa.Time(), server_default="09:00"),
        sa.Column("timezone", sa.String(50), server_default="Europe/Moscow"),
        sa.Column("days_of_week", postgresql.ARRAY(sa.Integer()), server_default="{1,2,3,4,5}"),
        sa.Column("include_overdue", sa.Boolean(), server_default="true"),
        sa.Column("include_upcoming", sa.Boolean(), server_default="true"),
        sa.Column("include_in_progress", sa.Boolean(), server_default="true"),
        sa.Column("configured_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_reminder_enabled", "reminder_settings", ["is_enabled"], postgresql_where=sa.text("is_enabled = true"))

    # ── app_settings ──
    op.create_table(
        "app_settings",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", postgresql.JSONB(), nullable=False),
        sa.Column("updated_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Seed data ──
    op.execute("""
        INSERT INTO app_settings (key, value) VALUES
        ('ai_provider', '{"provider": "anthropic", "model": "claude-sonnet-4-20250514"}'),
        ('ai_providers_config', '{
            "anthropic": {
                "models": ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
                "default": "claude-sonnet-4-20250514"
            },
            "openai": {
                "models": ["gpt-4o", "gpt-4o-mini"],
                "default": "gpt-4o"
            },
            "gemini": {
                "models": ["gemini-2.0-flash", "gemini-2.0-pro"],
                "default": "gemini-2.0-flash"
            }
        }')
    """)


def downgrade() -> None:
    op.drop_table("app_settings")
    op.drop_table("reminder_settings")
    op.drop_table("notification_subscriptions")
    op.drop_table("meeting_participants")
    op.drop_table("task_updates")
    op.drop_table("tasks")
    op.drop_table("meetings")
    op.drop_table("team_members")
