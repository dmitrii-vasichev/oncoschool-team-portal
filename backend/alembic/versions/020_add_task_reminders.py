"""Add one-off task reminders.

Revision ID: 020
Revises: 019
Create Date: 2026-02-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("reminder_at", sa.DateTime(), nullable=True))
    op.add_column("tasks", sa.Column("reminder_comment", sa.Text(), nullable=True))
    op.add_column("tasks", sa.Column("reminder_sent_at", sa.DateTime(), nullable=True))
    op.create_index(
        "idx_tasks_reminder_pending",
        "tasks",
        ["reminder_sent_at", "reminder_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_tasks_reminder_pending", table_name="tasks")
    op.drop_column("tasks", "reminder_sent_at")
    op.drop_column("tasks", "reminder_comment")
    op.drop_column("tasks", "reminder_at")
