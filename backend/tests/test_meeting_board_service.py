import uuid
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import IntegrityError

from app.db.repositories import MeetingBoardRepository
from app.services.meeting_board_service import MeetingBoardService, group_board_tasks


class FakeNestedTransaction:
    def __init__(self) -> None:
        self.entered = False
        self.exited = False

    async def __aenter__(self) -> None:
        self.entered = True

    async def __aexit__(self, exc_type, exc, tb) -> None:
        self.exited = True


def task(**overrides):
    base = {
        "id": uuid.uuid4(),
        "short_id": 1,
        "status": "new",
        "priority": "normal",
        "deadline": None,
        "completed_at": None,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def test_group_board_tasks_keeps_overdue_inside_work_section() -> None:
    old_deadline = date.today() - timedelta(days=1)
    grouped = group_board_tasks(
        [
            task(short_id=10, status="in_progress", deadline=old_deadline),
            task(short_id=11, status="review", deadline=old_deadline),
        ],
        today=date.today(),
    )

    assert [t.short_id for t in grouped.in_progress] == [10]
    assert [t.short_id for t in grouped.review] == [11]
    assert grouped.urgent == []


def test_group_board_tasks_includes_done_this_week_only() -> None:
    now = datetime.utcnow()
    grouped = group_board_tasks(
        [
            task(short_id=20, status="done", completed_at=now - timedelta(days=2)),
            task(short_id=21, status="done", completed_at=now - timedelta(days=9)),
        ],
        today=date.today(),
        now=now,
    )

    assert [t.short_id for t in grouped.done_this_week] == [20]


def test_group_board_tasks_accepts_timezone_aware_completed_at() -> None:
    now = datetime(2026, 5, 7, 12, 0, 0)
    grouped = group_board_tasks(
        [
            task(
                short_id=22,
                status="done",
                completed_at=datetime(2026, 5, 6, 12, 0, 0, tzinfo=timezone.utc),
            ),
        ],
        now=now,
    )

    assert [t.short_id for t in grouped.done_this_week] == [22]


def test_group_board_tasks_includes_new_tasks_and_excludes_cancelled() -> None:
    grouped = group_board_tasks(
        [
            task(short_id=23, status="new", priority="normal"),
            task(short_id=24, status="cancelled", priority="urgent"),
            task(short_id=25, status="new", priority="urgent"),
        ],
        now=datetime(2026, 5, 7, 12, 0, 0),
    )

    assert [t.short_id for t in grouped.new] == [23]
    assert [t.short_id for t in grouped.urgent] == [25]
    assert grouped.in_progress == []
    assert grouped.review == []


class FakeScalarResult:
    def __init__(self, tasks):
        self.tasks = tasks

    def unique(self):
        return self

    def all(self):
        return self.tasks


class FakeExecuteResult:
    def __init__(self, tasks):
        self.tasks = tasks

    def scalars(self):
        return FakeScalarResult(self.tasks)


@pytest.mark.asyncio
async def test_load_visible_tasks_rechecks_pinned_task_access() -> None:
    allowed_task = task(short_id=30)
    blocked_task = task(short_id=31)
    session = SimpleNamespace(
        execute=AsyncMock(return_value=FakeExecuteResult([allowed_task, blocked_task]))
    )
    service = MeetingBoardService()
    meeting = SimpleNamespace(participants=[])
    settings = SimpleNamespace(
        added_member_ids=[],
        added_department_ids=[],
        pinned_task_ids=[allowed_task.id, blocked_task.id],
    )
    viewer = SimpleNamespace(id=uuid.uuid4())

    can_access = AsyncMock(side_effect=[True, False])
    with patch(
        "app.services.meeting_board_service.resolve_visible_department_ids",
        AsyncMock(return_value=None),
    ) as resolve_visible_department_ids, patch(
        "app.services.meeting_board_service.can_access_task",
        can_access,
    ):
        visible_tasks = await service._load_visible_tasks(
            session, meeting, settings, viewer
        )

    assert visible_tasks == [allowed_task]
    resolve_visible_department_ids.assert_awaited_once_with(session, viewer)
    assert can_access.await_count == 2
    can_access.assert_any_await(session, viewer, allowed_task)
    can_access.assert_any_await(session, viewer, blocked_task)


@pytest.mark.asyncio
async def test_load_visible_tasks_applies_focus_labels_to_people_scope() -> None:
    visible_task = task(short_id=32)
    session = SimpleNamespace(
        execute=AsyncMock(return_value=FakeExecuteResult([visible_task]))
    )
    service = MeetingBoardService()
    participant_id = uuid.uuid4()
    pinned_task_id = uuid.uuid4()
    focus_label_id = uuid.uuid4()
    meeting = SimpleNamespace(
        participants=[SimpleNamespace(member_id=participant_id)]
    )
    settings = SimpleNamespace(
        added_member_ids=[],
        added_department_ids=[],
        pinned_task_ids=[pinned_task_id],
        focus_label_ids=[focus_label_id],
    )
    viewer = SimpleNamespace(id=uuid.uuid4())

    with patch(
        "app.services.meeting_board_service.resolve_visible_department_ids",
        AsyncMock(return_value=None),
    ), patch(
        "app.services.meeting_board_service.can_access_task",
        AsyncMock(return_value=True),
    ):
        visible_tasks = await service._load_visible_tasks(
            session, meeting, settings, viewer
        )

    assert visible_tasks == [visible_task]
    stmt = session.execute.await_args.args[0]
    compiled = str(stmt.compile(dialect=postgresql.dialect()))
    assert "task_label_links" in compiled
    assert "label_id" in compiled
    assert "tasks.id IN" in compiled


@pytest.mark.asyncio
async def test_get_or_create_returns_existing_settings_after_concurrent_insert() -> None:
    meeting_id = uuid.uuid4()
    member = SimpleNamespace(id=uuid.uuid4())
    existing_settings = SimpleNamespace(id=uuid.uuid4(), meeting_id=meeting_id)
    nested_transaction = FakeNestedTransaction()
    session = SimpleNamespace(
        add=lambda settings: None,
        begin_nested=lambda: nested_transaction,
        flush=AsyncMock(
            side_effect=IntegrityError(
                "INSERT INTO meeting_board_settings",
                {},
                Exception("duplicate key value violates unique constraint"),
            )
        ),
        rollback=AsyncMock(),
    )
    repo = MeetingBoardRepository()
    repo.get_by_meeting_id = AsyncMock(side_effect=[None, existing_settings])

    settings = await repo.get_or_create(session, meeting_id, member)

    assert settings is existing_settings
    repo.get_by_meeting_id.assert_any_await(session, meeting_id)
    assert repo.get_by_meeting_id.await_count == 2
    session.flush.assert_awaited_once()
    assert nested_transaction.entered
    assert nested_transaction.exited
    session.rollback.assert_not_awaited()
