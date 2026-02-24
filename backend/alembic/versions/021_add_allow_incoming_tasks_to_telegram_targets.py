"""Add incoming-task toggle to telegram notification targets.

Revision ID: 021
Revises: 020
Create Date: 2026-02-24

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "021"
down_revision: Union[str, None] = "020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "telegram_notification_targets",
        sa.Column(
            "allow_incoming_tasks",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("telegram_notification_targets", "allow_incoming_tasks")

