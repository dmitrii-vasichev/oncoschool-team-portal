import unittest
import uuid
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.api import task_labels as labels_api


def make_label(name: str = "Conference", usage_count: int = 3) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        name=name,
        slug=name.casefold(),
        color="teal",
        created_by_id=uuid.uuid4(),
        is_archived=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        usage_count=usage_count,
    )


class TaskLabelApiTests(unittest.IsolatedAsyncioTestCase):
    async def test_list_task_labels_returns_usage_count(self) -> None:
        label = make_label()
        member = SimpleNamespace(id=uuid.uuid4(), role="member", is_active=True)
        session = SimpleNamespace()

        with patch.object(
            labels_api.label_repo,
            "search",
            AsyncMock(return_value=[(label, 3)]),
        ) as search_mock, patch.object(
            labels_api,
            "resolve_visible_department_ids",
            AsyncMock(return_value=None),
        ):
            response = await labels_api.list_task_labels(
                search="conf",
                limit=20,
                include_archived=False,
                member=member,
                session=session,
            )

        self.assertEqual(response[0].id, label.id)
        self.assertEqual(response[0].usage_count, 3)
        search_mock.assert_awaited_once_with(
            session,
            search="conf",
            include_archived=False,
            limit=20,
            visible_department_ids=None,
            fallback_member_id=member.id,
        )

    async def test_list_task_labels_treats_whitespace_search_as_no_search(self) -> None:
        member = SimpleNamespace(id=uuid.uuid4(), role="member", is_active=True)
        session = SimpleNamespace()

        with patch.object(
            labels_api.label_repo,
            "search",
            AsyncMock(return_value=[]),
        ) as search_mock, patch.object(
            labels_api,
            "resolve_visible_department_ids",
            AsyncMock(return_value=[]),
        ):
            response = await labels_api.list_task_labels(
                search="   ",
                limit=20,
                include_archived=False,
                member=member,
                session=session,
            )

        self.assertEqual(response, [])
        search_mock.assert_awaited_once_with(
            session,
            search=None,
            include_archived=False,
            limit=20,
            visible_department_ids=[],
            fallback_member_id=member.id,
        )

    async def test_list_task_labels_scopes_usage_counts_to_visible_departments(self) -> None:
        department_id = uuid.uuid4()
        member = SimpleNamespace(id=uuid.uuid4(), role="member", is_active=True)
        session = SimpleNamespace()

        with patch.object(
            labels_api.label_repo,
            "search",
            AsyncMock(return_value=[]),
        ) as search_mock, patch.object(
            labels_api,
            "resolve_visible_department_ids",
            AsyncMock(return_value=[department_id]),
        ) as visibility_mock:
            await labels_api.list_task_labels(
                search=None,
                limit=20,
                include_archived=False,
                member=member,
                session=session,
            )

        visibility_mock.assert_awaited_once_with(session, member)
        search_mock.assert_awaited_once_with(
            session,
            search=None,
            include_archived=False,
            limit=20,
            visible_department_ids=[department_id],
            fallback_member_id=member.id,
        )

    async def test_create_task_label_commits_and_returns_label(self) -> None:
        label = make_label("Partners", usage_count=0)
        member = SimpleNamespace(id=uuid.uuid4(), role="member", is_active=True)
        session = SimpleNamespace(commit=AsyncMock())

        with patch.object(
            labels_api.label_repo,
            "create_or_reactivate",
            AsyncMock(return_value=label),
        ) as create_mock:
            response = await labels_api.create_task_label(
                data=labels_api.TaskLabelCreate(name=" Partners "),
                member=member,
                session=session,
            )

        self.assertEqual(response.name, "Partners")
        self.assertEqual(response.usage_count, 0)
        create_mock.assert_awaited_once_with(
            session,
            name=" Partners ",
            created_by_id=member.id,
        )
        session.commit.assert_awaited_once()

    async def test_label_response_includes_capabilities(self) -> None:
        label = make_label()
        member = SimpleNamespace(id=label.created_by_id, role="member", is_active=True)
        session = SimpleNamespace()

        with patch.object(
            labels_api.label_repo,
            "is_shared_for_member",
            AsyncMock(return_value=False),
        ):
            response = await labels_api._label_response(
                session,
                label,
                usage_count=2,
                member=member,
            )

        self.assertTrue(response.can_edit)
        self.assertTrue(response.can_archive)
        self.assertFalse(response.can_restore)
        self.assertFalse(response.is_shared_for_current_user)
