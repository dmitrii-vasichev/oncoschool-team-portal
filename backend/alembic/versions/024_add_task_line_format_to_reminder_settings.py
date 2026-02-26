"""Add task line format settings to reminder settings.

Revision ID: 024
Revises: 023
Create Date: 2026-02-26

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "024"
down_revision: Union[str, None] = "023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "reminder_settings",
        sa.Column("task_line_show_number", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "reminder_settings",
        sa.Column("task_line_show_title", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "reminder_settings",
        sa.Column("task_line_show_deadline", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "reminder_settings",
        sa.Column("task_line_show_priority", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "reminder_settings",
        sa.Column(
            "task_line_fields_order",
            sa.ARRAY(sa.String()),
            nullable=False,
            server_default='{"number","title","deadline","priority"}',
        ),
    )


def downgrade() -> None:
    op.drop_column("reminder_settings", "task_line_fields_order")
    op.drop_column("reminder_settings", "task_line_show_priority")
    op.drop_column("reminder_settings", "task_line_show_deadline")
    op.drop_column("reminder_settings", "task_line_show_title")
    op.drop_column("reminder_settings", "task_line_show_number")
