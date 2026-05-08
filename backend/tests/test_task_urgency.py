import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.api import tasks as tasks_api
from app.db.schemas import TaskCreate, TaskEdit
from app.services.task_service import TaskService


class TaskUrgencyTests(unittest.IsolatedAsyncioTestCase):
    def test_normalize_task_urgency_maps_legacy_values(self) -> None:
        from app.services.task_urgency import normalize_task_urgency

        cases = {
            "urgent": "urgent",
            "high": "urgent",
            "срочно": "urgent",
            "важно": "urgent",
            "medium": "normal",
            "low": "normal",
            "normal": "normal",
            "обычная": "normal",
            "не срочно": "normal",
            None: "normal",
            "": "normal",
            "unknown": "normal",
        }

        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(normalize_task_urgency(raw), expected)

    def test_task_create_normalizes_legacy_priority(self) -> None:
        self.assertEqual(TaskCreate(title="Task", priority="high").priority, "urgent")
        self.assertEqual(TaskCreate(title="Task", priority="low").priority, "normal")
        self.assertEqual(TaskCreate(title="Task").priority, "normal")

    def test_task_edit_normalizes_legacy_priority_when_present(self) -> None:
        self.assertEqual(TaskEdit(priority="high").priority, "urgent")
        self.assertEqual(TaskEdit(priority="medium").priority, "normal")
        self.assertIsNone(TaskEdit().priority)

    def test_parse_task_text_maps_legacy_markers_to_binary_urgency(self) -> None:
        urgent = TaskService.parse_task_text("Запустить отчет !high @26.02.2026")
        normal = TaskService.parse_task_text("Проверить письмо !low")

        self.assertEqual(urgent["title"], "Запустить отчет")
        self.assertEqual(urgent["priority"], "urgent")
        self.assertEqual(urgent["deadline"], date(2026, 2, 26))
        self.assertEqual(normal["title"], "Проверить письмо")
        self.assertEqual(normal["priority"], "normal")

    async def test_create_task_normalizes_priority_before_persistence(self) -> None:
        service = TaskService()
        creator = SimpleNamespace(id="creator-id", role="member")
        task = SimpleNamespace(id="task-id", assignee_id="creator-id")
        service.task_repo.create = AsyncMock(return_value=task)
        service.in_app_notifications.notify_task_assigned = AsyncMock()
        service.in_app_notifications.notify_task_created_unassigned = AsyncMock()

        await service.create_task(
            SimpleNamespace(),
            title="Task",
            creator=creator,
            priority="high",
        )

        self.assertEqual(service.task_repo.create.await_args.kwargs["priority"], "urgent")

    async def test_list_tasks_normalizes_priority_filter(self) -> None:
        member = SimpleNamespace(id="member-id", role="moderator")
        execute_result = MagicMock()
        execute_result.scalar_one.return_value = 0
        execute_result.scalars.return_value.all.return_value = []
        session = SimpleNamespace(execute=AsyncMock(return_value=execute_result))

        with patch.object(
            tasks_api,
            "resolve_visible_department_ids",
            AsyncMock(return_value=None),
        ), patch.object(
            tasks_api,
            "normalize_task_urgency",
            return_value="urgent",
        ) as normalize_mock:
            await tasks_api.list_tasks(
                assignee_id=None,
                created_by_id=None,
                department_id=None,
                status_filter=None,
                priority="high",
                meeting_id=None,
                source=None,
                search=None,
                label_ids=None,
                has_overdue=None,
                completed_since=None,
                sort="created_at_desc",
                page=1,
                per_page=50,
                member=member,
                session=session,
            )

        normalize_mock.assert_called_once_with("high")

    def test_ai_priority_normalizer_maps_legacy_values_to_binary_urgency(self) -> None:
        from app.bot.handlers.tasks import _normalize_ai_priority

        self.assertEqual(_normalize_ai_priority("high"), "urgent")
        self.assertEqual(_normalize_ai_priority("urgent"), "urgent")
        self.assertEqual(_normalize_ai_priority("medium"), "normal")
        self.assertEqual(_normalize_ai_priority("low"), "normal")
        self.assertEqual(_normalize_ai_priority("unexpected"), "normal")

    def test_bot_priority_input_accepts_binary_and_legacy_aliases(self) -> None:
        from app.bot.handlers.tasks import _normalize_priority_input

        self.assertEqual(_normalize_priority_input("срочно"), "urgent")
        self.assertEqual(_normalize_priority_input("high"), "urgent")
        self.assertEqual(_normalize_priority_input("обычная"), "normal")
        self.assertEqual(_normalize_priority_input("low"), "normal")
