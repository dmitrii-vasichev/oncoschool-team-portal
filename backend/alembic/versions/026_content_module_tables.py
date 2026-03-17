"""Add Content module tables: telegram_session, telegram_channels, telegram_content,
analysis_prompts, analysis_runs, content_access, ai_feature_config.
Migrate existing AI provider settings into ai_feature_config.

Revision ID: 026
Revises: 025
Create Date: 2026-03-17

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "026"
down_revision: Union[str, None] = "025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- telegram_session (single-row, encrypted credentials) ---
    op.create_table(
        "telegram_session",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("api_id_encrypted", sa.Text(), nullable=True),
        sa.Column("api_hash_encrypted", sa.Text(), nullable=True),
        sa.Column("phone_number", sa.String(30), nullable=True),
        sa.Column("session_string_encrypted", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), server_default="disconnected", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("connected_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # --- telegram_channels ---
    op.create_table(
        "telegram_channels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("username", sa.String(200), nullable=False, unique=True),
        sa.Column("display_name", sa.String(300), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # --- telegram_content ---
    op.create_table(
        "telegram_content",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("channel_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("telegram_channels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("telegram_message_id", sa.BigInteger(), nullable=False),
        sa.Column("content_type", sa.String(20), nullable=False),  # post | comment
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("message_date", sa.DateTime(), nullable=False),
        sa.Column("loaded_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("channel_id", "telegram_message_id", name="uq_channel_message"),
    )
    op.create_index("idx_telegram_content_channel_date", "telegram_content", ["channel_id", "message_date"])
    op.create_index("idx_telegram_content_loaded_at", "telegram_content", ["loaded_at"])

    # --- analysis_prompts ---
    op.create_table(
        "analysis_prompts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # --- analysis_runs ---
    op.create_table(
        "analysis_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("channels", postgresql.JSONB(), nullable=False),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
        sa.Column("content_type", sa.String(20), nullable=False),  # posts | comments | all
        sa.Column("prompt_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("analysis_prompts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("prompt_snapshot", sa.Text(), nullable=False),
        sa.Column("ai_provider", sa.String(50), nullable=True),
        sa.Column("ai_model", sa.String(100), nullable=True),
        sa.Column("result_markdown", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), server_default="preparing", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("run_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )

    # --- content_access ---
    op.create_table(
        "content_access",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("sub_section", sa.String(50), nullable=False),  # telegram_analysis
        sa.Column("member_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id", ondelete="CASCADE"), nullable=True),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("departments.id", ondelete="CASCADE"), nullable=True),
        sa.Column("role", sa.String(20), nullable=False),  # operator | editor
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "member_id IS NOT NULL OR department_id IS NOT NULL",
            name="ck_content_access_target",
        ),
    )

    # --- ai_feature_config ---
    op.create_table(
        "ai_feature_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("feature_key", sa.String(100), nullable=False, unique=True),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("provider", sa.String(50), nullable=True),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("updated_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # --- Data migration: copy current AI settings into ai_feature_config ---
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT value FROM app_settings WHERE key = 'ai_provider'")
    )
    row = result.fetchone()

    provider = None
    model = None
    if row:
        import json
        val = row[0] if isinstance(row[0], dict) else json.loads(row[0])
        provider = val.get("provider")
        model = val.get("model")

    # Insert default row
    conn.execute(
        sa.text(
            "INSERT INTO ai_feature_config (id, feature_key, display_name, provider, model) "
            "VALUES (gen_random_uuid(), 'default', 'Default', :provider, :model)"
        ),
        {"provider": provider, "model": model},
    )

    # Insert meetings_summary row (same as current)
    conn.execute(
        sa.text(
            "INSERT INTO ai_feature_config (id, feature_key, display_name, provider, model) "
            "VALUES (gen_random_uuid(), 'meetings_summary', 'Meetings: Summary', :provider, :model)"
        ),
        {"provider": provider, "model": model},
    )

    # Insert telegram_analysis row (null — will fall back to default)
    conn.execute(
        sa.text(
            "INSERT INTO ai_feature_config (id, feature_key, display_name, provider, model) "
            "VALUES (gen_random_uuid(), 'telegram_analysis', 'Telegram Analysis', NULL, NULL)"
        ),
    )


def downgrade() -> None:
    op.drop_table("ai_feature_config")
    op.drop_table("content_access")
    op.drop_table("analysis_runs")
    op.drop_table("analysis_prompts")
    op.drop_index("idx_telegram_content_loaded_at", table_name="telegram_content")
    op.drop_index("idx_telegram_content_channel_date", table_name="telegram_content")
    op.drop_table("telegram_content")
    op.drop_table("telegram_channels")
    op.drop_table("telegram_session")
