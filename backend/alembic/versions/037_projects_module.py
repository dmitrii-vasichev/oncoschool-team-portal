"""Add projects module tables.

Revision ID: 037_projects_module
Revises: 036_ideas_soft_delete
Create Date: 2026-05-13
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "037_projects_module"
down_revision: Union[str, None] = "036_ideas_soft_delete"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(30), server_default="planned", nullable=False),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("team_members.id"),
            nullable=False,
        ),
        sa.Column(
            "source_idea_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ideas.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column(
            "deleted_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("team_members.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_projects_status", "projects", ["status"])
    op.create_index("idx_projects_owner_id", "projects", ["owner_id"])
    op.create_index("idx_projects_source_idea_id", "projects", ["source_idea_id"])
    op.create_index("idx_projects_created_at", "projects", ["created_at"])
    op.create_index("idx_projects_deleted_at", "projects", ["deleted_at"])

    op.add_column(
        "ideas",
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_ideas_project_id_projects",
        "ideas",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "project_departments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "department_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("departments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("team_members.id"),
            nullable=False,
        ),
        sa.Column("status", sa.String(30), server_default="not_started", nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("team_members.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint(
            "project_id",
            "department_id",
            name="uq_project_departments_project_department",
        ),
        sa.UniqueConstraint(
            "project_id",
            "id",
            name="uq_project_departments_project_id_id",
        ),
    )
    op.create_index(
        "idx_project_departments_project_id",
        "project_departments",
        ["project_id"],
    )
    op.create_index(
        "idx_project_departments_department_id",
        "project_departments",
        ["department_id"],
    )
    op.create_index(
        "idx_project_departments_owner_id",
        "project_departments",
        ["owner_id"],
    )
    op.create_index(
        "idx_project_departments_status",
        "project_departments",
        ["status"],
    )

    op.create_table(
        "project_milestones",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("status", sa.String(30), server_default="planned", nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "idx_project_milestones_project_id",
        "project_milestones",
        ["project_id"],
    )
    op.create_index(
        "idx_project_milestones_status",
        "project_milestones",
        ["status"],
    )
    op.create_index(
        "idx_project_milestones_due_date",
        "project_milestones",
        ["due_date"],
    )

    op.create_table(
        "project_tasks",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "project_department_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "task_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tasks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("team_members.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["project_id", "project_department_id"],
            ["project_departments.project_id", "project_departments.id"],
            name="fk_project_tasks_project_department_same_project",
        ),
        sa.UniqueConstraint("task_id", name="uq_project_tasks_task_id"),
    )
    op.create_index("idx_project_tasks_project_id", "project_tasks", ["project_id"])
    op.create_index(
        "idx_project_tasks_project_department_id",
        "project_tasks",
        ["project_department_id"],
    )

    op.create_table(
        "project_comments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("team_members.id"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_project_comments_project_id", "project_comments", ["project_id"])
    op.create_index("idx_project_comments_created_at", "project_comments", ["created_at"])

    op.create_table(
        "project_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "actor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("team_members.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("payload", postgresql.JSONB(), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_project_events_project_id", "project_events", ["project_id"])
    op.create_index("idx_project_events_created_at", "project_events", ["created_at"])


def downgrade() -> None:
    op.drop_index("idx_project_events_created_at", table_name="project_events")
    op.drop_index("idx_project_events_project_id", table_name="project_events")
    op.drop_table("project_events")

    op.drop_index("idx_project_comments_created_at", table_name="project_comments")
    op.drop_index("idx_project_comments_project_id", table_name="project_comments")
    op.drop_table("project_comments")

    op.drop_index("idx_project_tasks_project_department_id", table_name="project_tasks")
    op.drop_index("idx_project_tasks_project_id", table_name="project_tasks")
    op.drop_table("project_tasks")

    op.drop_index("idx_project_milestones_due_date", table_name="project_milestones")
    op.drop_index("idx_project_milestones_status", table_name="project_milestones")
    op.drop_index("idx_project_milestones_project_id", table_name="project_milestones")
    op.drop_table("project_milestones")

    op.drop_index("idx_project_departments_status", table_name="project_departments")
    op.drop_index("idx_project_departments_owner_id", table_name="project_departments")
    op.drop_index(
        "idx_project_departments_department_id",
        table_name="project_departments",
    )
    op.drop_index("idx_project_departments_project_id", table_name="project_departments")
    op.drop_table("project_departments")

    op.drop_constraint("fk_ideas_project_id_projects", "ideas", type_="foreignkey")
    op.drop_column("ideas", "project_id")

    op.drop_index("idx_projects_deleted_at", table_name="projects")
    op.drop_index("idx_projects_created_at", table_name="projects")
    op.drop_index("idx_projects_source_idea_id", table_name="projects")
    op.drop_index("idx_projects_owner_id", table_name="projects")
    op.drop_index("idx_projects_status", table_name="projects")
    op.drop_table("projects")
