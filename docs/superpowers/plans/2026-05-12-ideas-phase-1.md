# Ideas Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 web portal Ideas section so the team can create, review, discuss, decompose, link tasks to, and complete ideas without adding Projects yet.

**Architecture:** Add an Ideas domain beside existing Tasks and Meetings: new SQLAlchemy models, Pydantic schemas, repository/service permissions, FastAPI routes, and Next.js pages under `/ideas`. Phase 1 reuses the existing task service for linked task creation and treats Projects as documented future work only.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, Alembic, Pydantic v2, PostgreSQL, Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Lucide React, Node test runner, pytest.

---

## Source Documents

- Approved design: `docs/superpowers/specs/2026-05-12-ideas-projects-tasks-design.md`
- Current repo plan index: `docs/PLAN.md`
- Current repo status journal: `docs/STATUS.md`
- Relevant backend patterns:
  - `backend/app/api/tasks.py`
  - `backend/app/services/task_service.py`
  - `backend/app/services/task_visibility_service.py`
  - `backend/app/db/models.py`
  - `backend/app/db/schemas.py`
- Relevant frontend patterns:
  - `frontend/src/app/tasks/page.tsx`
  - `frontend/src/app/meetings/[id]/board/page.tsx`
  - `frontend/src/lib/api.ts`
  - `frontend/src/lib/types.ts`
  - `frontend/src/components/shared/StatusBadge.tsx`
  - `frontend/src/components/ui/*`

## File Structure

### Backend

- Modify `backend/app/db/models.py`
  - Add `Idea`, `IdeaDepartment`, `IdeaTask`, `IdeaComment`, and `IdeaEvent` models.
  - Add relationships to `TeamMember`, `Department`, and `Task` only where useful for eager loading.
- Create `backend/alembic/versions/035_ideas_module.py`
  - Create `ideas`, `idea_departments`, `idea_tasks`, `idea_comments`, and `idea_events`.
  - Add indexes for status, author, review owner, created date, idea foreign keys, and task links.
- Modify `backend/app/db/schemas.py`
  - Add literal types and request/response schemas for Ideas.
- Modify `backend/app/db/repositories.py`
  - Add `IdeaRepository` with focused query, create, update, department, comment, event, and link helpers.
- Create `backend/app/services/idea_service.py`
  - Own business rules: permissions, status transitions, decision reasons, department contribution rules, linked task visibility shaping, completion gating.
- Create `backend/app/api/ideas.py`
  - Add Ideas API routes.
- Modify `backend/app/api/router.py`
  - Include the Ideas router.
- Create `backend/tests/test_idea_service.py`
  - Unit coverage for status rules, permission checks, and completion gates.
- Create `backend/tests/test_ideas_api.py`
  - API route coverage with mocked service/repository where appropriate.

### Frontend

- Modify `frontend/src/lib/types.ts`
  - Add Idea status types, request/response interfaces, and labels.
- Modify `frontend/src/lib/api.ts`
  - Add Ideas client methods.
- Create `frontend/src/lib/ideaUtils.ts`
  - Small pure helpers for status labels, completion availability, register filters, and task progress summaries.
- Create `frontend/src/lib/ideaUtils.test.ts`
  - Unit tests for pure helpers.
- Create `frontend/src/components/ideas/IdeaStatusBadge.tsx`
- Create `frontend/src/components/ideas/CreateIdeaDialog.tsx`
- Create `frontend/src/components/ideas/IdeaFilters.tsx`
- Create `frontend/src/components/ideas/IdeaRegisterRow.tsx`
- Create `frontend/src/components/ideas/IdeaDecisionPanel.tsx`
- Create `frontend/src/components/ideas/IdeaDepartmentPanel.tsx`
- Create `frontend/src/components/ideas/IdeaLinkedTasks.tsx`
- Create `frontend/src/components/ideas/IdeaComments.tsx`
- Create `frontend/src/components/ideas/IdeaEventHistory.tsx`
- Create `frontend/src/app/ideas/page.tsx`
- Create `frontend/src/app/ideas/[id]/page.tsx`
- Modify `frontend/src/components/layout/Sidebar.tsx`
  - Add the `Идеи` navigation item.

### Docs

- Modify `docs/PLAN.md`
  - Make this plan the active plan.
- Modify `docs/STATUS.md`
  - Add an Ideas Phase 1 status section.

---

## Domain Decisions To Preserve

- Phase 1 is web only. Do not add Telegram bot flows.
- Ideas are visible to every active team member.
- Linked task content must still respect existing task visibility.
- Idea labels/tags are out of scope.
- Project tables and UI are out of scope.
- `in_tasks` is an implementation stage, not the final state.
- `completed` is a manual final close after completion gates pass.
- Rejected and deferred decisions require a reason.
- Direct idea tasks without involved departments are allowed.
- A no-department idea can be completed only after at least one direct linked task exists and all direct linked tasks are `done` or `cancelled`.

---

### Task 1: Backend Domain Models And Migration

**Files:**
- Modify: `backend/app/db/models.py`
- Create: `backend/alembic/versions/035_ideas_module.py`
- Test: `backend/tests/test_idea_service.py`

- [ ] **Step 1: Add failing model/migration smoke tests**

Create `backend/tests/test_idea_service.py` with initial model import coverage:

```python
import unittest

from sqlalchemy import ForeignKeyConstraint, UniqueConstraint
from sqlalchemy.orm import configure_mappers

from app.db import models


class IdeaModelSmokeTests(unittest.TestCase):
    def test_idea_models_are_registered(self) -> None:
        table_names = set(models.Base.metadata.tables)

        self.assertIn("ideas", table_names)
        self.assertIn("idea_departments", table_names)
        self.assertIn("idea_tasks", table_names)
        self.assertIn("idea_comments", table_names)
        self.assertIn("idea_events", table_names)

    def test_idea_relationship_mappers_configure(self) -> None:
        configure_mappers()
        self.assertTrue(models.IdeaDepartment.task_links.property.viewonly)
        self.assertTrue(models.IdeaTask.idea_department.property.viewonly)

    def test_idea_task_department_link_is_scoped_to_same_idea(self) -> None:
        idea_departments = models.IdeaDepartment.__table__
        idea_tasks = models.IdeaTask.__table__

        unique_constraints = {
            constraint.name
            for constraint in idea_departments.constraints
            if isinstance(constraint, UniqueConstraint)
        }
        composite_fk_targets = {
            tuple(element.target_fullname for element in constraint.elements)
            for constraint in idea_tasks.constraints
            if isinstance(constraint, ForeignKeyConstraint)
        }

        self.assertIn("uq_idea_departments_idea_id_id", unique_constraints)
        self.assertIn(
            ("idea_departments.idea_id", "idea_departments.id"),
            composite_fk_targets,
        )
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_idea_service.py::IdeaModelSmokeTests::test_idea_models_are_registered -q
```

Expected: FAIL because the idea tables are not registered yet.

- [ ] **Step 3: Add SQLAlchemy models**

In `backend/app/db/models.py`, add the models after `TaskUpdate` and before `MeetingParticipant` so the task-adjacent domain stays together:

Keep these persistence safety rules in the implementation:

- Extend imports with `ForeignKeyConstraint`, `and_`, and `foreign` if they are not already present.
- Mandatory historical references to `team_members` (`Idea.author_id`, `Idea.review_owner_id`, `IdeaDepartment.owner_id`, and `IdeaComment.author_id`) use the default FK behavior, not cascade delete, so deleting a member cannot erase idea history.
- Optional actor references (`decision_by_id`, `created_by_id`, and `actor_id`) use `ondelete="SET NULL"`.
- `IdeaTask` must enforce that a department-scoped task link belongs to the same idea as its `IdeaDepartment`. Use a composite FK from `(idea_id, idea_department_id)` to `(idea_departments.idea_id, idea_departments.id)`.
- The composite `IdeaTask.idea_department` relationship is read-only (`viewonly=True`); repository/service code must set `idea_id` and `idea_department_id` explicitly.
- Do not create a separate `idx_idea_tasks_task_id`; `uq_idea_tasks_task_id` already creates an index for `task_id`.

```python
class Idea(Base):
    __tablename__ = "ideas"
    __table_args__ = (
        Index("idx_ideas_status", "status"),
        Index("idx_ideas_author_id", "author_id"),
        Index("idx_ideas_review_owner_id", "review_owner_id"),
        Index("idx_ideas_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default="new", server_default="new", nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id"), nullable=False
    )
    review_owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id"), nullable=False
    )
    decision_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    decision_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    decision_at: Mapped[datetime | None] = mapped_column(nullable=True)
    deferred_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    author: Mapped["TeamMember"] = relationship(foreign_keys=[author_id])
    review_owner: Mapped["TeamMember"] = relationship(foreign_keys=[review_owner_id])
    decision_by: Mapped["TeamMember | None"] = relationship(foreign_keys=[decision_by_id])
    departments: Mapped[list["IdeaDepartment"]] = relationship(
        back_populates="idea", cascade="all, delete-orphan"
    )
    task_links: Mapped[list["IdeaTask"]] = relationship(
        back_populates="idea", cascade="all, delete-orphan"
    )
    comments: Mapped[list["IdeaComment"]] = relationship(
        back_populates="idea", cascade="all, delete-orphan"
    )
    events: Mapped[list["IdeaEvent"]] = relationship(
        back_populates="idea", cascade="all, delete-orphan"
    )


class IdeaDepartment(Base):
    __tablename__ = "idea_departments"
    __table_args__ = (
        UniqueConstraint("idea_id", "department_id", name="uq_idea_departments_idea_department"),
        UniqueConstraint("idea_id", "id", name="uq_idea_departments_idea_id_id"),
        Index("idx_idea_departments_idea_id", "idea_id"),
        Index("idx_idea_departments_department_id", "department_id"),
        Index("idx_idea_departments_owner_id", "owner_id"),
        Index("idx_idea_departments_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    idea_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False
    )
    department_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(30), default="not_started", server_default="not_started", nullable=False
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    idea: Mapped["Idea"] = relationship(back_populates="departments")
    department: Mapped["Department"] = relationship()
    owner: Mapped["TeamMember"] = relationship(foreign_keys=[owner_id])
    created_by: Mapped["TeamMember | None"] = relationship(foreign_keys=[created_by_id])
    task_links: Mapped[list["IdeaTask"]] = relationship(
        back_populates="idea_department",
        primaryjoin=lambda: and_(
            IdeaDepartment.idea_id == IdeaTask.idea_id,
            IdeaDepartment.id == foreign(IdeaTask.idea_department_id),
        ),
        viewonly=True,
    )


class IdeaTask(Base):
    __tablename__ = "idea_tasks"
    __table_args__ = (
        UniqueConstraint("task_id", name="uq_idea_tasks_task_id"),
        ForeignKeyConstraint(
            ["idea_id", "idea_department_id"],
            ["idea_departments.idea_id", "idea_departments.id"],
            name="fk_idea_tasks_idea_department_same_idea",
        ),
        Index("idx_idea_tasks_idea_id", "idea_id"),
        Index("idx_idea_tasks_idea_department_id", "idea_department_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    idea_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False
    )
    idea_department_id: Mapped[uuid.UUID | None] = mapped_column(
        nullable=True
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    idea: Mapped["Idea"] = relationship(back_populates="task_links")
    idea_department: Mapped["IdeaDepartment | None"] = relationship(
        back_populates="task_links",
        primaryjoin=lambda: and_(
            IdeaDepartment.idea_id == IdeaTask.idea_id,
            IdeaDepartment.id == foreign(IdeaTask.idea_department_id),
        ),
        viewonly=True,
    )
    task: Mapped["Task"] = relationship()
    created_by: Mapped["TeamMember | None"] = relationship()


class IdeaComment(Base):
    __tablename__ = "idea_comments"
    __table_args__ = (
        Index("idx_idea_comments_idea_id", "idea_id"),
        Index("idx_idea_comments_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    idea_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    idea: Mapped["Idea"] = relationship(back_populates="comments")
    author: Mapped["TeamMember"] = relationship()


class IdeaEvent(Base):
    __tablename__ = "idea_events"
    __table_args__ = (
        Index("idx_idea_events_idea_id", "idea_id"),
        Index("idx_idea_events_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    idea_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, default=dict, server_default="{}", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    idea: Mapped["Idea"] = relationship(back_populates="events")
    actor: Mapped["TeamMember | None"] = relationship()
```

