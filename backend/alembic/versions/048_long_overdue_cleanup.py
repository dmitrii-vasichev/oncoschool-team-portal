"""Add overdue cleanup columns to tasks table.

Revision ID: 048_long_overdue_cleanup
Revises: 047_cf_metric_sources
Create Date: 2026-05-27 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "048_long_overdue_cleanup"
down_revision: Union[str, None] = "047_cf_metric_sources"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tasks", sa.Column("escalation_dm_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tasks", sa.Column("cancellation_reason", sa.String(50), nullable=True))

    op.execute("""
        UPDATE tasks
        SET last_activity_at = COALESCE(updated_at, created_at)
        WHERE last_activity_at IS NULL
    """)

    op.alter_column("tasks", "last_activity_at", nullable=False)
    op.create_index("ix_tasks_last_activity_at", "tasks", ["last_activity_at"])


def downgrade() -> None:
    op.drop_index("ix_tasks_last_activity_at", table_name="tasks")
    op.drop_column("tasks", "cancellation_reason")
    op.drop_column("tasks", "escalation_dm_sent_at")
    op.drop_column("tasks", "last_activity_at")
