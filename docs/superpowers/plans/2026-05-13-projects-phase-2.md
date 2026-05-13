# Projects Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 2 Projects MVP so larger accepted ideas can become organized projects with owners, departments, lightweight milestones, linked tasks, comments, history, and progress tracking.

**Architecture:** Add a Projects domain beside Ideas and Tasks. Backend work mirrors the existing Ideas stack: SQLAlchemy models, Alembic migration, schemas, repository, service rules, FastAPI routes, and tests. Frontend work mirrors the Ideas UI: a `/projects` register, `/projects/[id]` detail page, project components, project helpers, and a small idea-detail integration for creating and opening linked projects.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, Alembic, Pydantic v2, PostgreSQL, Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Lucide React, Node test runner, pytest.

---

## Source Documents

- Approved Phase 2 design: `docs/superpowers/specs/2026-05-13-projects-phase-2-design.md`
- Base ideas/projects/tasks design: `docs/superpowers/specs/2026-05-12-ideas-projects-tasks-design.md`
- Current repo plan index: `docs/PLAN.md`
- Current repo status journal: `docs/STATUS.md`

## Execution Rules

- Keep direct `Idea -> Tasks` support intact.
- Use soft deletion for projects, consistent with Ideas.
- Never expose hidden linked task content. Use the existing `can_access_task` helper.
- Use Russian user-facing API error text and UI text.
- Keep documentation, branch names, commit messages, and PR text in English.
- Prefer the existing Ideas implementation patterns over new abstractions.
- Commit after each task when tests for that task pass.

## File Structure

### Backend

- Modify `backend/app/db/models.py`
  - Add `Project`, `ProjectDepartment`, `ProjectMilestone`, `ProjectTask`, `ProjectComment`, and `ProjectEvent`.
  - Add nullable `Idea.project_id` and relationship to `Project`.
- Create `backend/alembic/versions/037_projects_module.py`
  - Create project tables and add `ideas.project_id`.
- Modify `backend/app/db/schemas.py`
  - Add Project literal types, request schemas, response schemas, and paginated response.
  - Add project fields to `IdeaResponse`.
- Modify `backend/app/db/repositories.py`
  - Add `ProjectRepository` with detail loading, list filters, create/update helpers, department/milestone/comment/event/task-link helpers, and soft delete.
- Create `backend/app/services/project_service.py`
  - Own project permissions, completion/deletion rules, task visibility shaping, progress counts, and project-from-idea orchestration.
- Create `backend/app/api/projects.py`
  - Add Projects API routes.
- Modify `backend/app/api/router.py`
  - Include the Projects router.
- Modify `backend/app/api/ideas.py`
  - Use shaped ideas that include linked project data.
- Create `backend/tests/test_project_service.py`
  - Unit coverage for models, repository query shape, service rules, visibility shaping, and completion/deletion gates.
- Create `backend/tests/test_projects_api.py`
  - API route coverage with mocked repository/service patterns.

### Frontend

- Modify `frontend/src/lib/types.ts`
  - Add Project types, request interfaces, and project fields on Idea.
- Modify `frontend/src/lib/api.ts`
  - Add Projects client methods.
- Create `frontend/src/lib/projectUtils.ts`
  - Project status labels, department status labels, progress helpers, completion helpers, deletion helpers.
- Create `frontend/src/lib/projectUtils.test.ts`
  - Unit tests for pure project helpers.
- Create `frontend/src/lib/projectEventUtils.ts`
  - Readable Russian labels for project history.
- Create `frontend/src/lib/projectEventUtils.test.ts`
  - Unit tests for event formatting.
- Create `frontend/src/components/projects/ProjectStatusBadge.tsx`
- Create `frontend/src/components/projects/CreateProjectDialog.tsx`
- Create `frontend/src/components/projects/CreateProjectFromIdeaDialog.tsx`
- Create `frontend/src/components/projects/ProjectFilters.tsx`
- Create `frontend/src/components/projects/ProjectRegisterRow.tsx`
- Create `frontend/src/components/projects/ProjectHeader.tsx`
- Create `frontend/src/components/projects/ProjectStatusPanel.tsx`
- Create `frontend/src/components/projects/ProjectDepartmentPanel.tsx`
- Create `frontend/src/components/projects/ProjectMilestones.tsx`
- Create `frontend/src/components/projects/ProjectLinkedTasks.tsx`
- Create `frontend/src/components/projects/CreateProjectTaskDialog.tsx`
- Create `frontend/src/components/projects/ProjectComments.tsx`
- Create `frontend/src/components/projects/ProjectEventHistory.tsx`
- Create `frontend/src/app/projects/page.tsx`
- Create `frontend/src/app/projects/[id]/page.tsx`
- Modify `frontend/src/app/ideas/[id]/page.tsx`
  - Add project creation/link card integration.
- Modify `frontend/src/components/layout/Sidebar.tsx`
  - Add the `Проекты` navigation item.
- Create `frontend/src/components/projects/projectSourceGuards.test.ts`
  - Source guard tests for core UI affordances.

### Docs

- Modify `docs/PLAN.md`
  - Make this implementation plan the active source of truth.
- Modify `docs/STATUS.md`
  - Update Projects Phase 2 progress as tasks complete.

---

## Domain Decisions To Preserve

