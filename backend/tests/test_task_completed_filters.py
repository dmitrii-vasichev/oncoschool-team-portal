import unittest
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.api import tasks as tasks_api


class TaskCompletedFiltersTests(unittest.IsolatedAsyncioTestCase):
    async def test_list_tasks_filters_and_sorts_by_completed_at(self) -> None:
        member = SimpleNamespace(id="member-id", role="moderator")
        execute_result = MagicMock()
        execute_result.scalar_one.return_value = 0
        execute_result.scalars.return_value.all.return_value = []
        session = SimpleNamespace(execute=AsyncMock(return_value=execute_result))
        completed_since = datetime.now(UTC) - timedelta(days=7)

        with patch.object(
            tasks_api,
            "resolve_visible_department_ids",
            AsyncMock(return_value=None),
        ):
            await tasks_api.list_tasks(
                assignee_id=None,
                created_by_id=None,
                department_id=None,
                status_filter="done",
                priority=None,
                meeting_id=None,
                source=None,
                search=None,
                label_ids=None,
                has_overdue=None,
                completed_since=completed_since,
                sort="completed_at_desc",
                page=1,
                per_page=50,
                member=member,
                session=session,
            )

        rendered_statements = "\n".join(
            str(call.args[0]) for call in session.execute.await_args_list
        )
        self.assertIn("tasks.completed_at >= ", rendered_statements)
        self.assertIn("ORDER BY tasks.completed_at DESC", rendered_statements)
