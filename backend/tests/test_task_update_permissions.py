import unittest
import uuid
from datetime import date, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.api import tasks as tasks_api


class TaskUpdatePermissionsTests(unittest.IsolatedAsyncioTestCase):
    async def test_member_assignee_can_update_title(self) -> None:
        member_id = uuid.uuid4()
        task = SimpleNamespace(
            id=uuid.uuid4(),
            assignee_id=member_id,
            created_by_id=uuid.uuid4(),
            status="new",
            assignee=None,
        )
        updated_task = SimpleNamespace(id=task.id)
        member = SimpleNamespace(id=member_id, role="member")
        session = SimpleNamespace(commit=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(bot=None))
        )

        with patch.object(
            tasks_api.task_service,
            "get_task_by_short_id",
            AsyncMock(return_value=task),
        ), patch.object(
            tasks_api,
            "can_access_task",
            AsyncMock(return_value=True),
        ), patch(
            "app.db.repositories.TaskRepository.update",
            AsyncMock(return_value=updated_task),
        ) as repo_update_mock:
            response = await tasks_api.update_task(
                request=request,
                short_id=101,
                data=tasks_api.TaskEdit(title="  Обновлённый заголовок  "),
                member=member,
                session=session,
            )

        self.assertIs(response, updated_task)
        repo_update_mock.assert_awaited_once_with(
            session, task.id, title="Обновлённый заголовок"
        )
        session.commit.assert_awaited_once()

    async def test_member_assignee_cannot_update_description(self) -> None:
        member_id = uuid.uuid4()
        task = SimpleNamespace(
            id=uuid.uuid4(),
            assignee_id=member_id,
            created_by_id=uuid.uuid4(),
            status="new",
            assignee=None,
        )
        member = SimpleNamespace(id=member_id, role="member")
        session = SimpleNamespace(commit=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(bot=None))
        )

        with patch.object(
            tasks_api.task_service,
            "get_task_by_short_id",
            AsyncMock(return_value=task),
        ), patch.object(
            tasks_api,
            "can_access_task",
            AsyncMock(return_value=True),
        ), patch(
            "app.db.repositories.TaskRepository.update",
            AsyncMock(),
        ) as repo_update_mock:
            with self.assertRaises(HTTPException) as ctx:
                await tasks_api.update_task(
                    request=request,
                    short_id=101,
                    data=tasks_api.TaskEdit(description="Новый текст"),
                    member=member,
                    session=session,
                )

        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("description", str(ctx.exception.detail))
        repo_update_mock.assert_not_awaited()
        session.commit.assert_not_awaited()

    async def test_member_assignee_cannot_reassign_without_author_rights(self) -> None:
        member_id = uuid.uuid4()
        task = SimpleNamespace(
            id=uuid.uuid4(),
            assignee_id=member_id,
            created_by_id=uuid.uuid4(),
            status="new",
            assignee=None,
        )
        member = SimpleNamespace(id=member_id, role="member")
        session = SimpleNamespace(commit=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(bot=None))
        )

        with patch.object(
            tasks_api.task_service,
            "get_task_by_short_id",
            AsyncMock(return_value=task),
        ), patch.object(
            tasks_api,
            "can_access_task",
            AsyncMock(return_value=True),
        ), patch.object(
            tasks_api.task_service,
            "assign_task",
            AsyncMock(),
        ) as assign_mock:
            with self.assertRaises(HTTPException) as ctx:
                await tasks_api.update_task(
                    request=request,
                    short_id=101,
                    data=tasks_api.TaskEdit(assignee_id=uuid.uuid4()),
                    member=member,
                    session=session,
                )

        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("assignee_id", str(ctx.exception.detail))
        assign_mock.assert_not_awaited()
        session.commit.assert_not_awaited()

    async def test_member_non_assignee_cannot_update_title(self) -> None:
        task = SimpleNamespace(
            id=uuid.uuid4(),
            assignee_id=uuid.uuid4(),
            created_by_id=uuid.uuid4(),
            status="new",
            assignee=None,
        )
        member = SimpleNamespace(id=uuid.uuid4(), role="member")
        session = SimpleNamespace(commit=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(bot=None))
        )

        with patch.object(
            tasks_api.task_service,
            "get_task_by_short_id",
            AsyncMock(return_value=task),
        ), patch.object(
            tasks_api,
            "can_access_task",
            AsyncMock(return_value=True),
        ), patch(
            "app.db.repositories.TaskRepository.update",
            AsyncMock(),
        ) as repo_update_mock:
            with self.assertRaises(HTTPException) as ctx:
                await tasks_api.update_task(
                    request=request,
                    short_id=101,
                    data=tasks_api.TaskEdit(title="Новый заголовок"),
                    member=member,
                    session=session,
                )

        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("Нет прав", str(ctx.exception.detail))
        repo_update_mock.assert_not_awaited()
        session.commit.assert_not_awaited()

    async def test_empty_title_is_rejected(self) -> None:
        member_id = uuid.uuid4()
        task = SimpleNamespace(
            id=uuid.uuid4(),
            assignee_id=member_id,
            created_by_id=uuid.uuid4(),
            status="new",
            assignee=None,
        )
        member = SimpleNamespace(id=member_id, role="member")
        session = SimpleNamespace(commit=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(bot=None))
        )

        with patch.object(
            tasks_api.task_service,
            "get_task_by_short_id",
            AsyncMock(return_value=task),
        ), patch.object(
            tasks_api,
            "can_access_task",
            AsyncMock(return_value=True),
        ), patch(
            "app.db.repositories.TaskRepository.update",
            AsyncMock(),
        ) as repo_update_mock:
            with self.assertRaises(HTTPException) as ctx:
                await tasks_api.update_task(
                    request=request,
                    short_id=101,
                    data=tasks_api.TaskEdit(title="   "),
                    member=member,
                    session=session,
                )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Название задачи не может быть пустым", str(ctx.exception.detail))
        repo_update_mock.assert_not_awaited()
        session.commit.assert_not_awaited()

    async def test_moderator_can_update_description(self) -> None:
        task = SimpleNamespace(
            id=uuid.uuid4(),
            assignee_id=uuid.uuid4(),
            created_by_id=uuid.uuid4(),
            status="new",
            assignee=None,
        )
        updated_task = SimpleNamespace(id=task.id)
        moderator = SimpleNamespace(id=uuid.uuid4(), role="moderator")
        session = SimpleNamespace(commit=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(bot=None))
        )

        with patch.object(
            tasks_api.task_service,
            "get_task_by_short_id",
            AsyncMock(return_value=task),
        ), patch.object(
            tasks_api,
            "can_access_task",
            AsyncMock(return_value=True),
        ), patch(
            "app.db.repositories.TaskRepository.update",
            AsyncMock(return_value=updated_task),
        ) as repo_update_mock:
            response = await tasks_api.update_task(
                request=request,
                short_id=101,
                data=tasks_api.TaskEdit(description="Текст"),
                member=moderator,
                session=session,
            )

        self.assertIs(response, updated_task)
        repo_update_mock.assert_awaited_once_with(
            session, task.id, description="Текст"
        )
        session.commit.assert_awaited_once()

    async def test_member_author_can_update_description_priority_deadline(self) -> None:
        author_id = uuid.uuid4()
        task = SimpleNamespace(
            id=uuid.uuid4(),
            assignee_id=uuid.uuid4(),
            created_by_id=author_id,
            status="new",
            assignee=None,
        )
        updated_task = SimpleNamespace(id=task.id)
        member = SimpleNamespace(id=author_id, role="member")
        session = SimpleNamespace(commit=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(bot=None))
        )

        with patch.object(
            tasks_api.task_service,
            "get_task_by_short_id",
            AsyncMock(return_value=task),
        ), patch.object(
            tasks_api,
            "can_access_task",
            AsyncMock(return_value=True),
        ), patch(
            "app.db.repositories.TaskRepository.update",
            AsyncMock(return_value=updated_task),
        ) as repo_update_mock:
            response = await tasks_api.update_task(
                request=request,
                short_id=101,
                data=tasks_api.TaskEdit(
                    description="Описание",
                    priority="high",
                    deadline=date(2026, 3, 10),
                ),
                member=member,
                session=session,
            )

        self.assertIs(response, updated_task)
        repo_update_mock.assert_awaited_once_with(
            session,
            task.id,
            description="Описание",
            priority="high",
            deadline=date(2026, 3, 10),
        )
        session.commit.assert_awaited_once()

    async def test_member_author_can_reassign_assignee(self) -> None:
        author_id = uuid.uuid4()
        task = SimpleNamespace(
            id=uuid.uuid4(),
            assignee_id=uuid.uuid4(),
            created_by_id=author_id,
            status="new",
            assignee=None,
        )
        updated_task = SimpleNamespace(id=task.id, assignee=None)
        new_assignee_id = uuid.uuid4()
        member = SimpleNamespace(id=author_id, role="member")
        session = SimpleNamespace(commit=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(bot=None))
        )

        with patch.object(
            tasks_api.task_service,
            "get_task_by_short_id",
            AsyncMock(return_value=task),
        ), patch.object(
            tasks_api,
            "can_access_task",
            AsyncMock(return_value=True),
        ), patch.object(
            tasks_api.task_service,
            "assign_task",
            AsyncMock(return_value=updated_task),
        ) as assign_mock:
            response = await tasks_api.update_task(
                request=request,
                short_id=101,
                data=tasks_api.TaskEdit(assignee_id=new_assignee_id),
                member=member,
                session=session,
            )

        self.assertIs(response, updated_task)
        assign_mock.assert_awaited_once_with(
            session, task, member, new_assignee_id
        )
        session.commit.assert_awaited_once()

    async def test_member_author_can_unassign(self) -> None:
        author_id = uuid.uuid4()
        old_assignee_id = uuid.uuid4()
        task = SimpleNamespace(
            id=uuid.uuid4(),
            assignee_id=old_assignee_id,
            created_by_id=author_id,
            status="new",
            assignee=None,
        )
        updated_task = SimpleNamespace(id=task.id, assignee_id=None, assignee=None)
        member = SimpleNamespace(id=author_id, role="member")
        session = SimpleNamespace(commit=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(bot=None))
        )

        with patch.object(
            tasks_api.task_service,
            "get_task_by_short_id",
            AsyncMock(return_value=task),
        ), patch.object(
            tasks_api,
            "can_access_task",
            AsyncMock(return_value=True),
        ), patch(
            "app.db.repositories.TaskRepository.update",
            AsyncMock(return_value=updated_task),
        ) as repo_update_mock, patch.object(
            tasks_api.in_app_notification_service,
            "notify_task_created_unassigned",
            AsyncMock(),
        ) as notify_mock:
            response = await tasks_api.update_task(
                request=request,
                short_id=101,
                data=tasks_api.TaskEdit(assignee_id=None),
                member=member,
                session=session,
            )

        self.assertIs(response, updated_task)
        repo_update_mock.assert_awaited_once_with(
            session,
            task.id,
            assignee_id=None,
            reminder_at=None,
            reminder_comment=None,
            reminder_sent_at=None,
        )
        notify_mock.assert_awaited_once_with(session, updated_task, member)
        session.commit.assert_awaited_once()

    async def test_member_assignee_can_set_reminder(self) -> None:
        member_id = uuid.uuid4()
        task = SimpleNamespace(
            id=uuid.uuid4(),
            assignee_id=member_id,
            created_by_id=uuid.uuid4(),
            status="new",
            assignee=None,
            reminder_at=None,
        )
        updated_task = SimpleNamespace(id=task.id)
        member = SimpleNamespace(id=member_id, role="member")
        session = SimpleNamespace(commit=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(bot=None))
        )
        future_reminder = datetime.utcnow() + timedelta(hours=2)

        with patch.object(
            tasks_api.task_service,
            "get_task_by_short_id",
            AsyncMock(return_value=task),
        ), patch.object(
            tasks_api,
            "can_access_task",
            AsyncMock(return_value=True),
        ), patch(
            "app.db.repositories.TaskRepository.update",
            AsyncMock(return_value=updated_task),
        ) as repo_update_mock:
            response = await tasks_api.update_task(
                request=request,
                short_id=101,
                data=tasks_api.TaskEdit(
                    reminder_at=future_reminder,
                    reminder_comment="Проверить детали",
                ),
                member=member,
                session=session,
            )

        self.assertIs(response, updated_task)
        self.assertEqual(repo_update_mock.await_count, 1)
        call_kwargs = repo_update_mock.await_args.kwargs
        self.assertEqual(call_kwargs["reminder_comment"], "Проверить детали")
        self.assertIsNone(call_kwargs["reminder_sent_at"])
        self.assertIsInstance(call_kwargs["reminder_at"], datetime)
        session.commit.assert_awaited_once()

    async def test_member_author_cannot_set_reminder_if_not_assignee(self) -> None:
        author_id = uuid.uuid4()
        task = SimpleNamespace(
            id=uuid.uuid4(),
            assignee_id=uuid.uuid4(),
            created_by_id=author_id,
            status="new",
            assignee=None,
            reminder_at=None,
        )
        member = SimpleNamespace(id=author_id, role="member")
        session = SimpleNamespace(commit=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(bot=None))
        )

        with patch.object(
            tasks_api.task_service,
            "get_task_by_short_id",
            AsyncMock(return_value=task),
        ), patch.object(
            tasks_api,
            "can_access_task",
            AsyncMock(return_value=True),
        ), patch(
            "app.db.repositories.TaskRepository.update",
            AsyncMock(),
        ) as repo_update_mock:
            with self.assertRaises(HTTPException) as ctx:
                await tasks_api.update_task(
                    request=request,
                    short_id=101,
                    data=tasks_api.TaskEdit(
                        reminder_at=datetime.utcnow() + timedelta(hours=1)
                    ),
                    member=member,
                    session=session,
                )

        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("reminder_at", str(ctx.exception.detail))
        repo_update_mock.assert_not_awaited()
        session.commit.assert_not_awaited()

    async def test_member_cannot_set_reminder_comment_without_reminder_time(self) -> None:
        member_id = uuid.uuid4()
        task = SimpleNamespace(
            id=uuid.uuid4(),
            assignee_id=member_id,
            created_by_id=uuid.uuid4(),
            status="new",
            assignee=None,
            reminder_at=None,
        )
        member = SimpleNamespace(id=member_id, role="member")
        session = SimpleNamespace(commit=AsyncMock())
        request = SimpleNamespace(
            app=SimpleNamespace(state=SimpleNamespace(bot=None))
        )

        with patch.object(
            tasks_api.task_service,
            "get_task_by_short_id",
            AsyncMock(return_value=task),
        ), patch.object(
            tasks_api,
            "can_access_task",
            AsyncMock(return_value=True),
        ), patch(
            "app.db.repositories.TaskRepository.update",
            AsyncMock(),
        ) as repo_update_mock:
            with self.assertRaises(HTTPException) as ctx:
                await tasks_api.update_task(
                    request=request,
                    short_id=101,
                    data=tasks_api.TaskEdit(reminder_comment="Комментарий"),
                    member=member,
                    session=session,
                )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("Сначала установите дату и время напоминания", str(ctx.exception.detail))
        repo_update_mock.assert_not_awaited()
        session.commit.assert_not_awaited()
