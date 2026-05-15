"""Add threaded guest story activity events.

Revision ID: 044_cf_guest_event_threads
Revises: 043_cf_guest_story_events
Create Date: 2026-05-14 20:10:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "044_cf_guest_event_threads"
down_revision: Union[str, None] = "043_cf_guest_story_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "cf_guest_story_event",
        sa.Column("parent_event_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_cf_guest_story_event_parent",
        "cf_guest_story_event",
        "cf_guest_story_event",
        ["parent_event_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_cf_guest_story_event_parent",
        "cf_guest_story_event",
        ["parent_event_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_cf_guest_story_event_parent", table_name="cf_guest_story_event")
    op.drop_constraint(
        "fk_cf_guest_story_event_parent",
        "cf_guest_story_event",
        type_="foreignkey",
    )
    op.drop_column("cf_guest_story_event", "parent_event_id")
