import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.api import tasks as tasks_api
from app.services.task_service import TaskService


class TaskLabelTaskApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_create_task_passes_label_ids_to_service(self) -> None:
        label_ids = [uuid.uuid4(), uuid.uuid4()]
        task = SimpleNamespace(id=uuid.uuid4(), labels=[])
        member = SimpleNamespace(id=uuid.uuid4(), role="member")
        session = SimpleNamespace(commit=AsyncMock())
        request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(bot=None)))

        with patch.object(
            tasks_api.task_service,
            "create_task",
            AsyncMock(return_value=task),
        ) as create_mock:
            response = await tasks_api.create_task(
                request=request,
                data=tasks_api.TaskCreate(title="Task", label_ids=label_ids),
                member=member,
                session=session,
            )

        self.assertIs(response, task)
        self.assertEqual(create_mock.await_args.kwargs["label_ids"], label_ids)
        session.commit.assert_awaited_once()

    async def test_parse_label_ids_csv(self) -> None:
        first = uuid.uuid4()
        second = uuid.uuid4()
        self.assertEqual(
            tasks_api._parse_label_ids_filter(f"{first},{second}"),
            [first, second],
        )

    async def test_parse_label_ids_empty_string(self) -> None:
        self.assertEqual(tasks_api._parse_label_ids_filter(""), [])

    async def test_apply_label_filter_joins_labels(self) -> None:
        stmt = MagicMock()
        joined = MagicMock()
        filtered = MagicMock()
        distinct_stmt = MagicMock()
        stmt.join.return_value = joined
        joined.where.return_value = filtered
        filtered.distinct.return_value = distinct_stmt
        label_id = uuid.uuid4()

        result = tasks_api._apply_label_filter(stmt, [label_id])

        self.assertIs(result, distinct_stmt)
        stmt.join.assert_called_once()
        joined.where.assert_called_once()
        filtered.distinct.assert_called_once()

    async def test_task_service_create_task_replaces_labels_when_provided(self) -> None:
        label_ids = [uuid.uuid4(), uuid.uuid4()]
        creator = SimpleNamespace(id=uuid.uuid4(), role="member")
        task = SimpleNamespace(id=uuid.uuid4(), assignee_id=creator.id)
        labeled_task = SimpleNamespace(id=task.id, assignee_id=creator.id, labels=[])
        service = TaskService()
        service.task_repo.create = AsyncMock(return_value=task)
        service.in_app_notifications.notify_task_assigned = AsyncMock()
        service.in_app_notifications.notify_task_created_unassigned = AsyncMock()
        session = SimpleNamespace()

        with patch(
            "app.db.repositories.TaskLabelRepository.replace_task_labels",
            AsyncMock(return_value=labeled_task),
        ) as replace_mock:
            result = await service.create_task(
                session,
                title="Task",
                creator=creator,
                label_ids=label_ids,
            )

        self.assertIs(result, labeled_task)
        replace_mock.assert_awaited_once_with(session, task, label_ids)

    async def test_replace_task_labels_rejects_new_archived_label(self) -> None:
        active = SimpleNamespace(id=uuid.uuid4(), is_archived=False)
        archived = SimpleNamespace(id=uuid.uuid4(), is_archived=True)
        task = SimpleNamespace(labels=[active])
        session = SimpleNamespace()
        repo = tasks_api.TaskLabelRepository()
        repo.get_by_ids = AsyncMock(return_value=[archived])

        with self.assertRaises(ValueError) as ctx:
            await repo.replace_task_labels(session, task, [archived.id])

        self.assertEqual(str(ctx.exception), "Архивные метки нельзя добавить к задаче")

    async def test_replace_task_labels_preserves_existing_archived_label(self) -> None:
        archived = SimpleNamespace(id=uuid.uuid4(), is_archived=True)
        task = SimpleNamespace(labels=[archived])
        session = SimpleNamespace()
        repo = tasks_api.TaskLabelRepository()
        repo.get_by_ids = AsyncMock(return_value=[archived])

        result = await repo.replace_task_labels(session, task, [archived.id])

        self.assertIs(result, task)
        self.assertEqual(task.labels, [archived])
