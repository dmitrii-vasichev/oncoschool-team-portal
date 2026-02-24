import unittest
import uuid
from datetime import date, datetime, time, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.db.models import Meeting, MeetingParticipant
from app.services.meeting_scheduler_service import MeetingSchedulerService


def _build_scheduler(zoom_service=None) -> MeetingSchedulerService:
    return MeetingSchedulerService(
        bot=SimpleNamespace(send_message=AsyncMock()),
        session_maker=SimpleNamespace(),
        zoom_service=zoom_service,
    )


class MeetingSchedulerNextSlotVisibilityTests(unittest.IsolatedAsyncioTestCase):
    def test_calc_next_occurrence_datetime_for_weekly_after_last_occurrence(self) -> None:
        scheduler = _build_scheduler()
        now_utc = datetime(2026, 2, 23, 16, 1, tzinfo=timezone.utc)
        schedule = SimpleNamespace(
            recurrence="weekly",
            timezone="UTC",
            day_of_week=1,  # Monday
            time_utc=time(15, 0),
            one_time_date=None,
            next_occurrence_at=None,
            next_occurrence_time_override=None,
            next_occurrence_skip=False,
            last_triggered_date=date(2026, 2, 23),
        )

        next_occurrence = scheduler._calc_next_occurrence_datetime(schedule, now_utc)

        self.assertEqual(
            next_occurrence,
            datetime(2026, 3, 2, 15, 0, tzinfo=timezone.utc),
        )

    async def test_ensure_next_occurrence_visible_creates_next_slot(self) -> None:
        scheduler = _build_scheduler()
        now_utc = datetime(2026, 2, 23, 16, 1, tzinfo=timezone.utc)
        participant_one = uuid.uuid4()
        participant_two = uuid.uuid4()
        schedule = SimpleNamespace(
            id=uuid.uuid4(),
            title="Планерка по контенту",
            recurrence="weekly",
            timezone="UTC",
            day_of_week=1,  # Monday
            time_utc=time(15, 0),
            duration_minutes=60,
            one_time_date=None,
            next_occurrence_at=None,
            next_occurrence_time_override=None,
            next_occurrence_skip=False,
            last_triggered_date=date(2026, 2, 23),
            participant_ids=[participant_one, participant_two],
            created_by_id=uuid.uuid4(),
            is_active=True,
        )

        added_objects: list[object] = []

        def add_object(obj: object) -> None:
            added_objects.append(obj)

        async def flush_once() -> None:
            for obj in added_objects:
                if isinstance(obj, Meeting) and obj.id is None:
                    obj.id = uuid.uuid4()

        session = SimpleNamespace(
            add=add_object,
            flush=AsyncMock(side_effect=flush_once),
        )

        with (
            patch.object(
                scheduler,
                "_has_scheduled_upcoming_occurrence",
                AsyncMock(return_value=False),
            ),
            patch.object(
                scheduler,
                "_meeting_exists_for_occurrence",
                AsyncMock(return_value=False),
            ),
        ):
            created = await scheduler._ensure_next_occurrence_visible(
                session,
                schedule,
                now_utc,
            )

        self.assertTrue(created)
        meetings = [obj for obj in added_objects if isinstance(obj, Meeting)]
        participants = [
            obj for obj in added_objects if isinstance(obj, MeetingParticipant)
        ]

        self.assertEqual(len(meetings), 1)
        self.assertEqual(meetings[0].meeting_date, datetime(2026, 3, 2, 15, 0))
        self.assertEqual(len(participants), 2)
        self.assertTrue(all(obj.meeting_id == meetings[0].id for obj in participants))
        self.assertEqual({obj.member_id for obj in participants}, {participant_one, participant_two})

    async def test_ensure_next_occurrence_visible_creates_zoom_for_new_slot(self) -> None:
        zoom_service = SimpleNamespace(
            create_meeting=AsyncMock(
                return_value={
                    "id": "123456789",
                    "join_url": "https://zoom.us/s/123456789?zak=host-token&pwd=abc",
                }
            )
        )
        scheduler = _build_scheduler(zoom_service=zoom_service)
        now_utc = datetime(2026, 2, 23, 16, 1, tzinfo=timezone.utc)
        schedule = SimpleNamespace(
            id=uuid.uuid4(),
            title="Планерка по контенту",
            recurrence="weekly",
            timezone="UTC",
            day_of_week=1,
            time_utc=time(15, 0),
            duration_minutes=60,
            one_time_date=None,
            next_occurrence_at=None,
            next_occurrence_time_override=None,
            next_occurrence_skip=False,
            last_triggered_date=date(2026, 2, 23),
            participant_ids=[],
            created_by_id=uuid.uuid4(),
            is_active=True,
            zoom_enabled=True,
        )

        added_objects: list[object] = []

        def add_object(obj: object) -> None:
            added_objects.append(obj)

        async def flush_once() -> None:
            for obj in added_objects:
                if isinstance(obj, Meeting) and obj.id is None:
                    obj.id = uuid.uuid4()

        session = SimpleNamespace(
            add=add_object,
            flush=AsyncMock(side_effect=flush_once),
        )

        with (
            patch.object(
                scheduler,
                "_has_scheduled_upcoming_occurrence",
                AsyncMock(return_value=False),
            ),
            patch.object(
                scheduler,
                "_meeting_exists_for_occurrence",
                AsyncMock(return_value=False),
            ),
        ):
            created = await scheduler._ensure_next_occurrence_visible(
                session,
                schedule,
                now_utc,
            )

        self.assertTrue(created)
        meetings = [obj for obj in added_objects if isinstance(obj, Meeting)]
        self.assertEqual(len(meetings), 1)
        self.assertEqual(meetings[0].zoom_meeting_id, "123456789")
        self.assertEqual(meetings[0].zoom_join_url, "https://zoom.us/j/123456789?pwd=abc")
        zoom_service.create_meeting.assert_awaited_once()

    async def test_ensure_next_occurrence_visible_skips_when_upcoming_exists(self) -> None:
        scheduler = _build_scheduler()
        now_utc = datetime(2026, 2, 23, 16, 1, tzinfo=timezone.utc)
        schedule = SimpleNamespace(
            id=uuid.uuid4(),
            title="Планерка по контенту",
            recurrence="weekly",
            timezone="UTC",
            day_of_week=1,
            time_utc=time(15, 0),
            duration_minutes=60,
            one_time_date=None,
            next_occurrence_at=None,
            next_occurrence_time_override=None,
            next_occurrence_skip=False,
            last_triggered_date=date(2026, 2, 23),
            participant_ids=[],
            created_by_id=None,
            is_active=True,
        )

        added_objects: list[object] = []
        session = SimpleNamespace(
            add=added_objects.append,
            flush=AsyncMock(),
        )
        has_upcoming_mock = AsyncMock(return_value=True)
        meeting_exists_mock = AsyncMock(return_value=False)

        with (
            patch.object(
                scheduler,
                "_has_scheduled_upcoming_occurrence",
                has_upcoming_mock,
            ),
            patch.object(
                scheduler,
                "_meeting_exists_for_occurrence",
                meeting_exists_mock,
            ),
        ):
            created = await scheduler._ensure_next_occurrence_visible(
                session,
                schedule,
                now_utc,
            )

        self.assertFalse(created)
        self.assertEqual(added_objects, [])
        session.flush.assert_not_awaited()
        meeting_exists_mock.assert_not_awaited()

    async def test_ensure_next_occurrence_visible_backfills_zoom_for_existing_upcoming(self) -> None:
        zoom_service = SimpleNamespace(
            create_meeting=AsyncMock(
                return_value={
                    "id": "789456123",
                    "join_url": "https://zoom.us/j/789456123?pwd=token",
                }
            )
        )
        scheduler = _build_scheduler(zoom_service=zoom_service)
        now_utc = datetime(2026, 2, 23, 16, 1, tzinfo=timezone.utc)
        schedule = SimpleNamespace(
            id=uuid.uuid4(),
            title="Планерка по контенту",
            recurrence="weekly",
            timezone="UTC",
            day_of_week=1,
            time_utc=time(15, 0),
            duration_minutes=60,
            one_time_date=None,
            next_occurrence_at=None,
            next_occurrence_time_override=None,
            next_occurrence_skip=False,
            last_triggered_date=date(2026, 2, 23),
            participant_ids=[],
            created_by_id=uuid.uuid4(),
            is_active=True,
            zoom_enabled=True,
        )
        existing_meeting = SimpleNamespace(
            id=uuid.uuid4(),
            meeting_date=datetime(2026, 3, 2, 15, 0),
            zoom_meeting_id=None,
            zoom_join_url=None,
        )
        session = SimpleNamespace()

        with (
            patch.object(
                scheduler,
                "_has_scheduled_upcoming_occurrence",
                AsyncMock(return_value=True),
            ),
            patch.object(
                scheduler,
                "_find_next_scheduled_upcoming_occurrence",
                AsyncMock(return_value=existing_meeting),
            ),
        ):
            changed = await scheduler._ensure_next_occurrence_visible(
                session,
                schedule,
                now_utc,
            )

        self.assertTrue(changed)
        self.assertEqual(existing_meeting.zoom_meeting_id, "789456123")
        self.assertEqual(existing_meeting.zoom_join_url, "https://zoom.us/j/789456123?pwd=token")
        zoom_service.create_meeting.assert_awaited_once()

    async def test_ensure_next_occurrence_visible_backfills_join_url_from_zoom_id(self) -> None:
        zoom_service = SimpleNamespace(create_meeting=AsyncMock())
        scheduler = _build_scheduler(zoom_service=zoom_service)
        now_utc = datetime(2026, 2, 23, 16, 1, tzinfo=timezone.utc)
        schedule = SimpleNamespace(
            id=uuid.uuid4(),
            title="Планерка по контенту",
            recurrence="weekly",
            timezone="UTC",
            day_of_week=1,
            time_utc=time(15, 0),
            duration_minutes=60,
            one_time_date=None,
            next_occurrence_at=None,
            next_occurrence_time_override=None,
            next_occurrence_skip=False,
            last_triggered_date=date(2026, 2, 23),
            participant_ids=[],
            created_by_id=uuid.uuid4(),
            is_active=True,
            zoom_enabled=True,
        )
        existing_meeting = SimpleNamespace(
            id=uuid.uuid4(),
            meeting_date=datetime(2026, 3, 2, 15, 0),
            zoom_meeting_id="987654321",
            zoom_join_url=None,
        )
        session = SimpleNamespace()

        with (
            patch.object(
                scheduler,
                "_has_scheduled_upcoming_occurrence",
                AsyncMock(return_value=True),
            ),
            patch.object(
                scheduler,
                "_find_next_scheduled_upcoming_occurrence",
                AsyncMock(return_value=existing_meeting),
            ),
        ):
            changed = await scheduler._ensure_next_occurrence_visible(
                session,
                schedule,
                now_utc,
            )

        self.assertTrue(changed)
        self.assertEqual(existing_meeting.zoom_join_url, "https://zoom.us/j/987654321")
        zoom_service.create_meeting.assert_not_awaited()

    async def test_ensure_next_occurrence_visible_reconciles_stale_on_demand_slot(self) -> None:
        scheduler = _build_scheduler()
        now_utc = datetime(2026, 2, 24, 12, 0, tzinfo=timezone.utc)
        schedule = SimpleNamespace(
            id=uuid.uuid4(),
            recurrence="on_demand",
            duration_minutes=60,
            next_occurrence_at=datetime(2026, 2, 24, 10, 30, tzinfo=timezone.utc),
            next_occurrence_skip=True,
            is_active=True,
        )
        session = SimpleNamespace()
        has_template_mock = AsyncMock(return_value=False)
        ensure_template_mock = AsyncMock()

        with (
            patch.object(
                scheduler,
                "_has_on_demand_template_meeting",
                has_template_mock,
            ),
            patch.object(
                scheduler,
                "_ensure_on_demand_template_meeting",
                ensure_template_mock,
            ),
        ):
            changed = await scheduler._ensure_next_occurrence_visible(
                session,
                schedule,
                now_utc,
            )

        self.assertTrue(changed)
        self.assertIsNone(schedule.next_occurrence_at)
        self.assertFalse(schedule.next_occurrence_skip)
        has_template_mock.assert_awaited_once_with(session, schedule.id)
        ensure_template_mock.assert_awaited_once_with(session, schedule)

    async def test_ensure_next_occurrence_visible_keeps_active_on_demand_slot(self) -> None:
        scheduler = _build_scheduler()
        now_utc = datetime(2026, 2, 24, 12, 0, tzinfo=timezone.utc)
        schedule = SimpleNamespace(
            id=uuid.uuid4(),
            recurrence="on_demand",
            duration_minutes=60,
            next_occurrence_at=datetime(2026, 2, 24, 12, 30, tzinfo=timezone.utc),
            next_occurrence_skip=True,
            is_active=True,
        )
        session = SimpleNamespace()
        has_template_mock = AsyncMock(return_value=True)
        ensure_template_mock = AsyncMock()

        with (
            patch.object(
                scheduler,
                "_has_on_demand_template_meeting",
                has_template_mock,
            ),
            patch.object(
                scheduler,
                "_ensure_on_demand_template_meeting",
                ensure_template_mock,
            ),
        ):
            changed = await scheduler._ensure_next_occurrence_visible(
                session,
                schedule,
                now_utc,
            )

        self.assertFalse(changed)
        self.assertEqual(
            schedule.next_occurrence_at,
            datetime(2026, 2, 24, 12, 30, tzinfo=timezone.utc),
        )
        self.assertTrue(schedule.next_occurrence_skip)
        has_template_mock.assert_awaited_once_with(session, schedule.id)
        ensure_template_mock.assert_not_awaited()
