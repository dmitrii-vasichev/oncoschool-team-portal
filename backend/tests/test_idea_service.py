import asyncio
import unittest
import uuid
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from pydantic import ValidationError
from sqlalchemy.dialects import postgresql
from sqlalchemy import ForeignKeyConstraint, UniqueConstraint
from sqlalchemy.orm import configure_mappers

from app.db import models
from app.db.repositories import IdeaRepository
from app.db.schemas import IdeaCreate, IdeaStatusChange, IdeaTaskResponse
from app.services.idea_service import IdeaService


def member(role: str = "member", *, member_id: uuid.UUID | None = None):
    return SimpleNamespace(id=member_id or uuid.uuid4(), role=role)


def idea(**overrides):
    base = {
        "id": uuid.uuid4(),
        "title": "Improve reports",
        "description": "Useful details",
        "status": "accepted",
        "author_id": uuid.uuid4(),
        "review_owner_id": uuid.uuid4(),
        "decision_comment": None,
        "decision_by_id": None,
        "decision_at": None,
        "deferred_until": None,
        "completed_at": None,
        "created_at": datetime(2026, 1, 1, 12, 0, 0),
        "updated_at": datetime(2026, 1, 1, 12, 0, 0),
        "departments": [],
        "task_links": [],
        "comments": [],
        "events": [],
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


def task_link(status: str, **overrides):
    now = datetime(2026, 1, 1, 12, 0, 0)
    base = {
        "id": uuid.uuid4(),
        "idea_id": uuid.uuid4(),
        "idea_department_id": None,
        "task_id": uuid.uuid4(),
        "created_by_id": None,
        "created_at": now,
        "task": SimpleNamespace(
            id=uuid.uuid4(),
            short_id=1,
            title="Linked task",
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


class IdeaRepositoryTests(unittest.TestCase):
    def test_detail_options_eager_loads_task_response_relationships_for_idea_links(self) -> None:
        option_paths = [str(option.path) for option in IdeaRepository().detail_options()]

        for relationship in ("Task.assignee", "Task.created_by", "Task.labels"):
            self.assertTrue(
                any(
                    "Idea.departments" in path
                    and "IdeaDepartment.task_links" in path
                    and "IdeaTask.task" in path
                    and relationship in path
                    for path in option_paths
                )
            )
            self.assertTrue(
                any(
                    "Idea.task_links" in path
                    and "IdeaTask.task" in path
                    and relationship in path
                    for path in option_paths
                )
            )

    def test_list_filters_by_search_term_in_title_or_description(self) -> None:
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
            await IdeaRepository().list(session, search=" Reports ")
            return session

        session = asyncio.run(run_list())
        list_stmt = session.statements[1]
        compiled = str(
            list_stmt.compile(
                dialect=postgresql.dialect(),
                compile_kwargs={"literal_binds": True},
            )
        )

        self.assertIn("ideas.title ILIKE '%%Reports%%'", compiled)
        self.assertIn("ideas.description ILIKE '%%Reports%%'", compiled)

    def test_add_task_link_sets_idea_and_department_ids(self) -> None:
        class FakeSession:
            def __init__(self) -> None:
                self.added = None

            def add(self, item) -> None:
                self.added = item

            async def flush(self) -> None:
                pass

        async def run_add() -> FakeSession:
            session = FakeSession()
            await IdeaRepository().add_task_link(
                session,
                idea_id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
                idea_department_id=uuid.UUID("00000000-0000-0000-0000-000000000002"),
                task_id=uuid.UUID("00000000-0000-0000-0000-000000000003"),
                created_by_id=uuid.UUID("00000000-0000-0000-0000-000000000004"),
            )
            return session

        session = asyncio.run(run_add())

        self.assertEqual(session.added.idea_id, uuid.UUID("00000000-0000-0000-0000-000000000001"))
        self.assertEqual(session.added.idea_department_id, uuid.UUID("00000000-0000-0000-0000-000000000002"))


class IdeaSchemaTests(unittest.TestCase):
    def test_create_idea_requires_non_empty_title_and_description(self) -> None:
        with self.assertRaises(ValidationError):
            IdeaCreate(title="", description="Useful details", review_owner_id="00000000-0000-0000-0000-000000000001")

        with self.assertRaises(ValidationError):
            IdeaCreate(title="Improve reports", description="", review_owner_id="00000000-0000-0000-0000-000000000001")

    def test_rejected_and_deferred_status_changes_require_reason(self) -> None:
        with self.assertRaises(ValidationError):
            IdeaStatusChange(status="rejected")

        with self.assertRaises(ValidationError):
            IdeaStatusChange(status="deferred")

        with self.assertRaises(ValidationError):
            IdeaStatusChange(status="rejected", comment="")

        with self.assertRaises(ValidationError):
            IdeaStatusChange(status="deferred", comment="   ")

    def test_accepted_status_change_allows_empty_comment(self) -> None:
        data = IdeaStatusChange(status="accepted")
        self.assertEqual(data.status, "accepted")
        self.assertIsNone(data.comment)

    def test_status_change_rejects_non_string_comment_with_validation_error(self) -> None:
        with self.assertRaises(ValidationError):
            IdeaStatusChange(status="accepted", comment=123)

    def test_task_response_validates_from_orm_like_object(self) -> None:
        link = SimpleNamespace(
            id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
            idea_id=uuid.UUID("00000000-0000-0000-0000-000000000002"),
            idea_department_id=None,
            task_id=uuid.UUID("00000000-0000-0000-0000-000000000003"),
            created_by_id=None,
            created_at=datetime(2026, 1, 1, 12, 0, 0),
            task=None,
            hidden=False,
        )

        data = IdeaTaskResponse.model_validate(link)

        self.assertEqual(data.id, link.id)
        self.assertEqual(data.task_id, link.task_id)


class IdeaServiceRuleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = IdeaService()

    def test_rejected_and_deferred_status_changes_require_reason(self) -> None:
        for status in ("rejected", "deferred"):
            with self.subTest(status=status, comment=None):
                with self.assertRaises(ValueError):
                    self.service.validate_status_change(status, None)

            with self.subTest(status=status, comment="   "):
                with self.assertRaises(ValueError):
                    self.service.validate_status_change(status, "   ")

        self.service.validate_status_change("accepted", None)

    def test_review_owner_can_manage_idea(self) -> None:
        owner_id = uuid.uuid4()
        item = idea(review_owner_id=owner_id)

        self.assertTrue(self.service.can_manage_idea(member(member_id=owner_id), item))
        self.assertTrue(self.service.can_manage_idea(member("moderator"), item))
        self.assertFalse(self.service.can_manage_idea(member(), item))

    def test_department_head_can_manage_own_department(self) -> None:
        head_id = uuid.uuid4()
        dept = idea_department(department=SimpleNamespace(head_id=head_id))

        self.assertTrue(
            self.service.can_manage_idea_department(
                member(member_id=head_id),
                idea(review_owner_id=uuid.uuid4()),
                dept,
            )
        )

    def test_department_head_can_add_own_department_to_accepted_idea(self) -> None:
        head_id = uuid.uuid4()
        dept = department(head_id=head_id)

        self.assertTrue(
            self.service.can_add_department(
                member(member_id=head_id),
                idea(status="accepted"),
                dept,
            )
        )
        self.assertFalse(
            self.service.can_add_department(
                member(member_id=head_id),
                idea(status="new"),
                dept,
            )
        )

    def test_no_department_completion_requires_direct_closed_task_links(self) -> None:
        self.assertFalse(self.service.can_complete_idea(idea(task_links=[])))
        self.assertTrue(
            self.service.can_complete_idea(
                idea(task_links=[task_link("done"), task_link("cancelled")])
            )
        )
        self.assertFalse(
            self.service.can_complete_idea(
                idea(task_links=[task_link("done"), task_link("in_progress")])
            )
        )

    def test_department_completion_requires_every_department_ready_or_not_required(self) -> None:
        self.assertTrue(
            self.service.can_complete_idea(
                idea(
                    departments=[
                        idea_department(status="ready"),
                        idea_department(status="not_required"),
                    ]
                )
            )
        )
        self.assertFalse(
            self.service.can_complete_idea(
                idea(
                    departments=[
                        idea_department(status="ready"),
                        idea_department(status="not_started"),
                    ]
                )
            )
        )

    def test_shape_response_counts_hidden_closed_task_as_completed(self) -> None:
        item = idea()
        link = task_link("done", idea_id=item.id)
        item.task_links = [link]

        async def run_shape():
            with patch(
                "app.services.idea_service.can_access_task",
                new=AsyncMock(return_value=False),
            ):
                return await self.service.shape_response(
                    SimpleNamespace(),
                    member(),
                    item,
                )

        response = asyncio.run(run_shape())

        self.assertEqual(response.linked_task_count, 1)
        self.assertEqual(response.hidden_linked_task_count, 1)
        self.assertEqual(response.completed_linked_task_count, 1)
        self.assertIsNone(response.task_links[0].task)
