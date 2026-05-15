"""Add Content Factory guest story activity events.

Revision ID: 043_cf_guest_story_events
Revises: 042_content_factory_guest_story
Create Date: 2026-05-14
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "043_cf_guest_story_events"
down_revision: Union[str, None] = "042_content_factory_guest_story"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cf_guest_story_event",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "guest_story_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cf_guest_story.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "actor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("team_members.id"),
            nullable=True,
        ),
        sa.Column("event_type", sa.String(40), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("old_value", sa.String(300), nullable=True),
        sa.Column("new_value", sa.String(300), nullable=True),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_cf_guest_story_event_story_created",
        "cf_guest_story_event",
        ["guest_story_id", "created_at"],
    )
    op.create_index("ix_cf_guest_story_event_type", "cf_guest_story_event", ["event_type"])


def downgrade() -> None:
    op.drop_index("ix_cf_guest_story_event_type", table_name="cf_guest_story_event")
    op.drop_index("ix_cf_guest_story_event_story_created", table_name="cf_guest_story_event")
    op.drop_table("cf_guest_story_event")
