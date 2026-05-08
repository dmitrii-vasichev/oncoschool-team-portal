import unittest
import uuid
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.api import analytics as analytics_api


class DashboardActivityApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_team_scope_requires_moderator(self) -> None:
        member = SimpleNamespace(
            id=uuid.uuid4(), role="member", department_id=uuid.uuid4()
        )
        session = SimpleNamespace()

        with patch.object(
            analytics_api,
            "resolve_visible_department_ids",
            AsyncMock(return_value=[member.department_id]),
        ):
            with self.assertRaises(analytics_api.HTTPException) as ctx:
                await analytics_api.analytics_dashboard_activity(
                    scope="team",
                    department_id=None,
                    detail_limit=20,
                    member=member,
                    session=session,
                )

        self.assertEqual(ctx.exception.status_code, 403)

    async def test_department_scope_requires_access(self) -> None:
        allowed_department_id = uuid.uuid4()
        requested_department_id = uuid.uuid4()
        member = SimpleNamespace(
            id=uuid.uuid4(), role="member", department_id=allowed_department_id
        )
        session = SimpleNamespace()

        with patch.object(
            analytics_api,
            "resolve_visible_department_ids",
            AsyncMock(return_value=[allowed_department_id]),
        ):
            with self.assertRaises(analytics_api.HTTPException) as ctx:
                await analytics_api.analytics_dashboard_activity(
                    scope="department",
                    department_id=requested_department_id,
                    detail_limit=20,
                    member=member,
                    session=session,
                )

        self.assertEqual(ctx.exception.status_code, 403)

    def test_latest_in_progress_transition_uses_status_history(self) -> None:
        latest = analytics_api._latest_in_progress_transition_by_task(
            [
                SimpleNamespace(
                    task_id="a",
                    new_status="in_progress",
                    update_type="status_change",
                    created_at=datetime(2026, 5, 1, 9, 0),
                ),
                SimpleNamespace(
                    task_id="a",
                    new_status="review",
                    update_type="status_change",
                    created_at=datetime(2026, 5, 2, 9, 0),
                ),
                SimpleNamespace(
                    task_id="a",
                    new_status="in_progress",
                    update_type="status_change",
                    created_at=datetime(2026, 5, 3, 9, 0),
                ),
                SimpleNamespace(
                    task_id="a",
                    new_status="in_progress",
                    update_type="status_change",
                    created_at=datetime(2026, 5, 1, 10, 0),
                ),
                SimpleNamespace(
                    task_id="b",
                    new_status="in_progress",
                    update_type="progress",
                    created_at=datetime(2026, 5, 1, 9, 0),
                ),
                SimpleNamespace(
                    task_id="c",
                    new_status="done",
                    update_type="status_change",
                    created_at=datetime(2026, 5, 4, 9, 0),
                ),
            ]
        )

        self.assertEqual(latest, {"a": datetime(2026, 5, 3, 9, 0)})

    def test_in_progress_more_than_seven_days_excludes_tasks_without_transition(
        self,
    ) -> None:
        now = datetime(2026, 5, 8, 12, 0)
        tasks = [
            SimpleNamespace(id="old", status="in_progress"),
            SimpleNamespace(id="recent", status="in_progress"),
            SimpleNamespace(id="missing", status="in_progress"),
            SimpleNamespace(id="new", status="new"),
        ]
        transitions = {
            "old": now - timedelta(days=8),
            "recent": now - timedelta(days=2),
        }

        stale = analytics_api._filter_in_progress_more_than_seven_days(
            tasks,
            transitions,
            now=now,
        )

        self.assertEqual([task.id for task in stale], ["old"])

    async def test_activity_response_uses_counts_from_collectors(self) -> None:
        for role in ("moderator", "admin"):
            with self.subTest(role=role):
                member = SimpleNamespace(
                    id=uuid.uuid4(), role=role, department_id=None
                )
                session = SimpleNamespace()

                with patch.object(
                    analytics_api,
                    "resolve_visible_department_ids",
                    AsyncMock(return_value=None),
                ), patch.object(
                    analytics_api,
                    "_load_dashboard_activity_tasks",
                    AsyncMock(
                        side_effect=[
                            [],
                            [],
                        ]
                    ),
                ), patch.object(
                    analytics_api,
                    "_count_dashboard_activity_tasks",
                    AsyncMock(side_effect=[4, 1, 4, 2]),
                ), patch.object(
                    analytics_api,
                    "_load_in_progress_over_seven_days_tasks",
                    AsyncMock(return_value=[]),
                ), patch.object(
                    analytics_api,
                    "_count_in_progress_over_seven_days_tasks",
                    AsyncMock(return_value=1),
                ):
                    response = await analytics_api.analytics_dashboard_activity(
                        scope="team",
                        department_id=None,
                        detail_limit=20,
                        member=member,
                        session=session,
                    )

                self.assertEqual(response.scope, "team")
                self.assertEqual(response.completed.count, 4)
                self.assertEqual(response.created.count, 1)
                self.assertEqual(response.in_progress_over_7_days.count, 1)
                self.assertEqual(response.completed_delta.current, 4)
                self.assertEqual(response.completed_delta.previous, 2)
                self.assertEqual(response.completed_delta.delta, 2)