- Projects organize work; they do not replace Ideas.
- Projects can be created directly by admin/moderator users.
- Projects can be created from accepted or in-task ideas.
- Creating a project from an idea links existing idea tasks to the project by default.
- Existing idea task links remain visible from the idea.
- Milestones are not task containers in the MVP.
- Tasks belong to at most one project in the MVP through `project_tasks.task_id` uniqueness.
- Linked project task details respect existing task visibility.
- Project completion is manually triggered and gated by closed linked tasks.
- Project soft deletion is blocked once linked tasks exist.

---

## Task 1: Backend Project Models And Migration

**Files:**
- Modify: `backend/app/db/models.py`
- Create: `backend/alembic/versions/037_projects_module.py`
- Test: `backend/tests/test_project_service.py`

- [ ] **Step 1: Write failing model smoke tests**

Add this to a new `backend/tests/test_project_service.py`:

```python
import unittest
import uuid
from datetime import datetime
from types import SimpleNamespace

from sqlalchemy import ForeignKeyConstraint, UniqueConstraint
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import configure_mappers

from app.db import models
from app.db.repositories import ProjectRepository


def member(role: str = "member", *, member_id: uuid.UUID | None = None):
    return SimpleNamespace(id=member_id or uuid.uuid4(), role=role, is_active=True)


def project(**overrides):
    base = {
        "id": uuid.uuid4(),
        "title": "Patient onboarding redesign",
        "description": "Coordinate the implementation",
        "status": "planned",
        "owner_id": uuid.uuid4(),
        "source_idea_id": None,
        "completed_at": None,
        "deleted_at": None,
        "deleted_by_id": None,
        "created_at": datetime(2026, 5, 13, 12, 0, 0),
        "updated_at": datetime(2026, 5, 13, 12, 0, 0),
        "departments": [],
        "milestones": [],
        "task_links": [],
        "comments": [],
        "events": [],
    }
    base.update(overrides)
    return SimpleNamespace(**base)


class ProjectModelSmokeTests(unittest.TestCase):
    def test_project_models_are_registered(self) -> None:
        table_names = set(models.Base.metadata.tables)

        self.assertIn("projects", table_names)
        self.assertIn("project_departments", table_names)
        self.assertIn("project_milestones", table_names)
        self.assertIn("project_tasks", table_names)
        self.assertIn("project_comments", table_names)
        self.assertIn("project_events", table_names)

    def test_project_relationship_mappers_configure(self) -> None:
        configure_mappers()
        self.assertTrue(models.ProjectDepartment.task_links.property.viewonly)
        self.assertTrue(models.ProjectTask.project_department.property.viewonly)

    def test_project_task_department_link_is_scoped_to_same_project(self) -> None:
        project_departments = models.ProjectDepartment.__table__
        project_tasks = models.ProjectTask.__table__

        unique_constraints = {
            constraint.name
            for constraint in project_departments.constraints
            if isinstance(constraint, UniqueConstraint)
        }
        composite_fk_targets = {
            tuple(element.target_fullname for element in constraint.elements)
            for constraint in project_tasks.constraints
            if isinstance(constraint, ForeignKeyConstraint)
        }

        self.assertIn("uq_project_departments_project_department", unique_constraints)
        self.assertIn("uq_project_departments_project_id_id", unique_constraints)
        self.assertIn(
            ("project_departments.project_id", "project_departments.id"),
            composite_fk_targets,
        )

    def test_idea_has_project_foreign_key(self) -> None:
        idea_table = models.Idea.__table__

        self.assertIn("project_id", idea_table.c)
```

