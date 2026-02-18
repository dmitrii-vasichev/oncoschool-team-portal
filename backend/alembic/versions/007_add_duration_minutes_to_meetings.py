"""Add duration_minutes to meetings.

Revision ID: 007
Revises: 006
Create Date: 2026-02-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "meetings",
        sa.Column("duration_minutes", sa.Integer(), server_default="60", nullable=False),
    )
    # Populate from linked schedules where available
    op.execute(
        """
        UPDATE meetings m
        SET duration_minutes = ms.duration_minutes
        FROM meeting_schedules ms
        WHERE m.schedule_id = ms.id
          AND ms.duration_minutes IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column("meetings", "duration_minutes")
