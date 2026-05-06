import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy.exc import IntegrityError

from app.db.models import Task, TaskLabel, TaskLabelLink
from app.db.repositories import (
    LABEL_COLOR_PALETTE,
    TaskLabelRepository,
    normalize_task_label_name,
    slugify_task_label,
)


class TaskLabelModelTests(unittest.TestCase):
    def test_task_label_columns_exist(self) -> None:
        columns = TaskLabel.__table__.columns
        self.assertIn("name", columns)
        self.assertIn("slug", columns)
        self.assertIn("color", columns)
        self.assertIn("created_by_id", columns)
        self.assertIn("is_archived", columns)

    def test_task_label_link_columns_exist(self) -> None:
        columns = TaskLabelLink.__table__.columns
        self.assertIn("task_id", columns)
        self.assertIn("label_id", columns)
        self.assertIn("created_at", columns)

    def test_task_has_labels_relationship(self) -> None:
        self.assertTrue(hasattr(Task, "labels"))


class TaskLabelNormalizationTests(unittest.TestCase):
    def test_normalize_label_name_trims_and_collapses_spaces(self) -> None:
        self.assertEqual(normalize_task_label_name("  VK   Launch  "), "VK Launch")

    def test_normalize_label_name_rejects_empty(self) -> None:
        with self.assertRaises(ValueError):
            normalize_task_label_name("   ")

    def test_normalize_label_name_rejects_long_names(self) -> None:
        with self.assertRaises(ValueError):
            normalize_task_label_name("x" * 81)

    def test_slugify_label_is_case_insensitive(self) -> None:
        self.assertEqual(slugify_task_label(" VK Launch "), slugify_task_label("vk launch"))

    def test_palette_is_non_empty(self) -> None:
        self.assertGreater(len(LABEL_COLOR_PALETTE), 0)


class TaskLabelRepositoryTests(unittest.IsolatedAsyncioTestCase):
    async def test_create_or_reactivate_returns_existing_active_label(self) -> None:
        existing = SimpleNamespace(
            id=uuid.uuid4(),
            name="Conference",
            slug="conference",
            color="teal",
            is_archived=False,
        )
        session = MagicMock()
        repo = TaskLabelRepository()
        repo.get_by_slug = AsyncMock(return_value=existing)

        result = await repo.create_or_reactivate(
            session,
            name=" conference ",
            created_by_id=uuid.uuid4(),
        )

        self.assertIs(result, existing)
        session.add.assert_not_called()

    async def test_create_or_reactivate_unarchives_existing_label(self) -> None:
        archived = SimpleNamespace(
            id=uuid.uuid4(),
            name="Conference",
            slug="conference",
            color="teal",
            is_archived=True,
        )
        session = MagicMock()
        session.flush = AsyncMock()
        repo = TaskLabelRepository()
        repo.get_by_slug = AsyncMock(return_value=archived)

        result = await repo.create_or_reactivate(
            session,
            name="Conference",
            created_by_id=uuid.uuid4(),
        )

        self.assertIs(result, archived)
        self.assertFalse(archived.is_archived)
        session.flush.assert_awaited_once()

    async def test_create_or_reactivate_returns_existing_label_after_insert_race(self) -> None:
        existing = SimpleNamespace(
            id=uuid.uuid4(),
            name="Conference",
            slug="conference",
            color="teal",
            is_archived=False,
        )
        session = MagicMock()
        session.flush = AsyncMock(
            side_effect=IntegrityError("insert task label", {}, Exception("duplicate"))
        )
        session.rollback = AsyncMock()
        repo = TaskLabelRepository()
        repo.get_by_slug = AsyncMock(side_effect=[None, existing])

        result = await repo.create_or_reactivate(
            session,
            name="Conference",
            created_by_id=uuid.uuid4(),
        )

        self.assertIs(result, existing)
        session.rollback.assert_awaited_once()
        self.assertEqual(repo.get_by_slug.await_count, 2)
