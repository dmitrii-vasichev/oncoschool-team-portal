"""Add reports module tables: daily_metrics, getcourse_credentials.
Add type column to telegram_notification_targets.

Revision ID: 027
Revises: 026
Create Date: 2026-03-20

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "027"
down_revision: Union[str, None] = "026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- daily_metrics ---
    op.create_table(
        "daily_metrics",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("metric_date", sa.Date(), nullable=False),
        sa.Column("source", sa.String(50), nullable=False, server_default="getcourse"),
        sa.Column("users_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("payments_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("payments_sum", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("orders_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("orders_sum", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("collected_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "collected_by_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("team_members.id"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("source", "metric_date", name="uq_daily_metrics_source_date"),
    )

    # --- getcourse_credentials ---
    op.create_table(
        "getcourse_credentials",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("base_url", sa.String(500), nullable=False),
        sa.Column("api_key_encrypted", sa.String(1000), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column(
            "updated_by_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("team_members.id"),
            nullable=True,
        ),
    )

    # --- Add type column to telegram_notification_targets ---
    op.add_column(
        "telegram_notification_targets",
        sa.Column("type", sa.String(50), nullable=True, server_default="meeting"),
    )
    # Backfill existing rows
    op.execute("UPDATE telegram_notification_targets SET type = 'meeting' WHERE type IS NULL")


def downgrade() -> None:
    op.drop_column("telegram_notification_targets", "type")
    op.drop_table("getcourse_credentials")
    op.drop_table("daily_metrics")
