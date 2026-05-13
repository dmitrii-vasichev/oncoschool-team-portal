import asyncio
import unittest
import uuid
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from sqlalchemy import ForeignKeyConstraint, UniqueConstraint
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import configure_mappers

from app.db import models


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


def task_link(status: str, **overrides):
    now = datetime(2026, 5, 13, 12, 0, 0)
    base = {
        "id": uuid.uuid4(),
        "project_id": uuid.uuid4(),
        "project_department_id": None,
        "task_id": uuid.uuid4(),
        "created_by_id": None,
        "created_at": now,
        "task": SimpleNamespace(
            id=uuid.uuid4(),
            short_id=1,
            title="Linked project task",
            description=None,
            checklist=[],
            status=status,
            priority="normal",
            assignee_id=None,
            created_by_id=None,
            meeting_id=None,
            source="text",
            deadline=None,
            reminder_at=None,
            reminder_comment=None,
            reminder_sent_at=None,
            completed_at=now if status == "done" else None,
            created_at=now,
            updated_at=now,
            labels=[],
        ),
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def project_department(**overrides):
    now = datetime(2026, 5, 13, 12, 0, 0)
    base = {
        "id": uuid.uuid4(),
        "project_id": uuid.uuid4(),
        "department_id": uuid.uuid4(),
        "owner_id": uuid.uuid4(),
        "status": "not_started",
        "note": None,
        "created_by_id": None,
        "created_at": now,
        "updated_at": now,
        "department": None,
        "owner": None,
        "task_links": [],
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


class ProjectRepositoryTests(unittest.TestCase):
    def test_list_excludes_soft_deleted_projects(self) -> None:
        from app.db.repositories import ProjectRepository

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

        session = asyncio.run(run_list())
        list_stmt = session.statements[1]
        compiled = str(
            list_stmt.compile(
                dialect=postgresql.dialect(),
                compile_kwargs={"literal_binds": True},
            )
        )

        self.assertIn("projects.deleted_at IS NULL", compiled)


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

        self.assertTrue(
            self.service.can_manage_project(member(member_id=owner_id), item)
        )
        self.assertTrue(self.service.can_manage_project(member("moderator"), item))
        self.assertFalse(self.service.can_manage_project(member(), item))

    def test_project_with_open_task_cannot_complete(self) -> None:
        item = project(task_links=[task_link("in_progress")])

        self.assertFalse(self.service.can_complete_project(item))

    def test_project_with_closed_tasks_can_complete(self) -> None:
        item = project(task_links=[task_link("done"), task_link("cancelled")])

        self.assertTrue(self.service.can_complete_project(item))

    def test_project_without_tasks_cannot_complete(self) -> None:
        self.assertFalse(self.service.can_complete_project(project()))

    def test_delete_requires_no_linked_tasks(self) -> None:
        item = project(task_links=[task_link("done")])

        self.assertFalse(self.service.can_delete_project(member("admin"), item))

    def test_shape_response_counts_hidden_tasks_without_returning_rows(self) -> None:
        project_id = uuid.uuid4()
        department_id = uuid.uuid4()
        visible_link = task_link("done", project_id=project_id)
        hidden_direct_link = task_link("in_progress", project_id=project_id)
        hidden_link = task_link(
            "in_progress",
            project_id=project_id,
            project_department_id=department_id,
        )
        department = project_department(
            id=department_id,
            project_id=project_id,
            task_links=[hidden_link],
        )
        item = project(
            id=project_id,
            task_links=[visible_link, hidden_direct_link],
            departments=[department],
        )

        async def run_shape():
            with patch(
                "app.services.project_service.can_access_task",
                new=AsyncMock(side_effect=[True, False, False]),
            ):
                return await self.service.shape_response(
                    SimpleNamespace(),
                    member(),
                    item,
                )

        response = asyncio.run(run_shape())

        self.assertEqual(response.linked_task_count, 3)
        self.assertEqual(response.visible_linked_task_count, 1)
        self.assertEqual(response.hidden_linked_task_count, 2)
        self.assertEqual([link.id for link in response.task_links], [visible_link.id])
        self.assertEqual(response.departments[0].task_links, [])
