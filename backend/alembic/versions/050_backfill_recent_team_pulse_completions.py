"""backfill recent Team Pulse completion events

Revision ID: 050_pulse_backfill
Revises: 049_team_pulse
Create Date: 2026-05-29 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op


revision: str = "050_pulse_backfill"
down_revision: Union[str, None] = "049_team_pulse"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


BACKFILL_SQL = """
WITH completion_updates AS (
    SELECT DISTINCT ON (tu.task_id)
        tu.task_id,
        tu.author_id
    FROM task_updates tu
    WHERE tu.new_status = 'done'
       OR tu.update_type = 'completion'
    ORDER BY
        tu.task_id,
        CASE WHEN tu.new_status = 'done' THEN 0 ELSE 1 END,
        tu.created_at DESC
),
candidates AS (
    SELECT
        t.id AS task_id,
        t.short_id,
        t.title,
        t.completed_at,
        COALESCE(cu.author_id, t.assignee_id, t.created_by_id) AS actor_id,
        assignee.department_id AS department_id
    FROM tasks t
    LEFT JOIN completion_updates cu ON cu.task_id = t.id
    LEFT JOIN team_members assignee ON assignee.id = t.assignee_id
    WHERE t.status = 'done'
      AND t.completed_at IS NOT NULL
      AND t.completed_at >= ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '7 days')
      AND COALESCE(cu.author_id, t.assignee_id, t.created_by_id) IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM activity_events existing
          WHERE existing.task_id = t.id
            AND existing.event_type = 'task_completed'
      )
)
INSERT INTO activity_events (
    id,
    event_type,
    actor_id,
    task_id,
    department_id,
    visibility,
    payload,
    created_at
)
SELECT
    gen_random_uuid(),
    'task_completed',
    c.actor_id,
    c.task_id,
    c.department_id,
    'company',
    jsonb_build_object(
        'actor_name', actor.full_name,
        'task_title', c.title,
        'task_short_id', c.short_id,
        'department_name', department.name
    ),
    c.completed_at AT TIME ZONE 'UTC'
FROM candidates c
JOIN team_members actor ON actor.id = c.actor_id
LEFT JOIN departments department ON department.id = c.department_id
"""


def upgrade() -> None:
    op.execute(BACKFILL_SQL)


def downgrade() -> None:
    # Data-only migration. Backfilled rows intentionally remain because they
    # are indistinguishable from legitimate Team Pulse completion events.
    pass