- [ ] **Step 4: Add the Alembic migration**

Create `backend/alembic/versions/035_ideas_module.py`:

```python
"""ideas module

Revision ID: 035_ideas_module
Revises: 034_meeting_board_focus_labels
Create Date: 2026-05-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "035_ideas_module"
down_revision: Union[str, None] = "034_meeting_board_focus_labels"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ideas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), server_default="new", nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id"), nullable=False),
        sa.Column("review_owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id"), nullable=False),
        sa.Column("decision_comment", sa.Text(), nullable=True),
        sa.Column("decision_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True),
        sa.Column("decision_at", sa.DateTime(), nullable=True),
        sa.Column("deferred_until", sa.Date(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_ideas_status", "ideas", ["status"])
    op.create_index("idx_ideas_author_id", "ideas", ["author_id"])
    op.create_index("idx_ideas_review_owner_id", "ideas", ["review_owner_id"])
    op.create_index("idx_ideas_created_at", "ideas", ["created_at"])

    op.create_table(
        "idea_departments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("idea_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("departments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id"), nullable=False),
        sa.Column("status", sa.String(length=30), server_default="not_started", nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("idea_id", "department_id", name="uq_idea_departments_idea_department"),
        sa.UniqueConstraint("idea_id", "id", name="uq_idea_departments_idea_id_id"),
    )
    op.create_index("idx_idea_departments_idea_id", "idea_departments", ["idea_id"])
    op.create_index("idx_idea_departments_department_id", "idea_departments", ["department_id"])
    op.create_index("idx_idea_departments_owner_id", "idea_departments", ["owner_id"])
    op.create_index("idx_idea_departments_status", "idea_departments", ["status"])

    op.create_table(
        "idea_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("idea_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("idea_department_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["idea_id", "idea_department_id"],
            ["idea_departments.idea_id", "idea_departments.id"],
            name="fk_idea_tasks_idea_department_same_idea",
        ),
        sa.UniqueConstraint("task_id", name="uq_idea_tasks_task_id"),
    )
    op.create_index("idx_idea_tasks_idea_id", "idea_tasks", ["idea_id"])
    op.create_index("idx_idea_tasks_idea_department_id", "idea_tasks", ["idea_department_id"])

    op.create_table(
        "idea_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("idea_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id"), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_idea_comments_idea_id", "idea_comments", ["idea_id"])
    op.create_index("idx_idea_comments_created_at", "idea_comments", ["created_at"])

    op.create_table(
        "idea_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("idea_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_idea_events_idea_id", "idea_events", ["idea_id"])
    op.create_index("idx_idea_events_created_at", "idea_events", ["created_at"])


def downgrade() -> None:
    op.drop_index("idx_idea_events_created_at", table_name="idea_events")
    op.drop_index("idx_idea_events_idea_id", table_name="idea_events")
    op.drop_table("idea_events")
    op.drop_index("idx_idea_comments_created_at", table_name="idea_comments")
    op.drop_index("idx_idea_comments_idea_id", table_name="idea_comments")
    op.drop_table("idea_comments")
    op.drop_index("idx_idea_tasks_idea_department_id", table_name="idea_tasks")
    op.drop_index("idx_idea_tasks_idea_id", table_name="idea_tasks")
    op.drop_table("idea_tasks")
    op.drop_index("idx_idea_departments_status", table_name="idea_departments")
    op.drop_index("idx_idea_departments_owner_id", table_name="idea_departments")
    op.drop_index("idx_idea_departments_department_id", table_name="idea_departments")
    op.drop_index("idx_idea_departments_idea_id", table_name="idea_departments")
    op.drop_table("idea_departments")
    op.drop_index("idx_ideas_created_at", table_name="ideas")
    op.drop_index("idx_ideas_review_owner_id", table_name="ideas")
    op.drop_index("idx_ideas_author_id", table_name="ideas")
    op.drop_index("idx_ideas_status", table_name="ideas")
    op.drop_table("ideas")
```

- [ ] **Step 5: Run the model smoke test**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_idea_service.py::IdeaModelSmokeTests::test_idea_models_are_registered -q
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add backend/app/db/models.py backend/alembic/versions/035_ideas_module.py backend/tests/test_idea_service.py
git commit -m "Add ideas data model"
```

---

### Task 2: Backend Schemas And Repository

**Files:**
- Modify: `backend/app/db/schemas.py`
- Modify: `backend/app/db/repositories.py`
- Test: `backend/tests/test_idea_service.py`

- [ ] **Step 1: Add schema validation tests**

Append to `backend/tests/test_idea_service.py`:

```python
from pydantic import ValidationError

from app.db.schemas import IdeaCreate, IdeaStatusChange


class IdeaSchemaTests(unittest.TestCase):
    def test_create_idea_requires_non_empty_title_and_description(self) -> None:
        with self.assertRaises(ValidationError):
            IdeaCreate(title="", description="Useful details", review_owner_id="00000000-0000-0000-0000-000000000001")

        with self.assertRaises(ValidationError):
            IdeaCreate(title="Improve reports", description="", review_owner_id="00000000-0000-0000-0000-000000000001")

    def test_rejected_and_deferred_status_changes_require_reason(self) -> None:
        with self.assertRaises(ValidationError):
            IdeaStatusChange(status="rejected", comment="")

        with self.assertRaises(ValidationError):
            IdeaStatusChange(status="deferred", comment="   ")

    def test_accepted_status_change_allows_empty_comment(self) -> None:
        data = IdeaStatusChange(status="accepted")
        self.assertEqual(data.status, "accepted")
        self.assertIsNone(data.comment)
```

- [ ] **Step 2: Run schema tests and verify they fail**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_idea_service.py::IdeaSchemaTests -q
```

Expected: FAIL because schemas are not defined yet.

- [ ] **Step 3: Add Pydantic types and schemas**

In `backend/app/db/schemas.py`, add literal types near the existing domain value types:

```python
IdeaStatusType = Literal[
    "new",
    "in_review",
    "accepted",
    "in_tasks",
    "completed",
    "rejected",
    "deferred",
]
IdeaDepartmentStatusType = Literal["not_started", "in_progress", "ready", "not_required"]
IdeaEventType = Literal[
    "idea_created",
    "status_changed",
    "decision_recorded",
    "department_added",
    "department_updated",
    "task_linked",
    "comment_added",
    "idea_completed",
    "idea_reopened",
]
```

Add schemas after `TaskResponse`:

```python
class IdeaCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(min_length=1)
    review_owner_id: uuid.UUID
    department_ids: list[uuid.UUID] = Field(default_factory=list)

    @field_validator("title", "description", mode="before")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value


class IdeaUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = Field(default=None, min_length=1)
    review_owner_id: uuid.UUID | None = None

    @field_validator("title", "description", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            return value.strip()
        return value


class IdeaStatusChange(BaseModel):
    status: IdeaStatusType
    comment: str | None = None
    deferred_until: date | None = None

    @field_validator("comment", mode="before")
    @classmethod
    def strip_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("comment")
    @classmethod
    def require_reason_for_negative_decisions(
        cls, value: str | None, info
    ) -> str | None:
        status = info.data.get("status")
        if status in {"rejected", "deferred"} and not value:
            raise ValueError("Reason is required for rejected or deferred ideas")
        return value


class IdeaDepartmentCreate(BaseModel):
    department_id: uuid.UUID
    owner_id: uuid.UUID


class IdeaDepartmentUpdate(BaseModel):
    owner_id: uuid.UUID | None = None
    status: IdeaDepartmentStatusType | None = None
    note: str | None = None


class IdeaCommentCreate(BaseModel):
    body: str = Field(min_length=1)

    @field_validator("body", mode="before")
    @classmethod
    def strip_body(cls, value: str) -> str:
        if isinstance(value, str):
            return value.strip()
        return value


class IdeaLinkedTaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    priority: TaskPriorityType = "normal"
    assignee_id: uuid.UUID | None = None
    deadline: date | None = None
    label_ids: list[uuid.UUID] = Field(default_factory=list)

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, value: str | None) -> str:
        return normalize_task_urgency(value)


class IdeaEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    idea_id: uuid.UUID
    actor_id: uuid.UUID | None
    event_type: str
    payload: dict
    created_at: datetime
    actor: TeamMemberResponse | None = None


class IdeaCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    idea_id: uuid.UUID
    author_id: uuid.UUID
    body: str
    created_at: datetime
    updated_at: datetime
    author: TeamMemberResponse | None = None


class IdeaTaskResponse(BaseModel):
    id: uuid.UUID
    idea_id: uuid.UUID
    idea_department_id: uuid.UUID | None
    task_id: uuid.UUID
    created_by_id: uuid.UUID | None
    created_at: datetime
    task: TaskResponse | None = None
    hidden: bool = False


class IdeaDepartmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    idea_id: uuid.UUID
    department_id: uuid.UUID
    owner_id: uuid.UUID
    status: str
    note: str | None
    created_by_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    department: DepartmentResponse | None = None
    owner: TeamMemberResponse | None = None
    task_links: list[IdeaTaskResponse] = Field(default_factory=list)


class IdeaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str
    status: str
    author_id: uuid.UUID
    review_owner_id: uuid.UUID
    decision_comment: str | None
    decision_by_id: uuid.UUID | None
    decision_at: datetime | None
    deferred_until: date | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    author: TeamMemberResponse | None = None
    review_owner: TeamMemberResponse | None = None
    decision_by: TeamMemberResponse | None = None
    departments: list[IdeaDepartmentResponse] = Field(default_factory=list)
    task_links: list[IdeaTaskResponse] = Field(default_factory=list)
    comments: list[IdeaCommentResponse] = Field(default_factory=list)
    events: list[IdeaEventResponse] = Field(default_factory=list)
    linked_task_count: int = 0
    visible_linked_task_count: int = 0
    completed_linked_task_count: int = 0
    hidden_linked_task_count: int = 0
    ready_department_count: int = 0
    required_department_count: int = 0
    can_complete: bool = False


class PaginatedIdeasResponse(BaseModel):
    items: list[IdeaResponse]
    total: int
    page: int
    per_page: int
    pages: int
```

