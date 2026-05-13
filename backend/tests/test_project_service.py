import unittest
import uuid
from datetime import datetime
from types import SimpleNamespace

from sqlalchemy import ForeignKeyConstraint, UniqueConstraint
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import configure_mappers

from app.db import models

try:
    from app.db.repositories import ProjectRepository
except ImportError as exc:
    if "ProjectRepository" not in str(exc):
        raise
    ProjectRepository = None

_POSTGRESQL_DIALECT_FACTORY = postgresql.dialect
_PROJECT_REPOSITORY_IMPORT = ProjectRepository


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
