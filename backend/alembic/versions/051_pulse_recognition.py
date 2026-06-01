"""pulse recognition: milestone_awards + nullable actor

Revision ID: 051_pulse_recognition
Revises: 050_pulse_backfill
Create Date: 2026-05-31 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "051_pulse_recognition"
down_revision: Union[str, None] = "050_pulse_backfill"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Team/system events (monthly team milestone) legitimately have no actor.
    op.alter_column("activity_events", "actor_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)

    op.create_table(
        "milestone_awards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "member_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("team_members.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("milestone_key", sa.String(80), nullable=False),
        sa.Column("awarded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("milestone_key", name="uq_milestone_awards_key"),
    )


def downgrade() -> None:
    op.drop_table("milestone_awards")
    # Best-effort: only valid if no NULL actor_id rows remain.
    op.alter_column("activity_events", "actor_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