- [ ] **Step 4: Add repository helpers**

In `backend/app/db/repositories.py`, extend imports with:

```python
from sqlalchemy.orm import selectinload
from app.db.models import Idea, IdeaComment, IdeaDepartment, IdeaEvent, IdeaTask
```

Add `IdeaRepository` near other repositories:

```python
class IdeaRepository:
    def detail_options(self):
        return (
            selectinload(Idea.author),
            selectinload(Idea.review_owner),
            selectinload(Idea.decision_by),
            selectinload(Idea.departments).selectinload(IdeaDepartment.department),
            selectinload(Idea.departments).selectinload(IdeaDepartment.owner),
            selectinload(Idea.departments)
            .selectinload(IdeaDepartment.task_links)
            .selectinload(IdeaTask.task)
            .selectinload(Task.assignee),
            selectinload(Idea.departments)
            .selectinload(IdeaDepartment.task_links)
            .selectinload(IdeaTask.task)
            .selectinload(Task.created_by),
            selectinload(Idea.task_links).selectinload(IdeaTask.task).selectinload(Task.assignee),
            selectinload(Idea.task_links).selectinload(IdeaTask.task).selectinload(Task.created_by),
            selectinload(Idea.comments).selectinload(IdeaComment.author),
            selectinload(Idea.events).selectinload(IdeaEvent.actor),
        )

    async def get_by_id(self, session: AsyncSession, idea_id: uuid.UUID) -> Idea | None:
        stmt = select(Idea).where(Idea.id == idea_id).options(*self.detail_options())
        result = await session.execute(stmt)
        return result.scalars().first()

    async def list(
        self,
        session: AsyncSession,
        *,
        status: str | None = None,
        author_id: uuid.UUID | None = None,
        review_owner_id: uuid.UUID | None = None,
        department_id: uuid.UUID | None = None,
        created_from: date | None = None,
        created_to: date | None = None,
        page: int = 1,
        per_page: int = 50,
    ) -> tuple[list[Idea], int]:
        stmt = select(Idea).options(*self.detail_options())
        if status:
            stmt = stmt.where(Idea.status.in_([item.strip() for item in status.split(",") if item.strip()]))
        if author_id:
            stmt = stmt.where(Idea.author_id == author_id)
        if review_owner_id:
            stmt = stmt.where(Idea.review_owner_id == review_owner_id)
        if department_id:
            stmt = stmt.join(Idea.departments).where(IdeaDepartment.department_id == department_id)
        if created_from:
            stmt = stmt.where(Idea.created_at >= datetime.combine(created_from, datetime.min.time()))
        if created_to:
            stmt = stmt.where(Idea.created_at <= datetime.combine(created_to, datetime.max.time()))

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar_one()
        result = await session.execute(
            stmt.order_by(Idea.updated_at.desc()).offset((page - 1) * per_page).limit(per_page)
        )
        return list(result.scalars().unique().all()), total

    async def create(
        self,
        session: AsyncSession,
        *,
        title: str,
        description: str,
        author_id: uuid.UUID,
        review_owner_id: uuid.UUID,
    ) -> Idea:
        idea = Idea(
            title=title,
            description=description,
            author_id=author_id,
            review_owner_id=review_owner_id,
        )
        session.add(idea)
        await session.flush()
        return idea

    async def update(self, session: AsyncSession, idea: Idea, **fields) -> Idea:
        for key, value in fields.items():
            setattr(idea, key, value)
        await session.flush()
        return idea

    async def add_department(
        self,
        session: AsyncSession,
        *,
        idea_id: uuid.UUID,
        department_id: uuid.UUID,
        owner_id: uuid.UUID,
        created_by_id: uuid.UUID,
    ) -> IdeaDepartment:
        item = IdeaDepartment(
            idea_id=idea_id,
            department_id=department_id,
            owner_id=owner_id,
            created_by_id=created_by_id,
        )
        session.add(item)
        await session.flush()
        return item

    async def add_comment(
        self,
        session: AsyncSession,
        *,
        idea_id: uuid.UUID,
        author_id: uuid.UUID,
        body: str,
    ) -> IdeaComment:
        comment = IdeaComment(idea_id=idea_id, author_id=author_id, body=body)
        session.add(comment)
        await session.flush()
        return comment

    async def add_task_link(
        self,
        session: AsyncSession,
        *,
        idea_id: uuid.UUID,
        task_id: uuid.UUID,
        created_by_id: uuid.UUID,
        idea_department_id: uuid.UUID | None = None,
    ) -> IdeaTask:
        link = IdeaTask(
            idea_id=idea_id,
            idea_department_id=idea_department_id,
            task_id=task_id,
            created_by_id=created_by_id,
        )
        session.add(link)
        await session.flush()
        return link

    async def add_event(
        self,
        session: AsyncSession,
        *,
        idea_id: uuid.UUID,
        actor_id: uuid.UUID | None,
        event_type: str,
        payload: dict | None = None,
    ) -> IdeaEvent:
        event = IdeaEvent(
            idea_id=idea_id,
            actor_id=actor_id,
            event_type=event_type,
            payload=payload or {},
        )
        session.add(event)
        await session.flush()
        return event
```

- [ ] **Step 5: Run schema tests**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_idea_service.py::IdeaSchemaTests -q
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add backend/app/db/schemas.py backend/app/db/repositories.py backend/tests/test_idea_service.py
git commit -m "Add ideas schemas and repository"
```

---

### Task 3: Idea Service Business Rules

**Files:**
- Create: `backend/app/services/idea_service.py`
- Test: `backend/tests/test_idea_service.py`

- [ ] **Step 1: Add service rule tests**

Append to `backend/tests/test_idea_service.py`:

```python
import uuid
from types import SimpleNamespace

from app.services.idea_service import IdeaService


def member(role: str = "member", *, member_id: uuid.UUID | None = None):
    return SimpleNamespace(id=member_id or uuid.uuid4(), role=role)


