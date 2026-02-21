import unittest
import uuid
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.services.meeting_scheduler_service import MeetingSchedulerService


class MeetingSchedulerZoomRulesTests(unittest.IsolatedAsyncioTestCase):
    async def test_create_zoom_meeting_retries_and_succeeds(self) -> None:
        zoom_service = SimpleNamespace(
            create_meeting=AsyncMock(
                side_effect=[
                    RuntimeError("temporary zoom outage"),
                    {"id": "123", "join_url": "https://zoom.us/j/123"},
                ]
            )
        )
        scheduler = MeetingSchedulerService(
            bot=SimpleNamespace(send_message=AsyncMock()),
            session_maker=SimpleNamespace(),
            zoom_service=zoom_service,
        )
        schedule = SimpleNamespace(
            id=uuid.uuid4(),
            title="Планерка",
            duration_minutes=60,
            timezone="Europe/Moscow",
        )

        with patch("app.services.meeting_scheduler_service.asyncio.sleep", AsyncMock()):
            zoom_data = await scheduler._create_zoom_meeting_with_retry(
                schedule=schedule,
                meeting_date=datetime(2026, 2, 21, 12, 0, tzinfo=timezone.utc),
            )

        self.assertEqual(zoom_data["id"], "123")
        self.assertEqual(zoom_service.create_meeting.await_count, 2)

    async def test_create_zoom_meeting_retries_then_raises(self) -> None:
        zoom_service = SimpleNamespace(
            create_meeting=AsyncMock(side_effect=RuntimeError("zoom unavailable"))
        )
        scheduler = MeetingSchedulerService(
            bot=SimpleNamespace(send_message=AsyncMock()),
            session_maker=SimpleNamespace(),
            zoom_service=zoom_service,
        )
        schedule = SimpleNamespace(
            id=uuid.uuid4(),
            title="Планерка",
            duration_minutes=60,
            timezone="Europe/Moscow",
        )

        with patch("app.services.meeting_scheduler_service.asyncio.sleep", AsyncMock()):
            with self.assertRaisesRegex(RuntimeError, "after 3 attempts"):
                await scheduler._create_zoom_meeting_with_retry(
                    schedule=schedule,
                    meeting_date=datetime(2026, 2, 21, 12, 0, tzinfo=timezone.utc),
                )

        self.assertEqual(zoom_service.create_meeting.await_count, 3)

    async def test_send_reminders_raises_without_zoom_link(self) -> None:
        bot = SimpleNamespace(send_message=AsyncMock())
        scheduler = MeetingSchedulerService(
            bot=bot,
            session_maker=SimpleNamespace(),
            zoom_service=None,
        )
        schedule = SimpleNamespace(
            id=uuid.uuid4(),
            title="Планерка",
            reminder_text=None,
            participant_ids=[],
            reminder_include_zoom_link=True,
            telegram_targets=[{"chat_id": "12345", "thread_id": None}],
            time_utc=datetime(2026, 2, 21, 12, 0).time(),
        )
        meeting = SimpleNamespace(
            zoom_meeting_id=None,
            zoom_join_url=None,
            meeting_date=datetime(2026, 2, 21, 12, 0),
        )

        with self.assertRaisesRegex(RuntimeError, "Zoom link is missing"):
            await scheduler._send_reminders(
                session=SimpleNamespace(),
                schedule=schedule,
                meeting=meeting,
                zoom_data=None,
            )
        bot.send_message.assert_not_awaited()

    async def test_send_reminders_uses_zoom_id_fallback_url(self) -> None:
        bot = SimpleNamespace(send_message=AsyncMock())
        scheduler = MeetingSchedulerService(
            bot=bot,
            session_maker=SimpleNamespace(),
            zoom_service=None,
        )
        schedule = SimpleNamespace(
            id=uuid.uuid4(),
            title="Планерка",
            reminder_text=None,
            participant_ids=[],
            reminder_include_zoom_link=True,
            telegram_targets=[{"chat_id": "12345", "thread_id": None}],
            time_utc=datetime(2026, 2, 21, 12, 0).time(),
        )
        meeting = SimpleNamespace(
            zoom_meeting_id="987654321",
            zoom_join_url=None,
            meeting_date=datetime(2026, 2, 21, 12, 0),
        )

        await scheduler._send_reminders(
            session=SimpleNamespace(),
            schedule=schedule,
            meeting=meeting,
            zoom_data=None,
        )

        bot.send_message.assert_awaited_once()
        text = bot.send_message.await_args.kwargs["text"]
        self.assertIn("https://zoom.us/j/987654321", text)

    async def test_send_reminders_replaces_zoom_link_placeholder(self) -> None:
        bot = SimpleNamespace(send_message=AsyncMock())
        scheduler = MeetingSchedulerService(
            bot=bot,
            session_maker=SimpleNamespace(),
            zoom_service=None,
        )
        scheduler._get_global_reminder_templates = AsyncMock(
            return_value={
                "60": 'Подключение: <a href="{zoom_link}">Подключиться ↗</a>'
            }
        )
        schedule = SimpleNamespace(
            id=uuid.uuid4(),
            title="Планерка",
            participant_ids=[],
            reminder_include_zoom_link=True,
            telegram_targets=[{"chat_id": "12345", "thread_id": None}],
            time_utc=datetime(2026, 2, 21, 12, 0).time(),
        )
        meeting = SimpleNamespace(
            zoom_meeting_id="987654321",
            zoom_join_url=None,
            meeting_date=datetime(2026, 2, 21, 12, 0),
        )

        await scheduler._send_reminders(
            session=SimpleNamespace(),
            schedule=schedule,
            meeting=meeting,
            zoom_data=None,
            reminder_offset_minutes=60,
        )

        bot.send_message.assert_awaited_once()
        text = bot.send_message.await_args.kwargs["text"]
        self.assertIn('<a href="https://zoom.us/j/987654321">Подключиться ↗</a>', text)
        self.assertNotIn("Ссылка для подключения:", text)

    async def test_send_reminders_uses_per_offset_template(self) -> None:
        bot = SimpleNamespace(send_message=AsyncMock())
        scheduler = MeetingSchedulerService(
            bot=bot,
            session_maker=SimpleNamespace(),
            zoom_service=None,
        )
        scheduler._get_global_reminder_templates = AsyncMock(
            return_value={
                "0": "Начинаем: <a href=\"{zoom_link}\">Подключиться ↗</a>",
                "60": "legacy text",
            }
        )
        schedule = SimpleNamespace(
            id=uuid.uuid4(),
            title="Планерка",
            participant_ids=[],
            reminder_include_zoom_link=True,
            telegram_targets=[{"chat_id": "12345", "thread_id": None}],
            time_utc=datetime(2026, 2, 21, 12, 0).time(),
        )
        meeting = SimpleNamespace(
            zoom_meeting_id="987654321",
            zoom_join_url=None,
            meeting_date=datetime(2026, 2, 21, 12, 0),
        )

        await scheduler._send_reminders(
            session=SimpleNamespace(),
            schedule=schedule,
            meeting=meeting,
            zoom_data=None,
            reminder_offset_minutes=0,
        )

        bot.send_message.assert_awaited_once()
        text = bot.send_message.await_args.kwargs["text"]
        self.assertIn("Начинаем:", text)
        self.assertIn("https://zoom.us/j/987654321", text)
        self.assertNotIn("legacy text", text)

    async def test_send_reminders_replaces_participants_placeholder(self) -> None:
        bot = SimpleNamespace(send_message=AsyncMock())
        scheduler = MeetingSchedulerService(
            bot=bot,
            session_maker=SimpleNamespace(),
            zoom_service=None,
        )
        scheduler._get_global_reminder_templates = AsyncMock(
            return_value={"60": "Участники: {участники}"}
        )
        scheduler._get_participants = AsyncMock(
            return_value=[
                SimpleNamespace(telegram_username="alice"),
                SimpleNamespace(telegram_username="@bob"),
                SimpleNamespace(telegram_username=None),
            ]
        )
        schedule = SimpleNamespace(
            id=uuid.uuid4(),
            title="Планерка",
            participant_ids=[uuid.uuid4(), uuid.uuid4()],
            reminder_include_zoom_link=False,
            zoom_enabled=False,
            telegram_targets=[{"chat_id": "12345", "thread_id": None}],
            time_utc=datetime(2026, 2, 21, 12, 0).time(),
        )
        meeting = SimpleNamespace(
            zoom_meeting_id=None,
            zoom_join_url=None,
            meeting_date=datetime(2026, 2, 21, 12, 0),
        )

        await scheduler._send_reminders(
            session=SimpleNamespace(),
            schedule=schedule,
            meeting=meeting,
            zoom_data=None,
            reminder_offset_minutes=60,
        )

        bot.send_message.assert_awaited_once()
        text = bot.send_message.await_args.kwargs["text"]
        self.assertEqual(text, "Участники: @alice @bob")

    async def test_send_reminders_appends_participants_without_placeholder(self) -> None:
        bot = SimpleNamespace(send_message=AsyncMock())
        scheduler = MeetingSchedulerService(
            bot=bot,
            session_maker=SimpleNamespace(),
            zoom_service=None,
        )
        scheduler._get_global_reminder_templates = AsyncMock(
            return_value={"60": "Встреча {название}"}
        )
        scheduler._get_participants = AsyncMock(
            return_value=[
                SimpleNamespace(telegram_username="alice"),
                SimpleNamespace(telegram_username="@bob"),
            ]
        )
        schedule = SimpleNamespace(
            id=uuid.uuid4(),
            title="Планерка",
            participant_ids=[uuid.uuid4(), uuid.uuid4()],
            reminder_include_zoom_link=False,
            zoom_enabled=False,
            telegram_targets=[{"chat_id": "12345", "thread_id": None}],
            time_utc=datetime(2026, 2, 21, 12, 0).time(),
        )
        meeting = SimpleNamespace(
            zoom_meeting_id=None,
            zoom_join_url=None,
            meeting_date=datetime(2026, 2, 21, 12, 0),
        )

        await scheduler._send_reminders(
            session=SimpleNamespace(),
            schedule=schedule,
            meeting=meeting,
            zoom_data=None,
            reminder_offset_minutes=60,
        )

        bot.send_message.assert_awaited_once()
        text = bot.send_message.await_args.kwargs["text"]
        self.assertEqual(text, "Встреча Планерка\n\n@alice @bob")

    def test_default_reminder_text_for_start_offset(self) -> None:
        schedule = SimpleNamespace(title="Планерка", time_utc=datetime(2026, 2, 21, 12, 0).time())
        meeting = SimpleNamespace(meeting_date=datetime(2026, 2, 21, 12, 0))
        text = MeetingSchedulerService._default_reminder_text(
            schedule,
            meeting,
            reminder_offset_minutes=0,
        )
        self.assertIn("начинается сейчас", text)

    def test_get_schedule_reminder_offsets_normalizes_data(self) -> None:
        schedule = SimpleNamespace(
            reminder_offsets_minutes=[60, 0, 60, 999],
            reminder_minutes_before=15,
        )
        self.assertEqual(
            MeetingSchedulerService._get_schedule_reminder_offsets(schedule),
            [60, 0],
        )

    def test_should_trigger_skips_already_triggered_recurring_date(self) -> None:
        scheduler = MeetingSchedulerService(
            bot=SimpleNamespace(send_message=AsyncMock()),
            session_maker=SimpleNamespace(),
            zoom_service=None,
        )
        now_utc = datetime(2026, 2, 23, 11, 0, tzinfo=timezone.utc)  # Monday
        schedule = SimpleNamespace(
            recurrence="weekly",
            next_occurrence_time_override=None,
            time_utc=datetime(2026, 2, 23, 12, 0).time(),
            timezone="UTC",
            day_of_week=1,
            last_triggered_date=date(2026, 2, 23),
        )

        self.assertFalse(scheduler._should_trigger(schedule, now_utc, reminder_offset_minutes=60))
