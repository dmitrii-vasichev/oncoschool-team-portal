"""Add support for multiple meeting reminder offsets.

Revision ID: 016
Revises: 015
Create Date: 2026-02-21

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "meeting_schedules",
        sa.Column(
            "reminder_offsets_minutes",
            postgresql.ARRAY(sa.Integer()),
            nullable=False,
            server_default=sa.text("'{}'::integer[]"),
        ),
    )
    op.execute(
        """
        UPDATE meeting_schedules
        SET reminder_offsets_minutes = ARRAY[
            LEAST(GREATEST(COALESCE(reminder_minutes_before, 60), 0), 10080)
        ]
        WHERE reminder_offsets_minutes IS NULL
           OR cardinality(reminder_offsets_minutes) = 0
        """
    )

    op.add_column(
        "meetings",
        sa.Column(
            "sent_reminder_offsets_minutes",
            postgresql.ARRAY(sa.Integer()),
            nullable=False,
            server_default=sa.text("'{}'::integer[]"),
        ),
    )


def downgrade() -> None:
    op.drop_column("meetings", "sent_reminder_offsets_minutes")
    op.drop_column("meeting_schedules", "reminder_offsets_minutes")