def idea(**overrides):
    base = {
        "id": uuid.uuid4(),
        "status": "accepted",
        "review_owner_id": uuid.uuid4(),
        "departments": [],
        "task_links": [],
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def idea_department(**overrides):
    base = {
        "id": uuid.uuid4(),
        "department_id": uuid.uuid4(),
        "owner_id": uuid.uuid4(),
        "status": "not_started",
        "task_links": [],
        "department": SimpleNamespace(head_id=None),
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def department(**overrides):
    base = {"id": uuid.uuid4(), "head_id": None, "is_active": True}
    base.update(overrides)
    return SimpleNamespace(**base)


def task_link(status: str):
    return SimpleNamespace(task=SimpleNamespace(status=status))


class IdeaServiceRuleTests(unittest.TestCase):
    def test_rejected_and_deferred_require_reason(self) -> None:
        service = IdeaService()
        with self.assertRaises(ValueError):
            service.validate_status_change("rejected", None)
        with self.assertRaises(ValueError):
            service.validate_status_change("deferred", "")

    def test_review_owner_can_manage_idea(self) -> None:
        service = IdeaService()
        owner = member()
        target = idea(review_owner_id=owner.id)

        self.assertTrue(service.can_manage_idea(owner, target))

    def test_department_head_can_manage_own_department(self) -> None:
        service = IdeaService()
        head = member()
        dept = idea_department(department=SimpleNamespace(head_id=head.id))
        target = idea(departments=[dept])

        self.assertTrue(service.can_manage_idea_department(head, target, dept))

    def test_department_head_can_add_own_department_to_accepted_idea(self) -> None:
        service = IdeaService()
        head = member()
        target = idea(status="accepted")

        self.assertTrue(service.can_add_department(head, target, department(head_id=head.id)))

    def test_no_department_completion_requires_closed_direct_tasks(self) -> None:
        service = IdeaService()
        self.assertFalse(service.can_complete_idea(idea(task_links=[])))
        self.assertFalse(service.can_complete_idea(idea(task_links=[task_link("new")])))
        self.assertTrue(service.can_complete_idea(idea(task_links=[task_link("done"), task_link("cancelled")])))

    def test_department_completion_requires_ready_or_not_required(self) -> None:
        service = IdeaService()
        ready = idea_department(status="ready")
        skipped = idea_department(status="not_required")
        active = idea_department(status="in_progress")

        self.assertTrue(service.can_complete_idea(idea(departments=[ready, skipped])))
        self.assertFalse(service.can_complete_idea(idea(departments=[ready, active])))
```

- [ ] **Step 2: Run service tests and verify they fail**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_idea_service.py::IdeaServiceRuleTests -q
```

Expected: FAIL because `IdeaService` does not exist yet.

- [ ] **Step 3: Implement `IdeaService`**

Create `backend/app/services/idea_service.py`:

```python
import math
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Department, Idea, IdeaDepartment, IdeaTask, TeamMember
from app.db.repositories import IdeaRepository
from app.db.schemas import IdeaResponse, IdeaTaskResponse, PaginatedIdeasResponse
from app.services.permission_service import PermissionService
from app.services.task_visibility_service import can_access_task

CLOSED_TASK_STATUSES = {"done", "cancelled"}
COMPLETED_DEPARTMENT_STATUSES = {"ready", "not_required"}
DECISION_STATUSES = {"accepted", "rejected", "deferred"}


class IdeaService:
    def __init__(self, repo: IdeaRepository | None = None) -> None:
        self.repo = repo or IdeaRepository()

    def validate_status_change(self, status: str, comment: str | None) -> None:
        if status in {"rejected", "deferred"} and not (comment or "").strip():
            raise ValueError("Причина обязательна для отклонённой или отложенной идеи")

    def can_manage_idea(self, member: TeamMember, idea: Idea) -> bool:
        return PermissionService.is_moderator(member) or idea.review_owner_id == member.id

    def can_manage_idea_department(
        self,
        member: TeamMember,
        idea: Idea,
        idea_department: IdeaDepartment,
    ) -> bool:
        if self.can_manage_idea(member, idea):
            return True
        if idea_department.owner_id == member.id:
            return True
        department = getattr(idea_department, "department", None)
        return getattr(department, "head_id", None) == member.id

    def can_add_department(
        self,
        member: TeamMember,
        idea: Idea,
        department: Department,
    ) -> bool:
        if idea.status not in {"accepted", "in_tasks"}:
            return False
        if self.can_manage_idea(member, idea):
            return True
        return getattr(department, "head_id", None) == member.id

    def can_complete_idea(self, idea: Idea) -> bool:
        departments = list(getattr(idea, "departments", []) or [])
        if departments:
            return all(item.status in COMPLETED_DEPARTMENT_STATUSES for item in departments)

        task_links = list(getattr(idea, "task_links", []) or [])
        if not task_links:
            return False
        return all(getattr(link.task, "status", None) in CLOSED_TASK_STATUSES for link in task_links)

    def can_mark_department_ready(self, idea_department: IdeaDepartment) -> bool:
        task_links = list(getattr(idea_department, "task_links", []) or [])
        if not task_links:
            return True
        return all(getattr(link.task, "status", None) in CLOSED_TASK_STATUSES for link in task_links)

    async def shape_task_link(
        self,
        session: AsyncSession,
        member: TeamMember,
        link: IdeaTask,
    ) -> IdeaTaskResponse:
        if await can_access_task(session, member, link.task):
            return IdeaTaskResponse(
                id=link.id,
                idea_id=link.idea_id,
                idea_department_id=link.idea_department_id,
                task_id=link.task_id,
                created_by_id=link.created_by_id,
                created_at=link.created_at,
                task=link.task,
                hidden=False,
            )
        return IdeaTaskResponse(
            id=link.id,
            idea_id=link.idea_id,
            idea_department_id=link.idea_department_id,
            task_id=link.task_id,
            created_by_id=link.created_by_id,
            created_at=link.created_at,
            task=None,
            hidden=True,
        )

    async def shape_response(
        self,
        session: AsyncSession,
        member: TeamMember,
        idea: Idea,
        *,
        include_comments: bool = True,
        include_events: bool = True,
    ) -> IdeaResponse:
        shaped_links = [
            await self.shape_task_link(session, member, link)
            for link in list(getattr(idea, "task_links", []) or [])
        ]
        visible_count = sum(1 for link in shaped_links if not link.hidden)
        hidden_count = sum(1 for link in shaped_links if link.hidden)
        completed_count = sum(
            1
            for link in list(getattr(idea, "task_links", []) or [])
            if getattr(link.task, "status", None) in CLOSED_TASK_STATUSES
        )
        departments = list(getattr(idea, "departments", []) or [])
        ready_department_count = sum(
            1 for item in departments if item.status in COMPLETED_DEPARTMENT_STATUSES
        )

        response = IdeaResponse.model_validate(idea).model_copy(
            update={
                "task_links": shaped_links,
                "comments": getattr(idea, "comments", []) if include_comments else [],
                "events": getattr(idea, "events", []) if include_events else [],
                "linked_task_count": len(shaped_links),
                "visible_linked_task_count": visible_count,
                "completed_linked_task_count": completed_count,
                "hidden_linked_task_count": hidden_count,
                "ready_department_count": ready_department_count,
                "required_department_count": len(
                    [item for item in departments if item.status != "not_required"]
                ),
                "can_complete": self.can_complete_idea(idea),
            }
        )
        return response

    async def list_ideas(self, session: AsyncSession, member: TeamMember, **filters) -> PaginatedIdeasResponse:
        items, total = await self.repo.list(session, **filters)
        page = filters.get("page", 1)
        per_page = filters.get("per_page", 50)
        shaped = [
            await self.shape_response(session, member, item, include_comments=False, include_events=False)
            for item in items
        ]
        return PaginatedIdeasResponse(
            items=shaped,
            total=total,
            page=page,
            per_page=per_page,
            pages=max(1, math.ceil(total / per_page)),
        )

    async def record_status_change(
        self,
        session: AsyncSession,
        *,
        idea: Idea,
        member: TeamMember,
        status: str,
        comment: str | None,
        deferred_until,
    ) -> Idea:
        if not self.can_manage_idea(member, idea):
            raise PermissionError("Нет прав на изменение статуса этой идеи")
        self.validate_status_change(status, comment)
        fields = {"status": status}
        if status in DECISION_STATUSES:
            fields.update(
                {
                    "decision_comment": comment,
                    "decision_by_id": member.id,
                    "decision_at": datetime.utcnow(),
                    "deferred_until": deferred_until if status == "deferred" else None,
                }
            )
        if status == "completed":
            if not self.can_complete_idea(idea):
                raise ValueError("Идею можно завершить только после завершения всех частей")
            fields["completed_at"] = datetime.utcnow()
        else:
            fields["completed_at"] = None

        previous_status = idea.status
        idea = await self.repo.update(session, idea, **fields)
        await self.repo.add_event(
            session,
            idea_id=idea.id,
            actor_id=member.id,
            event_type="status_changed",
            payload={"from": previous_status, "to": status, "comment": comment},
        )
        if status in DECISION_STATUSES:
            await self.repo.add_event(
                session,
                idea_id=idea.id,
                actor_id=member.id,
                event_type="decision_recorded",
                payload={"status": status, "comment": comment, "deferred_until": str(deferred_until) if deferred_until else None},
            )
        return idea
```

- [ ] **Step 4: Run service tests**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_idea_service.py::IdeaServiceRuleTests -q
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add backend/app/services/idea_service.py backend/tests/test_idea_service.py
git commit -m "Add ideas service rules"
```

---

### Task 4: Ideas API

**Files:**
- Create: `backend/app/api/ideas.py`
- Modify: `backend/app/api/router.py`
- Test: `backend/tests/test_ideas_api.py`

- [ ] **Step 1: Add API tests**

Create `backend/tests/test_ideas_api.py`:

```python
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.api import ideas as ideas_api
from app.db.schemas import IdeaCreate, IdeaStatusChange


class IdeasApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_create_idea_returns_service_response(self) -> None:
        member = SimpleNamespace(id=uuid.uuid4(), role="member")
        idea_id = uuid.uuid4()
        response = SimpleNamespace(id=idea_id)
        session = SimpleNamespace(commit=AsyncMock())

        with patch.object(
            ideas_api.idea_service.repo,
            "create",
            AsyncMock(return_value=SimpleNamespace(id=idea_id)),
        ), patch.object(
            ideas_api.idea_service.repo,
            "add_event",
            AsyncMock(),
        ), patch.object(
            ideas_api.idea_service.repo,
            "get_by_id",
            AsyncMock(return_value=SimpleNamespace(id=idea_id)),
        ), patch.object(
            ideas_api.idea_service,
            "shape_response",
            AsyncMock(return_value=response),
        ):
            result = await ideas_api.create_idea(
                data=IdeaCreate(
                    title="Improve reports",
                    description="Make daily KPI review faster",
                    review_owner_id=uuid.uuid4(),
                ),
                member=member,
                session=session,
            )

        self.assertEqual(result.id, idea_id)
        session.commit.assert_awaited_once()

    async def test_status_change_requires_existing_idea(self) -> None:
        member = SimpleNamespace(id=uuid.uuid4(), role="member")
        session = SimpleNamespace()

        with patch.object(
            ideas_api.idea_service.repo,
            "get_by_id",
            AsyncMock(return_value=None),
        ):
            with self.assertRaises(ideas_api.HTTPException) as ctx:
                await ideas_api.change_idea_status(
                    idea_id=uuid.uuid4(),
                    data=IdeaStatusChange(status="accepted"),
                    member=member,
                    session=session,
                )

        self.assertEqual(ctx.exception.status_code, 404)
```

- [ ] **Step 2: Run API tests and verify they fail**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_ideas_api.py -q
```

Expected: FAIL because `app.api.ideas` does not exist yet.

- [ ] **Step 3: Implement API routes**

Create `backend/app/api/ideas.py`:

```python
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.db.database import get_session
from app.db.models import Department, TeamMember
from app.db.schemas import (
    IdeaCommentCreate,
    IdeaCreate,
    IdeaDepartmentCreate,
    IdeaDepartmentUpdate,
    IdeaLinkedTaskCreate,
    IdeaResponse,
    IdeaStatusChange,
    IdeaUpdate,
    PaginatedIdeasResponse,
)
from app.services.idea_service import IdeaService
from app.services.notification_service import NotificationService
from app.services.task_service import TaskService

router = APIRouter(prefix="/ideas", tags=["ideas"])
idea_service = IdeaService()
task_service = TaskService()


async def _get_idea_or_404(session: AsyncSession, idea_id: uuid.UUID):
    idea = await idea_service.repo.get_by_id(session, idea_id)
    if not idea:
        raise HTTPException(status_code=404, detail="Идея не найдена")
    return idea


@router.get("", response_model=PaginatedIdeasResponse)
async def list_ideas(
    status_filter: str | None = Query(None, alias="status"),
    author_id: uuid.UUID | None = Query(None),
    review_owner_id: uuid.UUID | None = Query(None),
    department_id: uuid.UUID | None = Query(None),
    created_from: date | None = Query(None),
    created_to: date | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return await idea_service.list_ideas(
        session,
        member,
        status=status_filter,
        author_id=author_id,
        review_owner_id=review_owner_id,
        department_id=department_id,
        created_from=created_from,
        created_to=created_to,
        page=page,
        per_page=per_page,
    )


@router.post("", response_model=IdeaResponse, status_code=status.HTTP_201_CREATED)
async def create_idea(
    data: IdeaCreate,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    idea = await idea_service.repo.create(
        session,
        title=data.title,
        description=data.description,
        author_id=member.id,
        review_owner_id=data.review_owner_id,
    )
    await idea_service.repo.add_event(
        session,
        idea_id=idea.id,
        actor_id=member.id,
        event_type="idea_created",
        payload={"title": idea.title},
    )
    for department_id in data.department_ids:
        await idea_service.repo.add_department(
            session,
            idea_id=idea.id,
            department_id=department_id,
            owner_id=data.review_owner_id,
            created_by_id=member.id,
        )
    await session.commit()
    refreshed = await idea_service.repo.get_by_id(session, idea.id)
    return await idea_service.shape_response(session, member, refreshed)


@router.get("/{idea_id}", response_model=IdeaResponse)
async def get_idea(
    idea_id: uuid.UUID,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    idea = await _get_idea_or_404(session, idea_id)
    return await idea_service.shape_response(session, member, idea)


@router.patch("/{idea_id}", response_model=IdeaResponse)
async def update_idea(
    idea_id: uuid.UUID,
    data: IdeaUpdate,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    idea = await _get_idea_or_404(session, idea_id)
    if not idea_service.can_manage_idea(member, idea):
        raise HTTPException(status_code=403, detail="Нет прав на изменение этой идеи")
    fields = data.model_dump(exclude_unset=True)
    idea = await idea_service.repo.update(session, idea, **fields)
    await idea_service.repo.add_event(
        session,
        idea_id=idea.id,
        actor_id=member.id,
        event_type="idea_updated",
        payload={"fields": sorted(fields.keys())},
    )
    await session.commit()
    refreshed = await idea_service.repo.get_by_id(session, idea.id)
    return await idea_service.shape_response(session, member, refreshed)


@router.post("/{idea_id}/status", response_model=IdeaResponse)
async def change_idea_status(
    idea_id: uuid.UUID,
    data: IdeaStatusChange,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    idea = await _get_idea_or_404(session, idea_id)
    try:
        idea = await idea_service.record_status_change(
            session,
            idea=idea,
            member=member,
            status=data.status,
            comment=data.comment,
            deferred_until=data.deferred_until,
        )
        await session.commit()
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    refreshed = await idea_service.repo.get_by_id(session, idea.id)
    return await idea_service.shape_response(session, member, refreshed)


@router.post("/{idea_id}/comments", response_model=IdeaResponse)
async def add_idea_comment(
    idea_id: uuid.UUID,
    data: IdeaCommentCreate,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    idea = await _get_idea_or_404(session, idea_id)
    await idea_service.repo.add_comment(
        session,
        idea_id=idea.id,
        author_id=member.id,
        body=data.body,
    )
    await idea_service.repo.add_event(
        session,
        idea_id=idea.id,
        actor_id=member.id,
        event_type="comment_added",
        payload={},
    )
    await session.commit()
    refreshed = await idea_service.repo.get_by_id(session, idea.id)
    return await idea_service.shape_response(session, member, refreshed)
```

Add department/task endpoints in the same file:

```python
@router.post("/{idea_id}/departments", response_model=IdeaResponse)
async def add_idea_department(
    idea_id: uuid.UUID,
    data: IdeaDepartmentCreate,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    idea = await _get_idea_or_404(session, idea_id)
    department = await session.get(Department, data.department_id)
    if not department or not department.is_active:
        raise HTTPException(status_code=404, detail="Отдел не найден")
    if idea.status not in {"accepted", "in_tasks"}:
        raise HTTPException(status_code=400, detail="Отделы можно добавлять только к принятой идее")
    if not idea_service.can_add_department(member, idea, department):
        raise HTTPException(status_code=403, detail="Нет прав на добавление этого отдела")
    try:
        await idea_service.repo.add_department(
            session,
            idea_id=idea.id,
            department_id=data.department_id,
            owner_id=data.owner_id,
            created_by_id=member.id,
        )
    except Exception as error:
        if "uq_idea_departments_idea_department" in str(error):
            raise HTTPException(status_code=409, detail="Этот отдел уже добавлен к идее")
        raise
    await idea_service.repo.add_event(
        session,
        idea_id=idea.id,
        actor_id=member.id,
        event_type="department_added",
        payload={"department_id": str(data.department_id), "owner_id": str(data.owner_id)},
    )
    await session.commit()
    refreshed = await idea_service.repo.get_by_id(session, idea.id)
    return await idea_service.shape_response(session, member, refreshed)


@router.patch("/{idea_id}/departments/{idea_department_id}", response_model=IdeaResponse)
async def update_idea_department(
    idea_id: uuid.UUID,
    idea_department_id: uuid.UUID,
    data: IdeaDepartmentUpdate,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    idea = await _get_idea_or_404(session, idea_id)
    item = next((dept for dept in idea.departments if dept.id == idea_department_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Отдел идеи не найден")
    if not idea_service.can_manage_idea_department(member, idea, item):
        raise HTTPException(status_code=403, detail="Нет прав на изменение этого отдела")
    fields = data.model_dump(exclude_unset=True)
    if fields.get("status") == "ready" and not idea_service.can_mark_department_ready(item):
        raise HTTPException(status_code=400, detail="Нельзя закрыть отдел, пока есть открытые задачи")
    for key, value in fields.items():
        setattr(item, key, value)
    await idea_service.repo.add_event(
        session,
        idea_id=idea.id,
        actor_id=member.id,
        event_type="department_updated",
        payload={"idea_department_id": str(item.id), "fields": sorted(fields.keys())},
    )
    await session.commit()
    refreshed = await idea_service.repo.get_by_id(session, idea.id)
    return await idea_service.shape_response(session, member, refreshed)


@router.post("/{idea_id}/tasks", response_model=IdeaResponse)
async def create_idea_task(
    request: Request,
    idea_id: uuid.UUID,
    data: IdeaLinkedTaskCreate,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    idea = await _get_idea_or_404(session, idea_id)
    if not idea_service.can_manage_idea(member, idea):
        raise HTTPException(status_code=403, detail="Нет прав на создание задачи по этой идее")
    return await _create_linked_task(request, session, member, idea, data, None)


@router.post("/{idea_id}/departments/{idea_department_id}/tasks", response_model=IdeaResponse)
async def create_idea_department_task(
    request: Request,
    idea_id: uuid.UUID,
    idea_department_id: uuid.UUID,
    data: IdeaLinkedTaskCreate,
    member: TeamMember = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    idea = await _get_idea_or_404(session, idea_id)
    item = next((dept for dept in idea.departments if dept.id == idea_department_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Отдел идеи не найден")
    if not idea_service.can_manage_idea_department(member, idea, item):
        raise HTTPException(status_code=403, detail="Нет прав на создание задачи для этого отдела")
    return await _create_linked_task(request, session, member, idea, data, item.id)


async def _create_linked_task(
    request: Request,
    session: AsyncSession,
    member: TeamMember,
    idea,
    data: IdeaLinkedTaskCreate,
    idea_department_id: uuid.UUID | None,
):
    try:
        task = await task_service.create_task(
            session,
            title=data.title,
            creator=member,
            assignee_id=data.assignee_id,
            description=data.description,
            checklist=[],
            priority=data.priority,
            deadline=data.deadline,
            source="web",
            label_ids=data.label_ids,
        )
        await idea_service.repo.add_task_link(
            session,
            idea_id=idea.id,
            idea_department_id=idea_department_id,
            task_id=task.id,
            created_by_id=member.id,
        )
        if idea.status == "accepted":
            await idea_service.repo.update(session, idea, status="in_tasks")
        await idea_service.repo.add_event(
            session,
            idea_id=idea.id,
            actor_id=member.id,
            event_type="task_linked",
            payload={"task_id": str(task.id), "idea_department_id": str(idea_department_id) if idea_department_id else None},
        )
        bot = getattr(request.app.state, "bot", None)
        if bot:
            notification_service = NotificationService(bot)
            await notification_service.notify_task_created(session, task, member)
        await session.commit()
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    refreshed = await idea_service.repo.get_by_id(session, idea.id)
    return await idea_service.shape_response(session, member, refreshed)
```

- [ ] **Step 4: Register router**

In `backend/app/api/router.py`, add:

```python
from app.api.ideas import router as ideas_router
```

and include it:

```python
api_router.include_router(ideas_router)
```

- [ ] **Step 5: Run API tests**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_ideas_api.py -q
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add backend/app/api/ideas.py backend/app/api/router.py backend/tests/test_ideas_api.py
git commit -m "Add ideas API"
```

---

### Task 5: Frontend Types, API Client, And Pure Helpers

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/ideaUtils.ts`
- Create: `frontend/src/lib/ideaUtils.test.ts`

- [ ] **Step 1: Add failing helper tests**

Create `frontend/src/lib/ideaUtils.test.ts`:

```typescript
import { describe, expect, test } from "vitest";
import {
  canCompleteIdea,
  countReadyIdeaDepartments,
  IDEA_STATUS_LABELS,
} from "./ideaUtils";
import type { Idea } from "./types";

function idea(overrides: Partial<Idea>): Idea {
  return {
    id: "idea-1",
    title: "Improve reports",
    description: "Make reports easier",
    status: "accepted",
    author_id: "member-1",
    review_owner_id: "member-2",
    decision_comment: null,
    decision_by_id: null,
    decision_at: null,
    deferred_until: null,
    completed_at: null,
    created_at: "2026-05-12T00:00:00Z",
    updated_at: "2026-05-12T00:00:00Z",
    author: null,
    review_owner: null,
    decision_by: null,
    departments: [],
    task_links: [],
    comments: [],
    events: [],
    linked_task_count: 0,
    visible_linked_task_count: 0,
    completed_linked_task_count: 0,
    hidden_linked_task_count: 0,
    ready_department_count: 0,
    required_department_count: 0,
    can_complete: false,
    ...overrides,
  };
}

describe("ideaUtils", () => {
  test("uses Russian status labels", () => {
    expect(IDEA_STATUS_LABELS.in_tasks).toBe("В задачах");
    expect(IDEA_STATUS_LABELS.completed).toBe("Завершена");
  });

  test("counts ready and not required departments as ready progress", () => {
    expect(
      countReadyIdeaDepartments([
        { id: "a", status: "ready" },
        { id: "b", status: "not_required" },
        { id: "c", status: "in_progress" },
      ])
    ).toBe(2);
  });

  test("uses backend can_complete flag for completion availability", () => {
    expect(canCompleteIdea(idea({ can_complete: true }))).toBe(true);
    expect(canCompleteIdea(idea({ can_complete: false }))).toBe(false);
  });
});
```

- [ ] **Step 2: Run helper tests and verify they fail**

Run:

```bash
cd frontend && npm test -- ideaUtils.test.ts
```

Expected: FAIL because `ideaUtils.ts` and Idea types do not exist.

- [ ] **Step 3: Add frontend Idea types**

In `frontend/src/lib/types.ts`, add near enum/constants:

```typescript
export type IdeaStatus =
  | "new"
  | "in_review"
  | "accepted"
  | "in_tasks"
  | "completed"
  | "rejected"
  | "deferred";

export type IdeaDepartmentStatus =
  | "not_started"
  | "in_progress"
  | "ready"
  | "not_required";
```

Add interfaces near the task/meeting models:

```typescript
export interface IdeaTaskLink {
  id: string;
  idea_id: string;
  idea_department_id: string | null;
  task_id: string;
  created_by_id: string | null;
  created_at: string;
  task: Task | null;
  hidden: boolean;
}

export interface IdeaDepartment {
  id: string;
  idea_id: string;
  department_id: string;
  owner_id: string;
  status: IdeaDepartmentStatus;
  note: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
  department: Department | null;
  owner: TeamMember | null;
  task_links: IdeaTaskLink[];
}

export interface IdeaComment {
  id: string;
  idea_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author: TeamMember | null;
}

export interface IdeaEvent {
  id: string;
  idea_id: string;
  actor_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  actor: TeamMember | null;
}

export interface Idea {
  id: string;
  title: string;
  description: string;
  status: IdeaStatus;
  author_id: string;
  review_owner_id: string;
  decision_comment: string | null;
  decision_by_id: string | null;
  decision_at: string | null;
  deferred_until: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  author: TeamMember | null;
  review_owner: TeamMember | null;
  decision_by: TeamMember | null;
  departments: IdeaDepartment[];
  task_links: IdeaTaskLink[];
  comments: IdeaComment[];
  events: IdeaEvent[];
  linked_task_count: number;
  visible_linked_task_count: number;
  completed_linked_task_count: number;
  hidden_linked_task_count: number;
  ready_department_count: number;
  required_department_count: number;
  can_complete: boolean;
}

export interface IdeaCreateRequest {
  title: string;
  description: string;
  review_owner_id: string;
  department_ids?: string[];
}

export interface IdeaStatusChangeRequest {
  status: IdeaStatus;
  comment?: string | null;
  deferred_until?: string | null;
}

export interface IdeaDepartmentCreateRequest {
  department_id: string;
  owner_id: string;
}

export interface IdeaDepartmentUpdateRequest {
  owner_id?: string;
  status?: IdeaDepartmentStatus;
  note?: string | null;
}

export interface IdeaLinkedTaskCreateRequest {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  assignee_id?: string | null;
  deadline?: string | null;
  label_ids?: string[];
}
```

- [ ] **Step 4: Add helper functions**

Create `frontend/src/lib/ideaUtils.ts`:

```typescript
import type { Idea, IdeaDepartment, IdeaDepartmentStatus, IdeaStatus } from "./types";

export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  new: "Новая",
  in_review: "На рассмотрении",
  accepted: "Принята",
  in_tasks: "В задачах",
  completed: "Завершена",
  rejected: "Отклонена",
  deferred: "Отложена",
};

export const IDEA_DEPARTMENT_STATUS_LABELS: Record<IdeaDepartmentStatus, string> = {
  not_started: "Не начато",
  in_progress: "В работе",
  ready: "Готово",
  not_required: "Не требуется",
};

export const IDEA_STATUS_TABS: Array<{ value: "all" | IdeaStatus; label: string }> = [
  { value: "all", label: "Все" },
  { value: "new", label: "Новые" },
  { value: "in_review", label: "На рассмотрении" },
  { value: "accepted", label: "Принятые" },
  { value: "in_tasks", label: "В задачах" },
  { value: "completed", label: "Завершённые" },
  { value: "deferred", label: "Отложенные" },
  { value: "rejected", label: "Отклонённые" },
];

export function countReadyIdeaDepartments(
  departments: Array<Pick<IdeaDepartment, "status">>
) {
  return departments.filter(
    (department) =>
      department.status === "ready" || department.status === "not_required"
  ).length;
}

export function canCompleteIdea(idea: Pick<Idea, "can_complete">) {
  return idea.can_complete;
}

export function formatIdeaDepartmentProgress(idea: Pick<Idea, "departments">) {
  if (idea.departments.length === 0) return "Без отделов";
  return `${countReadyIdeaDepartments(idea.departments)}/${idea.departments.length} отделов готово`;
}

export function formatIdeaTaskProgress(
  idea: Pick<Idea, "completed_linked_task_count" | "linked_task_count">
) {
  if (idea.linked_task_count === 0) return "Задач нет";
  return `${idea.completed_linked_task_count}/${idea.linked_task_count} задач закрыто`;
}
```

- [ ] **Step 5: Add API client methods**

In `frontend/src/lib/api.ts`, add Idea types to the import list and methods after the Tasks section:

```typescript
  async getIdeas(params?: Record<string, string>): Promise<PaginatedResponse<Idea>> {
    const query = params ? "?" + new URLSearchParams(params).toString() : "";
    return this.request<PaginatedResponse<Idea>>(`/api/ideas${query}`);
  }

  async createIdea(data: IdeaCreateRequest): Promise<Idea> {
    return this.request<Idea>("/api/ideas", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getIdea(id: string): Promise<Idea> {
    return this.request<Idea>(`/api/ideas/${id}`);
  }

  async updateIdeaStatus(id: string, data: IdeaStatusChangeRequest): Promise<Idea> {
    return this.request<Idea>(`/api/ideas/${id}/status`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async addIdeaComment(id: string, body: string): Promise<Idea> {
    return this.request<Idea>(`/api/ideas/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  }

  async addIdeaDepartment(id: string, data: IdeaDepartmentCreateRequest): Promise<Idea> {
    return this.request<Idea>(`/api/ideas/${id}/departments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateIdeaDepartment(
    id: string,
    ideaDepartmentId: string,
    data: IdeaDepartmentUpdateRequest
  ): Promise<Idea> {
    return this.request<Idea>(`/api/ideas/${id}/departments/${ideaDepartmentId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async createIdeaTask(id: string, data: IdeaLinkedTaskCreateRequest): Promise<Idea> {
    return this.request<Idea>(`/api/ideas/${id}/tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async createIdeaDepartmentTask(
    id: string,
    ideaDepartmentId: string,
    data: IdeaLinkedTaskCreateRequest
  ): Promise<Idea> {
    return this.request<Idea>(`/api/ideas/${id}/departments/${ideaDepartmentId}/tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
```

- [ ] **Step 6: Run helper tests**

Run:

```bash
cd frontend && npm test -- ideaUtils.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts frontend/src/lib/ideaUtils.ts frontend/src/lib/ideaUtils.test.ts
git commit -m "Add frontend ideas types and client"
```

---

### Task 6: Ideas Register UI

**Files:**
- Create: `frontend/src/components/ideas/IdeaStatusBadge.tsx`
- Create: `frontend/src/components/ideas/CreateIdeaDialog.tsx`
- Create: `frontend/src/components/ideas/IdeaFilters.tsx`
- Create: `frontend/src/components/ideas/IdeaRegisterRow.tsx`
- Create: `frontend/src/app/ideas/page.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Test: `frontend/src/lib/ideaUtils.test.ts`

- [ ] **Step 1: Add register helper tests**

Extend `frontend/src/lib/ideaUtils.test.ts`:

```typescript
import { formatIdeaDepartmentProgress, formatIdeaTaskProgress } from "./ideaUtils";

test("formats idea progress for register rows", () => {
  const target = idea({
    departments: [
      { id: "a", status: "ready" } as never,
      { id: "b", status: "in_progress" } as never,
    ],
    linked_task_count: 3,
    completed_linked_task_count: 1,
  });

  expect(formatIdeaDepartmentProgress(target)).toBe("1/2 отделов готово");
  expect(formatIdeaTaskProgress(target)).toBe("1/3 задач закрыто");
});
```

- [ ] **Step 2: Run test**

Run:

```bash
cd frontend && npm test -- ideaUtils.test.ts
```

Expected: PASS after Task 5 helpers are present.

- [ ] **Step 3: Create status badge component**

Create `frontend/src/components/ideas/IdeaStatusBadge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { IDEA_STATUS_LABELS } from "@/lib/ideaUtils";
import type { IdeaStatus } from "@/lib/types";

const STATUS_CLASS: Record<IdeaStatus, string> = {
  new: "border-status-new-fg/30 bg-status-new-bg text-status-new-fg",
  in_review: "border-status-review-fg/30 bg-status-review-bg text-status-review-fg",
  accepted: "border-primary/30 bg-primary/10 text-primary",
  in_tasks: "border-status-progress-fg/30 bg-status-progress-bg text-status-progress-fg",
  completed: "border-status-done-fg/30 bg-status-done-bg text-status-done-fg",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  deferred: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

export function IdeaStatusBadge({ status }: { status: IdeaStatus }) {
  return (
    <Badge variant="outline" className={STATUS_CLASS[status]}>
      {IDEA_STATUS_LABELS[status]}
    </Badge>
  );
}
```

- [ ] **Step 4: Create idea register row**

Create `frontend/src/components/ideas/IdeaRegisterRow.tsx`:

```tsx
import Link from "next/link";
import { ArrowRight, CheckCircle2, ListChecks } from "lucide-react";
import { IdeaStatusBadge } from "./IdeaStatusBadge";
import { formatIdeaDepartmentProgress, formatIdeaTaskProgress } from "@/lib/ideaUtils";
import type { Idea } from "@/lib/types";

export function IdeaRegisterRow({ idea }: { idea: Idea }) {
  return (
    <Link
      href={`/ideas/${idea.id}`}
      className="group grid gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/30 md:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <IdeaStatusBadge status={idea.status} />
          <h3 className="truncate text-sm font-semibold text-foreground">{idea.title}</h3>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Автор: {idea.author?.full_name || "Неизвестно"}</span>
          <span>Ответственный: {idea.review_owner?.full_name || "Не назначен"}</span>
          <span>Обновлено: {new Date(idea.updated_at).toLocaleDateString("ru-RU")}</span>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {formatIdeaDepartmentProgress(idea)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5" />
          {formatIdeaTaskProgress(idea)}
        </span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
```

- [ ] **Step 5: Create filters and create dialog**

Create `frontend/src/components/ideas/IdeaFilters.tsx` with status tabs and simple selects:

```tsx
import { IDEA_STATUS_TABS } from "@/lib/ideaUtils";
import type { Department, IdeaStatus, TeamMember } from "@/lib/types";

export interface IdeaFilterValues {
  status: "all" | IdeaStatus;
  author_id: string;
  review_owner_id: string;
  department_id: string;
}

export const EMPTY_IDEA_FILTERS: IdeaFilterValues = {
  status: "all",
  author_id: "",
  review_owner_id: "",
  department_id: "",
};

export function IdeaFilters({
  filters,
  members,
  departments,
  onChange,
}: {
  filters: IdeaFilterValues;
  members: TeamMember[];
  departments: Department[];
  onChange: (filters: IdeaFilterValues) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex min-w-max rounded-xl bg-muted/70 p-1">
          {IDEA_STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => onChange({ ...filters, status: tab.value })}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filters.status === tab.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <select
          value={filters.review_owner_id}
          onChange={(event) => onChange({ ...filters, review_owner_id: event.target.value })}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Все ответственные</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>{member.full_name}</option>
          ))}
        </select>
        <select
          value={filters.author_id}
          onChange={(event) => onChange({ ...filters, author_id: event.target.value })}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Все авторы</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>{member.full_name}</option>
          ))}
        </select>
        <select
          value={filters.department_id}
          onChange={(event) => onChange({ ...filters, department_id: event.target.value })}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Все отделы</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>{department.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
```

Create `frontend/src/components/ideas/CreateIdeaDialog.tsx`:

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import type { Idea, TeamMember } from "@/lib/types";

export function CreateIdeaDialog({
  open,
  onOpenChange,
  members,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TeamMember[];
  onCreated: (idea: Idea) => void;
}) {
  const { toastError } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reviewOwnerId, setReviewOwnerId] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim() || !description.trim() || !reviewOwnerId) {
      toastError("Заполните название, описание и ответственного");
      return;
    }
    setSaving(true);
    try {
      const idea = await api.createIdea({
        title: title.trim(),
        description: description.trim(),
        review_owner_id: reviewOwnerId,
      });
      setTitle("");
      setDescription("");
      setReviewOwnerId("");
      onCreated(idea);
      onOpenChange(false);
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось создать идею");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая идея</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Название идеи" />
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Что предлагается и зачем" rows={5} />
          <select value={reviewOwnerId} onChange={(event) => setReviewOwnerId(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Ответственный за рассмотрение</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>{member.full_name}</option>
            ))}
          </select>
          <Button onClick={submit} disabled={saving} className="w-full">
            {saving ? "Создаём..." : "Создать идею"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Create `/ideas` page**

Create `frontend/src/app/ideas/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lightbulb, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateIdeaDialog } from "@/components/ideas/CreateIdeaDialog";
import { EMPTY_IDEA_FILTERS, IdeaFilters, type IdeaFilterValues } from "@/components/ideas/IdeaFilters";
import { IdeaRegisterRow } from "@/components/ideas/IdeaRegisterRow";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import type { Department, Idea, TeamMember } from "@/lib/types";

export default function IdeasPage() {
  const { toastError } = useToast();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filters, setFilters] = useState<IdeaFilterValues>(EMPTY_IDEA_FILTERS);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const params = useMemo(() => {
    const next: Record<string, string> = { per_page: "100" };
    if (filters.status !== "all") next.status = filters.status;
    if (filters.author_id) next.author_id = filters.author_id;
    if (filters.review_owner_id) next.review_owner_id = filters.review_owner_id;
    if (filters.department_id) next.department_id = filters.department_id;
    return next;
  }, [filters]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [ideasRes, teamRes, departmentRes] = await Promise.all([
        api.getIdeas(params),
        api.getTeam().catch(() => [] as TeamMember[]),
        api.getDepartments().catch(() => [] as Department[]),
      ]);
      setIdeas(ideasRes.items);
      setMembers(teamRes);
      setDepartments(departmentRes);
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось загрузить идеи");
    } finally {
      setLoading(false);
    }
  }, [params, toastError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Lightbulb className="h-6 w-6 text-primary" />
            Идеи
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Входящий поток предложений до превращения в задачи.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Новая идея
        </Button>
      </div>

      <IdeaFilters
        filters={filters}
        members={members}
        departments={departments}
        onChange={setFilters}
      />

      <div className="space-y-2">
        {ideas.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Идей пока нет
          </div>
        ) : (
          ideas.map((idea) => <IdeaRegisterRow key={idea.id} idea={idea} />)
        )}
      </div>

      <CreateIdeaDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        members={members}
        onCreated={() => fetchData()}
      />
    </div>
  );
}
```

- [ ] **Step 7: Add sidebar item**

In `frontend/src/components/layout/Sidebar.tsx`, add a `Lightbulb` import from `lucide-react` and add the navigation entry near Tasks/Meetings:

```tsx
{ href: "/ideas", label: "Идеи", icon: Lightbulb }
```

Follow the existing local navigation data structure exactly.

- [ ] **Step 8: Run frontend checks for the register**

Run:

```bash
cd frontend && npm test -- ideaUtils.test.ts
cd frontend && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 9: Commit Task 6**

```bash
git add frontend/src/components/ideas frontend/src/app/ideas/page.tsx frontend/src/components/layout/Sidebar.tsx frontend/src/lib/ideaUtils.test.ts
git commit -m "Add ideas register UI"
```

---

### Task 7: Idea Detail UI

**Files:**
- Create: `frontend/src/components/ideas/IdeaDecisionPanel.tsx`
- Create: `frontend/src/components/ideas/IdeaDepartmentPanel.tsx`
- Create: `frontend/src/components/ideas/IdeaLinkedTasks.tsx`
- Create: `frontend/src/components/ideas/IdeaComments.tsx`
- Create: `frontend/src/components/ideas/IdeaEventHistory.tsx`
- Create: `frontend/src/app/ideas/[id]/page.tsx`

- [ ] **Step 1: Create decision panel**

Create `frontend/src/components/ideas/IdeaDecisionPanel.tsx`:

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import { IDEA_STATUS_LABELS } from "@/lib/ideaUtils";
import type { Idea, IdeaStatus } from "@/lib/types";

const ACTIONS: IdeaStatus[] = ["in_review", "accepted", "rejected", "deferred", "completed"];

export function IdeaDecisionPanel({
  idea,
  onUpdated,
}: {
  idea: Idea;
  onUpdated: (idea: Idea) => void;
}) {
  const { toastError } = useToast();
  const [comment, setComment] = useState("");
  const [savingStatus, setSavingStatus] = useState<IdeaStatus | null>(null);

  async function changeStatus(status: IdeaStatus) {
    if ((status === "rejected" || status === "deferred") && !comment.trim()) {
      toastError("Укажите причину решения");
      return;
    }
    setSavingStatus(status);
    try {
      const updated = await api.updateIdeaStatus(idea.id, {
        status,
        comment: comment.trim() || null,
      });
      setComment("");
      onUpdated(updated);
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось изменить статус");
    } finally {
      setSavingStatus(null);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Решение</h2>
        {idea.decision_comment && (
          <p className="mt-1 text-sm text-muted-foreground">{idea.decision_comment}</p>
        )}
      </div>
      <Textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Комментарий к решению"
        rows={3}
      />
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((status) => (
          <Button
            key={status}
            size="sm"
            variant={status === "completed" ? "default" : "secondary"}
            disabled={savingStatus !== null || (status === "completed" && !idea.can_complete)}
            onClick={() => changeStatus(status)}
          >
            {savingStatus === status ? "Сохраняем..." : IDEA_STATUS_LABELS[status]}
          </Button>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create linked tasks and comments components**

Create `frontend/src/components/ideas/IdeaLinkedTasks.tsx`:

```tsx
import Link from "next/link";
import { Lock } from "lucide-react";
import type { IdeaTaskLink } from "@/lib/types";

export function IdeaLinkedTasks({ links }: { links: IdeaTaskLink[] }) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">Связанные задачи</h2>
      {links.length === 0 ? (
        <p className="text-sm text-muted-foreground">Задачи ещё не созданы.</p>
      ) : (
        <div className="space-y-2">
          {links.map((link) =>
            link.hidden || !link.task ? (
              <div key={link.id} className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                Задача скрыта настройками доступа
              </div>
            ) : (
              <Link key={link.id} href={`/tasks/${link.task.short_id}`} className="block rounded-md border p-3 text-sm hover:bg-muted/40">
                #{link.task.short_id} {link.task.title}
              </Link>
            )
          )}
        </div>
      )}
    </section>
  );
}
```

Create `frontend/src/components/ideas/IdeaComments.tsx`:

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import type { Idea, IdeaComment } from "@/lib/types";

export function IdeaComments({
  idea,
  onUpdated,
}: {
  idea: Idea;
  onUpdated: (idea: Idea) => void;
}) {
  const { toastError } = useToast();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!body.trim()) return;
    setSaving(true);
    try {
      const updated = await api.addIdeaComment(idea.id, body.trim());
      setBody("");
      onUpdated(updated);
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось добавить комментарий");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">Обсуждение</h2>
      <div className="space-y-2">
        {idea.comments.map((comment: IdeaComment) => (
          <div key={comment.id} className="rounded-md bg-muted/40 p-3 text-sm">
            <div className="mb-1 text-xs text-muted-foreground">
              {comment.author?.full_name || "Участник"} · {new Date(comment.created_at).toLocaleString("ru-RU")}
            </div>
            {comment.body}
          </div>
        ))}
      </div>
      <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Добавить комментарий" rows={3} />
      <Button size="sm" onClick={submit} disabled={saving || !body.trim()}>
        {saving ? "Отправляем..." : "Добавить комментарий"}
      </Button>
    </section>
  );
}
```

- [ ] **Step 3: Create department and event components**

Create `frontend/src/components/ideas/IdeaDepartmentPanel.tsx`:

```tsx
import { IDEA_DEPARTMENT_STATUS_LABELS } from "@/lib/ideaUtils";
import type { Idea } from "@/lib/types";

export function IdeaDepartmentPanel({ idea }: { idea: Idea }) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">Реализация по отделам</h2>
      {idea.departments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Отделы пока не добавлены.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {idea.departments.map((department) => (
            <div key={department.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium">{department.department?.name || "Отдел"}</h3>
                <span className="text-xs text-muted-foreground">
                  {IDEA_DEPARTMENT_STATUS_LABELS[department.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Ответственный: {department.owner?.full_name || "Не назначен"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Задач: {department.task_links.length}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

Create `frontend/src/components/ideas/IdeaEventHistory.tsx`:

```tsx
import type { IdeaEvent } from "@/lib/types";

export function IdeaEventHistory({ events }: { events: IdeaEvent[] }) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">История</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Событий пока нет.</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="text-sm">
              <span className="text-muted-foreground">
                {new Date(event.created_at).toLocaleString("ru-RU")}
              </span>{" "}
              {event.actor?.full_name || "Система"} · {event.event_type}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Create detail page**

Create `frontend/src/app/ideas/[id]/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { IdeaComments } from "@/components/ideas/IdeaComments";
import { IdeaDecisionPanel } from "@/components/ideas/IdeaDecisionPanel";
import { IdeaDepartmentPanel } from "@/components/ideas/IdeaDepartmentPanel";
import { IdeaEventHistory } from "@/components/ideas/IdeaEventHistory";
import { IdeaLinkedTasks } from "@/components/ideas/IdeaLinkedTasks";
import { IdeaStatusBadge } from "@/components/ideas/IdeaStatusBadge";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import type { Idea } from "@/lib/types";

export default function IdeaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { toastError } = useToast();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchIdea = useCallback(async () => {
    try {
      setLoading(true);
      setIdea(await api.getIdea(id));
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось загрузить идею");
    } finally {
      setLoading(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    fetchIdea();
  }, [fetchIdea]);

  if (loading || !idea) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <Link href="/ideas" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        К идеям
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <IdeaStatusBadge status={idea.status} />
          <h1 className="text-2xl font-semibold tracking-tight">{idea.title}</h1>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>Автор: {idea.author?.full_name || "Неизвестно"}</span>
          <span>Ответственный: {idea.review_owner?.full_name || "Не назначен"}</span>
        </div>
        <p className="max-w-4xl whitespace-pre-wrap text-sm leading-6 text-foreground">
          {idea.description}
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <IdeaDecisionPanel idea={idea} onUpdated={setIdea} />
          <IdeaDepartmentPanel idea={idea} />
          <IdeaLinkedTasks links={idea.task_links} />
          <IdeaComments idea={idea} onUpdated={setIdea} />
        </div>
        <IdeaEventHistory events={idea.events} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run TypeScript**

Run:

```bash
cd frontend && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit Task 7**

```bash
git add frontend/src/components/ideas frontend/src/app/ideas/[id]/page.tsx
git commit -m "Add idea detail page"
```

---

### Task 8: Department And Linked Task Actions

**Files:**
- Modify: `frontend/src/components/ideas/IdeaDepartmentPanel.tsx`
- Modify: `frontend/src/components/ideas/IdeaLinkedTasks.tsx`
- Create: `frontend/src/components/ideas/CreateIdeaTaskDialog.tsx`
- Modify: `frontend/src/app/ideas/[id]/page.tsx`

- [ ] **Step 1: Create linked task dialog**

Create `frontend/src/components/ideas/CreateIdeaTaskDialog.tsx`:

```tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/shared/Toast";
import { api } from "@/lib/api";
import type { Idea, TeamMember } from "@/lib/types";

export function CreateIdeaTaskDialog({
  open,
  onOpenChange,
  idea,
  ideaDepartmentId,
  members,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idea: Idea;
  ideaDepartmentId?: string | null;
  members: TeamMember[];
  onCreated: (idea: Idea) => void;
}) {
  const { toastError } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim()) {
      toastError("Введите название задачи");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        assignee_id: assigneeId || null,
        deadline: deadline || null,
        priority: "normal" as const,
      };
      const updated = ideaDepartmentId
        ? await api.createIdeaDepartmentTask(idea.id, ideaDepartmentId, payload)
        : await api.createIdeaTask(idea.id, payload);
      setTitle("");
      setDescription("");
      setAssigneeId("");
      setDeadline("");
      onCreated(updated);
      onOpenChange(false);
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Не удалось создать задачу");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Создать задачу из идеи</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Название задачи" />
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Описание" rows={4} />
          <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Без исполнителя</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>{member.full_name}</option>
            ))}
          </select>
          <Input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          <Button onClick={submit} disabled={saving} className="w-full">
            {saving ? "Создаём..." : "Создать задачу"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add task action to detail page**

In `frontend/src/app/ideas/[id]/page.tsx`, load team members and render `CreateIdeaTaskDialog` from a top-level button. Use `api.getTeam().catch(() => [])` in the same effect as `api.getIdea(id)`.

Add state:

```tsx
const [members, setMembers] = useState<TeamMember[]>([]);
const [taskDialogOpen, setTaskDialogOpen] = useState(false);
```

Add header action:

```tsx
<Button onClick={() => setTaskDialogOpen(true)}>Создать задачу</Button>
```

Render:

```tsx
<CreateIdeaTaskDialog
  open={taskDialogOpen}
  onOpenChange={setTaskDialogOpen}
  idea={idea}
  members={members}
  onCreated={setIdea}
/>
```

- [ ] **Step 3: Add department status actions**

In `IdeaDepartmentPanel`, accept `onUpdated` and add buttons for `В работе`, `Готово`, and `Не требуется`:

```tsx
export function IdeaDepartmentPanel({
  idea,
  onUpdated,
}: {
  idea: Idea;
  onUpdated: (idea: Idea) => void;
}) {
  async function updateDepartment(id: string, status: IdeaDepartmentStatus) {
    const updated = await api.updateIdeaDepartment(idea.id, id, { status });
    onUpdated(updated);
  }
  // keep existing layout and add buttons inside each department card
}
```

Use the existing `Button` component. Catch errors with `useToast().toastError`.

- [ ] **Step 4: Run frontend checks**

Run:

```bash
cd frontend && npm test -- ideaUtils.test.ts
cd frontend && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit Task 8**

```bash
git add frontend/src/components/ideas frontend/src/app/ideas/[id]/page.tsx
git commit -m "Add idea task and department actions"
```

---

### Task 9: End-To-End Verification And Repo Docs

**Files:**
- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`

- [ ] **Step 1: Update `docs/PLAN.md`**

Prepend this active plan section:

```markdown
# Active Plan: Ideas Phase 1

> **For agentic workers:** Execute from `docs/superpowers/plans/2026-05-12-ideas-phase-1.md`. Keep this section as the current source-of-truth index for milestone order, definition of done, and validation commands.

**Goal:** Add the Phase 1 web portal Ideas section with review decisions, department implementation, linked task creation, comments, and event history.

**Approved spec:** `docs/superpowers/specs/2026-05-12-ideas-projects-tasks-design.md`

**Detailed implementation plan:** `docs/superpowers/plans/2026-05-12-ideas-phase-1.md`

**Milestones:**

1. Add the backend Ideas data model and migration.
2. Add Ideas schemas, repository, service rules, and API routes.
3. Add frontend Ideas types, API client methods, register page, and detail page.
4. Add department contribution actions and linked task creation.
5. Run backend/frontend verification and update status.

**Implementation status:**

- Planned; implementation not started.

**Definition of done:**

- Every active user can create ideas and see the shared ideas register.
- The Ideas register supports status, author, review owner, involved department, and created date filters.
- The idea detail page shows description, decision, departments, linked tasks, comments, and history.
- Rejected and deferred ideas require a reason.
- Accepted ideas can involve multiple departments with department owners and contribution statuses.
- Linked task creation uses the existing task service.
- Idea completion is gated by completed department contributions or by closed direct linked tasks when no departments are involved.
- Linked task details respect existing task visibility.
- Projects remain documented as Phase 2 and are not implemented in Phase 1.

**Validation commands:**

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_idea_service.py tests/test_ideas_api.py -q
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
git diff --check
```

---
```

- [ ] **Step 2: Update `docs/STATUS.md`**

Prepend:

```markdown
## Ideas Phase 1

- Current phase: planned; implementation not started
- Spec: `docs/superpowers/specs/2026-05-12-ideas-projects-tasks-design.md`
- Plan: `docs/superpowers/plans/2026-05-12-ideas-phase-1.md`
- Scope: web portal Ideas section, idea review decisions, department implementation, linked task creation, comments, event history, and Phase 2 Projects compatibility
- Latest progress:
  - Reviewed the source presentation `ideas_oncoschool (2).pdf`.
  - Approved the phased product model: Ideas in Phase 1, Projects in Phase 2, Tasks as the existing execution layer.
  - Approved Phase 1 web-only scope.
  - Approved shared idea visibility for all active users.
  - Approved multi-department implementation with department heads and department implementation owners.
  - Approved final status `Завершена`; `В задачах` is an implementation stage.
  - Wrote the implementation plan for Phase 1.
- Key approved decisions:
  - No Telegram bot flow, idea tags, idea dashboard, or Projects implementation in Phase 1.
  - Rejected and deferred ideas require reasons.
  - Linked task details must follow existing task visibility permissions.
  - Completion requires all departments to be ready/not required, or all direct linked tasks closed when no departments are involved.
- Latest verification:
  - Planning only; implementation verification not run yet.
```

- [ ] **Step 3: Run full backend tests for the new domain**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_idea_service.py tests/test_ideas_api.py -q
```

Expected: PASS.

- [ ] **Step 4: Run frontend tests and static checks**

Run:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
```

Expected: PASS.

- [ ] **Step 5: Run repository whitespace check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 6: Commit Task 9**

```bash
git add docs/PLAN.md docs/STATUS.md
git commit -m "Plan ideas phase one implementation"
```

---

## Final Verification Checklist

- [ ] `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_idea_service.py tests/test_ideas_api.py -q`
- [ ] `cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q`
- [ ] `cd frontend && npm test`
- [ ] `cd frontend && npx tsc --noEmit`
- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run build`
- [ ] `git diff --check`

## Rollout Notes

- Apply Alembic migration `035_ideas_module` before exposing `/ideas` in production.
- Because Ideas are visible to all active users, linked task responses must keep hidden task content redacted.
- Phase 2 Projects should add project tables and UI without removing direct `Idea -> Tasks` support.
