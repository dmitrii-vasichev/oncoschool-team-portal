"""meeting board focus labels

Revision ID: 034_meeting_board_focus_labels
Revises: 033_reset_audio_failures
Create Date: 2026-05-08
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy.dialects import postgresql
import sqlalchemy as sa

revision: str = "034_meeting_board_focus_labels"
down_revision: Union[str, None] = "033_reset_audio_failures"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "meeting_board_settings",
        sa.Column(
            "focus_label_ids",
            postgresql.ARRAY(postgresql.UUID(as_uuid=True)),
            server_default="{}",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("meeting_board_settings", "focus_label_ids")
