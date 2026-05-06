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

    def test_palette_contains_management_colors(self) -> None:
        self.assertEqual(
            LABEL_COLOR_PALETTE,
            ("teal", "blue", "purple", "gold", "green", "coral", "rose", "slate"),
        )

    def test_validate_label_color_accepts_palette_value(self) -> None:
        from app.db.repositories import validate_task_label_color

        self.assertEqual(validate_task_label_color("rose"), "rose")

    def test_validate_label_color_rejects_unknown_value(self) -> None:
        from app.db.repositories import validate_task_label_color

        with self.assertRaises(ValueError) as ctx:
            validate_task_label_color("neon")

        self.assertEqual(str(ctx.exception), "Unknown task label color")


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
            color="teal",
        )

        self.assertIs(result, existing)
        session.add.assert_not_called()

    async def test_create_or_reactivate_rejects_archived_existing_label(self) -> None:
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

        with self.assertRaises(ValueError) as ctx:
            await repo.create_or_reactivate(
                session,
                name="Conference",
                created_by_id=uuid.uuid4(),
                color="teal",
            )

        self.assertEqual(str(ctx.exception), "Archived task label already exists")
        session.flush.assert_not_called()

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
            color="teal",
        )

        self.assertIs(result, existing)
        session.rollback.assert_awaited_once()
        self.assertEqual(repo.get_by_slug.await_count, 2)

    async def test_search_scopes_usage_counts_to_visible_departments(self) -> None:
        session = MagicMock()
        session.execute = AsyncMock(return_value=SimpleNamespace(all=lambda: []))
        repo = TaskLabelRepository()

        await repo.search(
            session,
            visible_department_ids=[uuid.uuid4()],
            fallback_member_id=uuid.uuid4(),
        )

        stmt = session.execute.await_args.args[0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": False}))
        self.assertIn("tasks", compiled)
        self.assertIn("team_members", compiled)
        self.assertIn("department_id", compiled)

    async def test_search_falls_back_to_own_tasks_without_department_scope(self) -> None:
        session = MagicMock()
        session.execute = AsyncMock(return_value=SimpleNamespace(all=lambda: []))
        repo = TaskLabelRepository()
        member_id = uuid.uuid4()

        await repo.search(
            session,
            visible_department_ids=[],
            fallback_member_id=member_id,
        )

        stmt = session.execute.await_args.args[0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": False}))
        self.assertIn("tasks", compiled)
        self.assertIn("assignee_id", compiled)
        self.assertNotIn("team_members", compiled)

    async def test_update_label_changes_name_slug_and_color(self) -> None:
        label_id = uuid.uuid4()
        label = SimpleNamespace(
            id=label_id,
            name="Conference",
            slug="conference",
            color="teal",
            is_archived=False,
        )
        session = MagicMock()
        session.flush = AsyncMock()
        repo = TaskLabelRepository()
        repo.get_by_id = AsyncMock(return_value=label)
        repo.get_by_slug = AsyncMock(return_value=None)

        result = await repo.update(session, label_id, name=" Partner  Event ", color="rose")

        self.assertIs(result, label)
        self.assertEqual(label.name, "Partner Event")
        self.assertEqual(label.slug, "partner event")
        self.assertEqual(label.color, "rose")
        session.flush.assert_awaited_once()

    async def test_update_label_rejects_duplicate_slug(self) -> None:
        label_id = uuid.uuid4()
        other_id = uuid.uuid4()
        label = SimpleNamespace(
            id=label_id,
            name="Conference",
            slug="conference",
            color="teal",
            is_archived=False,
        )
        duplicate = SimpleNamespace(id=other_id, slug="partners", is_archived=False)
        session = MagicMock()
        session.flush = AsyncMock()
        repo = TaskLabelRepository()
        repo.get_by_id = AsyncMock(return_value=label)
        repo.get_by_slug = AsyncMock(return_value=duplicate)

        with self.assertRaises(ValueError) as ctx:
            await repo.update(session, label_id, name="Partners")

        self.assertEqual(str(ctx.exception), "Task label name already exists")

    async def test_archive_sets_is_archived(self) -> None:
        label = SimpleNamespace(id=uuid.uuid4(), is_archived=False)
        session = MagicMock()
        session.flush = AsyncMock()
        repo = TaskLabelRepository()
        repo.get_by_id = AsyncMock(return_value=label)

        result = await repo.archive(session, label.id)

        self.assertIs(result, label)
        self.assertTrue(label.is_archived)
        session.flush.assert_awaited_once()

    async def test_restore_clears_is_archived(self) -> None:
        label = SimpleNamespace(id=uuid.uuid4(), is_archived=True)
        session = MagicMock()
        session.flush = AsyncMock()
        repo = TaskLabelRepository()
        repo.get_by_id = AsyncMock(return_value=label)

        result = await repo.restore(session, label.id)

        self.assertIs(result, label)
        self.assertFalse(label.is_archived)
        session.flush.assert_awaited_once()

    async def test_is_shared_for_member_checks_author_and_assignee(self) -> None:
        session = MagicMock()
        session.execute = AsyncMock(return_value=SimpleNamespace(scalar_one=lambda: 1))
        repo = TaskLabelRepository()

        result = await repo.is_shared_for_member(
            session,
            label_id=uuid.uuid4(),
            member_id=uuid.uuid4(),
        )

        self.assertTrue(result)
        stmt = session.execute.await_args.args[0]
        compiled = str(stmt.compile(compile_kwargs={"literal_binds": False}))
        self.assertIn("created_by_id", compiled)
        self.assertIn("assignee_id", compiled)
        self.assertIn("IS NULL", compiled)