- [ ] **Step 2: Run the model smoke test and verify it fails**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_project_service.py::ProjectModelSmokeTests::test_project_models_are_registered -q
```

Expected: FAIL because the project tables are not registered yet.

- [ ] **Step 3: Add SQLAlchemy project models**

In `backend/app/db/models.py`, add project models after the Ideas models and before `MeetingParticipant`.

Use this exact relationship shape:

```python
class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        Index("idx_projects_status", "status"),
        Index("idx_projects_owner_id", "owner_id"),
        Index("idx_projects_source_idea_id", "source_idea_id"),
        Index("idx_projects_created_at", "created_at"),
        Index("idx_projects_deleted_at", "deleted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default="planned", server_default="planned", nullable=False
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("team_members.id"), nullable=False
    )
    source_idea_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("ideas.id", ondelete="SET NULL"), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(nullable=True)
    deleted_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped["TeamMember"] = relationship(foreign_keys=[owner_id])
    source_idea: Mapped["Idea | None"] = relationship(
        foreign_keys=[source_idea_id],
        post_update=True,
    )
    deleted_by: Mapped["TeamMember | None"] = relationship(foreign_keys=[deleted_by_id])
    departments: Mapped[list["ProjectDepartment"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    milestones: Mapped[list["ProjectMilestone"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    task_links: Mapped[list["ProjectTask"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    comments: Mapped[list["ProjectComment"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    events: Mapped[list["ProjectEvent"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
```

Also update `Idea`:

```python
project_id: Mapped[uuid.UUID | None] = mapped_column(
    ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
)

project: Mapped["Project | None"] = relationship(
    foreign_keys=[project_id],
    post_update=True,
)
```

Add `ProjectDepartment`, `ProjectMilestone`, `ProjectTask`, `ProjectComment`, and `ProjectEvent` using the same column patterns as the Ideas equivalents. Use these names:

```python
UniqueConstraint("project_id", "department_id", name="uq_project_departments_project_department")
UniqueConstraint("project_id", "id", name="uq_project_departments_project_id_id")
UniqueConstraint("task_id", name="uq_project_tasks_task_id")
ForeignKeyConstraint(
    ["project_id", "project_department_id"],
    ["project_departments.project_id", "project_departments.id"],
    name="fk_project_tasks_project_department_same_project",
)
```

- [ ] **Step 4: Add Alembic migration**

Create `backend/alembic/versions/037_projects_module.py` with:

```python
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
```

In `upgrade()`, create tables in this order:

1. `projects`
2. `ideas.project_id` FK to `projects.id`
3. `project_departments`
4. `project_milestones`
5. `project_tasks`
6. `project_comments`
7. `project_events`

In `downgrade()`, drop in the reverse order and drop `ideas.project_id`.

- [ ] **Step 5: Run model tests**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_project_service.py::ProjectModelSmokeTests -q
```

Expected: PASS.

- [ ] **Step 6: Commit backend models**

```bash
git add backend/app/db/models.py backend/alembic/versions/037_projects_module.py backend/tests/test_project_service.py
git commit -m "Add project data model"
```

---

## Task 2: Backend Schemas, Repository, And Service Rules

**Files:**
- Modify: `backend/app/db/schemas.py`
- Modify: `backend/app/db/repositories.py`
- Create: `backend/app/services/project_service.py`
- Test: `backend/tests/test_project_service.py`

- [ ] **Step 1: Add failing service and repository tests**

Extend `backend/tests/test_project_service.py` with:

```python
class ProjectRepositoryTests(unittest.TestCase):
    def test_list_excludes_soft_deleted_projects(self) -> None:
        class FakeScalarResult:
            def unique(self):
                return self

            def all(self):
                return []

        class FakeResult:
            def scalar_one(self):
                return 0

            def scalars(self):
                return FakeScalarResult()

        class FakeSession:
            def __init__(self) -> None:
                self.statements = []

            async def execute(self, stmt):
                self.statements.append(stmt)
                return FakeResult()

        async def run_list() -> FakeSession:
            session = FakeSession()
            await ProjectRepository().list(session)
            return session

        import asyncio

        session = asyncio.run(run_list())
        list_stmt = session.statements[1]
        compiled = str(
            list_stmt.compile(
                dialect=postgresql.dialect(),
                compile_kwargs={"literal_binds": True},
            )
        )

        self.assertIn("projects.deleted_at IS NULL", compiled)
```

Then add rule tests:

```python
class ProjectServiceRuleTests(unittest.TestCase):
    def setUp(self) -> None:
        from app.services.project_service import ProjectService

        self.service = ProjectService()

    def test_moderator_can_create_direct_project(self) -> None:
        self.assertTrue(self.service.can_create_direct_project(member("admin")))
        self.assertTrue(self.service.can_create_direct_project(member("moderator")))
        self.assertFalse(self.service.can_create_direct_project(member("member")))

    def test_owner_can_manage_project(self) -> None:
        owner_id = uuid.uuid4()
        item = project(owner_id=owner_id)

        self.assertTrue(self.service.can_manage_project(member(member_id=owner_id), item))
        self.assertTrue(self.service.can_manage_project(member("moderator"), item))
        self.assertFalse(self.service.can_manage_project(member(), item))

    def test_project_with_open_task_cannot_complete(self) -> None:
        open_link = SimpleNamespace(
            id=uuid.uuid4(),
            task=SimpleNamespace(status="in_progress"),
        )

        self.assertFalse(self.service.can_complete_project(project(task_links=[open_link])))

    def test_project_with_closed_tasks_can_complete(self) -> None:
        done_link = SimpleNamespace(id=uuid.uuid4(), task=SimpleNamespace(status="done"))
        cancelled_link = SimpleNamespace(id=uuid.uuid4(), task=SimpleNamespace(status="cancelled"))

        self.assertTrue(self.service.can_complete_project(project(task_links=[done_link, cancelled_link])))

    def test_project_without_tasks_cannot_complete(self) -> None:
        self.assertFalse(self.service.can_complete_project(project(task_links=[])))

    def test_delete_requires_no_linked_tasks(self) -> None:
        linked = project(task_links=[SimpleNamespace(id=uuid.uuid4())])

        self.assertFalse(self.service.can_delete_project(member("admin"), linked))
```

- [ ] **Step 2: Run tests and verify failures**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_project_service.py -q
```

Expected: FAIL because schemas, repository, and service do not exist yet.

- [ ] **Step 3: Add Project schemas**

In `backend/app/db/schemas.py`, add literals:

```python
ProjectStatusType = Literal["planned", "in_progress", "paused", "completed", "cancelled"]
ProjectDepartmentStatusType = Literal["not_started", "in_progress", "ready", "not_required"]
ProjectMilestoneStatusType = Literal["planned", "in_progress", "done"]
ProjectEventType = Literal[
    "project_created",
    "project_updated",
    "status_changed",
    "department_added",
    "department_updated",
    "milestone_added",
    "milestone_updated",
    "task_linked",
    "comment_added",
    "project_completed",
    "project_deleted",
]
```

Add request schemas:

```python
class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(min_length=1)
    owner_id: uuid.UUID
    source_idea_id: uuid.UUID | None = None
    department_ids: list[uuid.UUID] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = Field(default=None, min_length=1)
    owner_id: uuid.UUID | None = None


class ProjectStatusChange(BaseModel):
    status: ProjectStatusType


class ProjectDepartmentCreate(BaseModel):
    department_id: uuid.UUID
    owner_id: uuid.UUID


class ProjectDepartmentUpdate(BaseModel):
    owner_id: uuid.UUID | None = None
    status: ProjectDepartmentStatusType | None = None
    note: str | None = None


class ProjectMilestoneCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    due_date: date | None = None


class ProjectMilestoneUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    status: ProjectMilestoneStatusType | None = None
    due_date: date | None = None
    sort_order: int | None = None


class ProjectCommentCreate(BaseModel):
    body: str = Field(min_length=1)


class ProjectLinkedTaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    priority: TaskPriorityType = "normal"
    assignee_id: uuid.UUID | None = None
    deadline: date | None = None
    label_ids: list[uuid.UUID] = Field(default_factory=list)
```

Add response schemas matching Ideas patterns:

```python
class ProjectTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    project_department_id: uuid.UUID | None
    task_id: uuid.UUID
    created_by_id: uuid.UUID | None
    created_at: datetime
    task: TaskResponse | None = None
    hidden: bool = False


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str
    status: str
    owner_id: uuid.UUID
    source_idea_id: uuid.UUID | None
    completed_at: datetime | None
    deleted_at: datetime | None = None
    deleted_by_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
    owner: TeamMemberResponse | None = None
    source_idea: IdeaSummaryResponse | None = None
    departments: list[ProjectDepartmentResponse] = Field(default_factory=list)
    milestones: list[ProjectMilestoneResponse] = Field(default_factory=list)
    task_links: list[ProjectTaskResponse] = Field(default_factory=list)
    comments: list[ProjectCommentResponse] = Field(default_factory=list)
    events: list[ProjectEventResponse] = Field(default_factory=list)
    linked_task_count: int = 0
    visible_linked_task_count: int = 0
    completed_linked_task_count: int = 0
    hidden_linked_task_count: int = 0
    ready_department_count: int = 0
    required_department_count: int = 0
    completed_milestone_count: int = 0
    milestone_count: int = 0
    can_complete: bool = False
    can_delete: bool = False
```

If `IdeaSummaryResponse` does not exist, add a small summary schema before `ProjectResponse` and use it for project source idea links:

```python
class IdeaSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    status: str
```

- [ ] **Step 4: Add ProjectRepository**

In `backend/app/db/repositories.py`, import the project models and add `ProjectRepository` after `IdeaRepository`.

Required methods:

```python
class ProjectRepository:
    def detail_options(self):
        ...

    async def get_by_id(self, session: AsyncSession, project_id: uuid.UUID) -> Project | None:
        ...

    async def list(...):
        ...

    async def create(...):
        ...

    async def update(self, session: AsyncSession, project: Project, **fields) -> Project:
        ...

    async def soft_delete(...):
        ...

    async def add_department(...):
        ...

    async def add_milestone(...):
        ...

    async def add_comment(...):
        ...

    async def add_task_link(...):
        ...

    async def add_event(...):
        ...
```

The list method must filter `Project.deleted_at.is_(None)` and support:

- `status`;
- `search`;
- `owner_id`;
- `department_id`;
- `source_idea_id`;
- `created_from`;
- `created_to`;
- pagination.

- [ ] **Step 5: Add ProjectService**

Create `backend/app/services/project_service.py`.

Include these constants and helpers:

```python
CLOSED_TASK_STATUSES = {"done", "cancelled"}
COMPLETED_DEPARTMENT_STATUSES = {"ready", "not_required"}


class ProjectService:
    def __init__(self, repo: ProjectRepository | None = None) -> None:
        self.repo = repo or ProjectRepository()

    def can_create_direct_project(self, member: TeamMember) -> bool:
        return PermissionService.is_moderator(member)

    def can_manage_project(self, member: TeamMember, project: Project) -> bool:
        return (
            PermissionService.is_moderator(member)
            or getattr(project, "owner_id", None) == getattr(member, "id", None)
        )

    def can_complete_project(self, project: Project) -> bool:
        links = list(getattr(project, "task_links", []) or [])
        return bool(links) and all(self._is_closed_task_link(link) for link in links)

    def can_delete_project(self, member: TeamMember, project: Project) -> bool:
        if self._has_linked_tasks(project):
            return False
        if PermissionService.is_moderator(member):
            return True
        return (
            getattr(project, "owner_id", None) == getattr(member, "id", None)
            and getattr(project, "status", None) == "planned"
        )
```

Also add:

- `can_manage_project_department`;
- `can_add_department`;
- `can_mark_department_ready`;
- `validate_delete_project`;
- `shape_task_link`;
- `shape_response`;
- `list_projects`;
- `record_status_change`.

`record_status_change` must set `completed_at` only for `completed`, clear it for other statuses, and reject `completed` when `can_complete_project(project)` is false.

- [ ] **Step 6: Run service/repository tests**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_project_service.py -q
```

Expected: PASS.

- [ ] **Step 7: Commit backend service layer**

```bash
git add backend/app/db/schemas.py backend/app/db/repositories.py backend/app/services/project_service.py backend/tests/test_project_service.py
git commit -m "Add project service rules"
```

---

## Task 3: Projects API And Idea Integration Backend

**Files:**
- Create: `backend/app/api/projects.py`
- Modify: `backend/app/api/router.py`
- Modify: `backend/app/api/ideas.py`
- Modify: `backend/app/db/schemas.py`
- Test: `backend/tests/test_projects_api.py`

- [ ] **Step 1: Write failing API tests**

Create `backend/tests/test_projects_api.py` with helper patterns copied from `backend/tests/test_ideas_api.py`.

Add tests:

```python
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.api import projects as projects_api
from app.db.models import Department, TeamMember
from app.db.schemas import ProjectCreate, ProjectStatusChange


def request_with_no_bot():
    return SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(bot=None)))


def active_member(member_id: uuid.UUID | None = None, *, role: str = "member"):
    return SimpleNamespace(id=member_id or uuid.uuid4(), is_active=True, role=role)


def active_department(department_id: uuid.UUID | None = None):
    return SimpleNamespace(id=department_id or uuid.uuid4(), is_active=True)
```

Cover these behaviors:

- direct project creation rejects normal members with `403`;
- direct project creation by admin commits and returns shaped response;
- project from accepted idea copies departments and links existing idea tasks;
- project status `completed` rejects when completion gate fails;
- delete project rejects linked tasks;
- missing project returns `404`.

- [ ] **Step 2: Run API tests and verify failures**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_projects_api.py -q
```

Expected: FAIL because `app.api.projects` does not exist yet.

- [ ] **Step 3: Add Projects API routes**

Create `backend/app/api/projects.py` with:

```python
router = APIRouter(prefix="/projects", tags=["projects"])
project_service = ProjectService()
task_service = TaskService()
idea_service = IdeaService()
```

Required routes:

- `GET /api/projects`;
- `POST /api/projects`;
- `GET /api/projects/{project_id}`;
- `PATCH /api/projects/{project_id}`;
- `DELETE /api/projects/{project_id}`;
- `POST /api/projects/{project_id}/status`;
- `POST /api/projects/{project_id}/departments`;
- `PATCH /api/projects/{project_id}/departments/{project_department_id}`;
- `POST /api/projects/{project_id}/milestones`;
- `PATCH /api/projects/{project_id}/milestones/{project_milestone_id}`;
- `POST /api/projects/{project_id}/comments`;
- `POST /api/projects/{project_id}/tasks`;
- `POST /api/projects/{project_id}/departments/{project_department_id}/tasks`.

Use the same error mapping style as Ideas:

```python
except PermissionError as exc:
    raise HTTPException(status_code=403, detail=str(exc)) from exc
except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc
```

- [ ] **Step 4: Implement project creation from idea**

Inside `POST /api/projects`, if `data.source_idea_id` is present:

1. Load the idea through `idea_service.repo.get_by_id`.
2. Reject missing idea with `404`.
3. Require idea status in `{"accepted", "in_tasks"}`.
4. Require admin/moderator, project owner, or idea review owner permission.
5. Create the project.
6. Add project departments for every selected department or idea department.
7. Link the idea to the project by setting `idea.project_id`.
8. Copy existing idea task links into project task links.
9. Add `project_created` event on the project.
10. Add `project_created` or `project_linked` event on the idea.

When copying department task context, map `idea_department.department_id` to the newly created `project_department.id`.

- [ ] **Step 5: Include router**

Modify `backend/app/api/router.py`:

```python
from app.api.projects import router as projects_router

api_router.include_router(projects_router)
```

Place Projects near Ideas and Tasks.

- [ ] **Step 6: Extend Idea response with project link**

In `backend/app/db/schemas.py`, add `project_id` and a compact project summary on `IdeaResponse`:

```python
class ProjectSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    status: str


class IdeaResponse(BaseModel):
    ...
    project_id: uuid.UUID | None = None
    project: ProjectSummaryResponse | None = None
```

Update `IdeaRepository.detail_options()` to eager load `Idea.project`.

- [ ] **Step 7: Run backend project tests**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_project_service.py tests/test_projects_api.py -q
```

Expected: PASS.

- [ ] **Step 8: Commit backend API**

```bash
git add backend/app/api/projects.py backend/app/api/router.py backend/app/api/ideas.py backend/app/db/schemas.py backend/app/db/repositories.py backend/app/services/project_service.py backend/tests/test_project_service.py backend/tests/test_projects_api.py
git commit -m "Add projects API"
```

---

## Task 4: Frontend Project Types, API Client, And Helpers

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/projectUtils.ts`
- Create: `frontend/src/lib/projectUtils.test.ts`
- Create: `frontend/src/lib/projectEventUtils.ts`
- Create: `frontend/src/lib/projectEventUtils.test.ts`
- Modify: `frontend/package.json`

- [ ] **Step 1: Add failing helper tests**

Create `frontend/src/lib/projectUtils.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  PROJECT_STATUS_LABELS,
  canCompleteProject,
  formatProjectDepartmentProgress,
  formatProjectMilestoneProgress,
  formatProjectTaskProgress,
} from "./projectUtils.ts";

test("project labels expose Russian status names", () => {
  assert.equal(PROJECT_STATUS_LABELS.planned, "Запланирован");
  assert.equal(PROJECT_STATUS_LABELS.in_progress, "В работе");
  assert.equal(PROJECT_STATUS_LABELS.completed, "Завершён");
});

test("project completion uses backend completion flag", () => {
  assert.equal(canCompleteProject({ can_complete: true }), true);
  assert.equal(canCompleteProject({ can_complete: false }), false);
});

test("project progress formatters show milestones departments and tasks", () => {
  const project = {
    departments: [{ status: "ready" }, { status: "in_progress" }],
    completed_milestone_count: 1,
    milestone_count: 3,
    completed_linked_task_count: 2,
    linked_task_count: 5,
    task_links: [],
  };

  assert.equal(formatProjectDepartmentProgress(project), "1/2 отделов готово");
  assert.equal(formatProjectMilestoneProgress(project), "1/3 этапов готово");
  assert.equal(formatProjectTaskProgress(project), "2/5 задач закрыто");
});
```

Create `frontend/src/lib/projectEventUtils.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { formatProjectEvent } from "./projectEventUtils.ts";
import type { ProjectEvent } from "./types.ts";

function event(event_type: string, payload: Record<string, unknown>): ProjectEvent {
  return {
    id: "event-1",
    project_id: "project-1",
    actor_id: "member-1",
    event_type,
    payload,
    created_at: "2026-05-13T07:13:00",
    actor: null,
  };
}

test("formatProjectEvent renders status changes with Russian status labels", () => {
  const formatted = formatProjectEvent(
    event("status_changed", {
      old_status: "planned",
      new_status: "in_progress",
    }),
  );

  assert.equal(formatted.title, "Статус изменён");
  assert.equal(formatted.detail, "Запланирован → В работе");
});

test("formatProjectEvent avoids raw event keys", () => {
  assert.equal(formatProjectEvent(event("project_created", {})).title, "Проект создан");
  assert.equal(formatProjectEvent(event("task_linked", {})).title, "Создана задача по проекту");
});
```

- [ ] **Step 2: Run tests and verify failures**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/lib/projectUtils.test.ts src/lib/projectEventUtils.test.ts
```

Expected: FAIL because project helper modules do not exist yet.

- [ ] **Step 3: Add frontend project types**

In `frontend/src/lib/types.ts`, add:

```ts
export type ProjectStatus =
  | "planned"
  | "in_progress"
  | "paused"
  | "completed"
  | "cancelled";

export type ProjectDepartmentStatus =
  | "not_started"
  | "in_progress"
  | "ready"
  | "not_required";

export type ProjectMilestoneStatus = "planned" | "in_progress" | "done";
```

Add `Project`, `ProjectDepartment`, `ProjectMilestone`, `ProjectTaskLink`, `ProjectComment`, and `ProjectEvent` interfaces mirroring the Ideas interfaces.

Add request interfaces:

- `ProjectCreateRequest`;
- `ProjectUpdateRequest`;
- `ProjectStatusChangeRequest`;
- `ProjectDepartmentCreateRequest`;
- `ProjectDepartmentUpdateRequest`;
- `ProjectMilestoneCreateRequest`;
- `ProjectMilestoneUpdateRequest`;
- `ProjectLinkedTaskCreateRequest`.

Extend `Idea`:

```ts
project_id: string | null;
project: ProjectSummary | null;
```

- [ ] **Step 4: Add API client methods**

In `frontend/src/lib/api.ts`, add a Projects section:

```ts
async getProjects(params?: Record<string, string>): Promise<PaginatedResponse<Project>> {
  const query = params ? "?" + new URLSearchParams(params).toString() : "";
  return this.request<PaginatedResponse<Project>>(`/api/projects${query}`);
}

async createProject(data: ProjectCreateRequest): Promise<Project> {
  return this.request<Project>("/api/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async getProject(id: string): Promise<Project> {
  return this.request<Project>(`/api/projects/${id}`);
}
```

Also add update/status/department/milestone/comment/task/delete methods following the Ideas API style.

- [ ] **Step 5: Implement helper modules**

Create `frontend/src/lib/projectUtils.ts` with:

```ts
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Запланирован",
  in_progress: "В работе",
  paused: "На паузе",
  completed: "Завершён",
  cancelled: "Отменён",
};
```

Add department and milestone labels plus helpers:

- `canCompleteProject`;
- `formatProjectDepartmentProgress`;
- `formatProjectMilestoneProgress`;
- `formatProjectTaskProgress`.

Create `frontend/src/lib/projectEventUtils.ts` following `ideaEventUtils.ts`, with titles:

- `Проект создан`;
- `Проект обновлён`;
- `Статус изменён`;
- `Добавлен отдел`;
- `Отдел обновлён`;
- `Добавлен этап`;
- `Этап обновлён`;
- `Создана задача по проекту`;
- `Добавлен комментарий`;
- `Проект завершён`;
- `Проект удалён`.

- [ ] **Step 6: Update npm test script**

Add both new tests to `frontend/package.json` test script:

```text
src/lib/projectUtils.test.ts src/lib/projectEventUtils.test.ts
```

- [ ] **Step 7: Run frontend helper tests**

Run:

```bash
cd frontend && npm test
```

Expected: PASS.

- [ ] **Step 8: Commit frontend project helpers**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts frontend/src/lib/projectUtils.ts frontend/src/lib/projectUtils.test.ts frontend/src/lib/projectEventUtils.ts frontend/src/lib/projectEventUtils.test.ts frontend/package.json
git commit -m "Add project frontend helpers"
```

---

## Task 5: Project Register And Direct Project Creation UI

**Files:**
- Create: `frontend/src/components/projects/ProjectStatusBadge.tsx`
- Create: `frontend/src/components/projects/CreateProjectDialog.tsx`
- Create: `frontend/src/components/projects/ProjectFilters.tsx`
- Create: `frontend/src/components/projects/ProjectRegisterRow.tsx`
- Create: `frontend/src/app/projects/page.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/components/projects/projectSourceGuards.test.ts`

- [ ] **Step 1: Add source guard tests**

Create `frontend/src/components/projects/projectSourceGuards.test.ts`:

```ts
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("projects route exposes register and create affordances", () => {
  const page = readSource("app/projects/page.tsx");

  assert.match(page, /CreateProjectDialog/);
  assert.match(page, /ProjectFilters/);
  assert.match(page, /ProjectRegisterRow/);
});

test("sidebar exposes projects navigation", () => {
  const sidebar = readSource("components/layout/Sidebar.tsx");

  assert.match(sidebar, /href: "\\/projects"/);
  assert.match(sidebar, /label: "Проекты"/);
});
```

- [ ] **Step 2: Run source guard and verify failure**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/projects/projectSourceGuards.test.ts
```

Expected: FAIL because project UI files do not exist yet.

- [ ] **Step 3: Add project register components**

Create components mirroring Ideas:

- `ProjectStatusBadge.tsx` uses `PROJECT_STATUS_LABELS`.
- `CreateProjectDialog.tsx` collects title, description, owner, departments, and optional initial milestones.
- `ProjectFilters.tsx` supports status, owner, department, source idea, and date range.
- `ProjectRegisterRow.tsx` links to `/projects/${project.id}` and shows owner, source idea, departments, milestones, tasks, and updated date.

Use existing styled `Select`, `DatePicker`, and `Button` components. Do not use native `<select>`, `type="date"`, or native checkboxes in project dialogs/filters.

- [ ] **Step 4: Add `/projects` page**

Create `frontend/src/app/projects/page.tsx` with the same loading/error/fetch pattern as `/ideas`.

Fetch:

```ts
const [projectsRes, membersRes, departmentsRes] = await Promise.all([
  api.getProjects(buildProjectParams(filters)),
  api.getTeam().catch(() => [] as TeamMember[]),
  api.getDepartments().catch(() => [] as Department[]),
]);
```

After create, refetch the register.

- [ ] **Step 5: Add sidebar link**

Modify `frontend/src/components/layout/Sidebar.tsx`:

```ts
import { FolderKanban } from "lucide-react";

{ href: "/projects", label: "Проекты", icon: FolderKanban, section: "work" },
```

Place Projects after Ideas and before Meetings.

- [ ] **Step 6: Run frontend checks**

Run:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 7: Commit project register UI**

```bash
git add frontend/src/components/projects frontend/src/app/projects/page.tsx frontend/src/components/layout/Sidebar.tsx frontend/package.json
git commit -m "Add projects register UI"
```

---

## Task 6: Project Detail UI And Project Actions

**Files:**
- Create: `frontend/src/app/projects/[id]/page.tsx`
- Create: project detail components listed in File Structure

- [ ] **Step 1: Extend source guard tests**

Add to `projectSourceGuards.test.ts`:

```ts
test("project detail route exposes operational project panels", () => {
  const page = readSource("app/projects/[id]/page.tsx");

  assert.match(page, /ProjectStatusPanel/);
  assert.match(page, /ProjectDepartmentPanel/);
  assert.match(page, /ProjectMilestones/);
  assert.match(page, /ProjectLinkedTasks/);
  assert.match(page, /ProjectComments/);
  assert.match(page, /ProjectEventHistory/);
});
```

- [ ] **Step 2: Run source guard and verify failure**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/projects/projectSourceGuards.test.ts
```

Expected: FAIL because detail page and components do not exist yet.

- [ ] **Step 3: Build project detail page**

Create `frontend/src/app/projects/[id]/page.tsx` using the Ideas detail page structure:

- back button to `/projects`;
- header;
- create task dialog state;
- delete confirmation state;
- main column with status, departments, milestones, linked tasks, comments;
- aside with event history.

Fetch:

```ts
const [loadedProject, loadedMembers, loadedDepartments] = await Promise.all([
  api.getProject(id),
  api.getTeam().catch(() => [] as TeamMember[]),
  api.getDepartments().catch(() => [] as Department[]),
]);
```

- [ ] **Step 4: Build project action components**

Implement:

- `ProjectHeader`;
- `ProjectStatusPanel`;
- `ProjectDepartmentPanel`;
- `ProjectMilestones`;
- `ProjectLinkedTasks`;
- `CreateProjectTaskDialog`;
- `ProjectComments`;
- `ProjectEventHistory`.

Use Ideas components as the pattern, replacing labels and API calls with Projects equivalents.

`ProjectStatusPanel` must render status action buttons as outline/neutral unless the status is the current status. Avoid a filled destructive style for `Отменён`.

- [ ] **Step 5: Run frontend checks**

Run:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
```

Expected: PASS.

- [ ] **Step 6: Commit project detail UI**

```bash
git add frontend/src/app/projects/[id]/page.tsx frontend/src/components/projects
git commit -m "Add project detail UI"
```

---

## Task 7: Idea Detail Project Integration

**Files:**
- Modify: `frontend/src/app/ideas/[id]/page.tsx`
- Create: `frontend/src/components/projects/CreateProjectFromIdeaDialog.tsx`
- Modify: `backend/app/db/schemas.py`
- Modify: `backend/app/services/idea_service.py`
- Test: `frontend/src/components/projects/projectSourceGuards.test.ts`

- [ ] **Step 1: Add source guard for idea integration**

Add to `projectSourceGuards.test.ts`:

```ts
test("idea detail route exposes project conversion affordance", () => {
  const page = readSource("app/ideas/[id]/page.tsx");

  assert.match(page, /CreateProjectFromIdeaDialog/);
  assert.match(page, /Создать проект/);
  assert.match(page, /\\/projects\\/\\$\\{idea\\.project\\.id\\}/);
});
```

- [ ] **Step 2: Run source guard and verify failure**

Run:

```bash
cd frontend && node --test --experimental-strip-types src/components/projects/projectSourceGuards.test.ts
```

Expected: FAIL because idea detail does not expose project conversion yet.

- [ ] **Step 3: Ensure backend ideas include project summary**

If not already completed in Task 3, update the backend so `IdeaResponse.project` is present when `idea.project_id` points to a non-deleted project.

The shaped idea should include:

```json
{
  "project_id": "uuid-or-null",
  "project": {
    "id": "uuid",
    "title": "Project title",
    "status": "planned"
  }
}
```

- [ ] **Step 4: Add CreateProjectFromIdeaDialog**

Create `frontend/src/components/projects/CreateProjectFromIdeaDialog.tsx`.

Props:

```ts
interface CreateProjectFromIdeaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idea: Idea;
  members: TeamMember[];
  onCreated: (project: Project) => void;
}
```

Submit payload:

```ts
await api.createProject({
  title,
  description,
  owner_id: ownerId,
  source_idea_id: idea.id,
  department_ids: selectedDepartmentIds,
});
```

- [ ] **Step 5: Add idea detail UI**

In `frontend/src/app/ideas/[id]/page.tsx`:

- add dialog state;
- add a `Создать проект` button when `idea.project` is null and `idea.status` is `accepted` or `in_tasks`;
- add a compact project link card when `idea.project` exists;
- after project creation, navigate to `/projects/${project.id}`.

- [ ] **Step 6: Run checks**

Run:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit idea/project integration**

```bash
git add frontend/src/app/ideas/[id]/page.tsx frontend/src/components/projects/CreateProjectFromIdeaDialog.tsx backend/app/db/schemas.py backend/app/services/idea_service.py frontend/src/components/projects/projectSourceGuards.test.ts
git commit -m "Link ideas to projects"
```

---

## Task 8: Final Verification And Documentation

**Files:**
- Modify: `docs/PLAN.md`
- Modify: `docs/STATUS.md`

- [ ] **Step 1: Run targeted backend tests**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest tests/test_project_service.py tests/test_projects_api.py -q
```

Expected: PASS.

- [ ] **Step 2: Run full backend tests**

Run:

```bash
cd backend && env PYTHONPATH=$PWD DEBUG=true BOT_TOKEN=123456:TEST DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/test OPENAI_API_KEY=test pytest -q
```

Expected: PASS.

- [ ] **Step 3: Run frontend verification**

Run:

```bash
cd frontend && npm test
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm run build
```

Expected: PASS.

- [ ] **Step 4: Run diff check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 5: Update docs**

Update `docs/PLAN.md` and `docs/STATUS.md`:

- mark Projects Phase 2 as implemented;
- record exact test counts from the verification commands;
- keep the spec and plan links;
- note that direct Idea -> Tasks support remains available.

- [ ] **Step 6: Commit docs and final verification**

```bash
git add docs/PLAN.md docs/STATUS.md
git commit -m "Record projects phase two verification"
```

---

## Self-Review Checklist

- Spec coverage:
  - Project register/detail: Tasks 5 and 6.
  - Direct project creation: Tasks 3 and 5.
  - Project from idea: Tasks 3 and 7.
  - Departments: Tasks 1, 2, 3, and 6.
  - Milestones: Tasks 1, 2, 3, and 6.
  - Linked tasks: Tasks 2, 3, and 6.
  - Task visibility: Tasks 2 and 3.
  - Soft deletion: Tasks 1, 2, 3, and 6.
  - Docs and validation: Task 8.
- Placeholder scan:
  - No unresolved implementation markers were found.
- Type consistency:
  - Backend names use `Project`, `ProjectDepartment`, `ProjectMilestone`, `ProjectTask`, `ProjectComment`, `ProjectEvent`.
  - Frontend names use `Project`, `ProjectDepartment`, `ProjectMilestone`, `ProjectTaskLink`, `ProjectComment`, `ProjectEvent`.
  - Status values match the approved spec.
