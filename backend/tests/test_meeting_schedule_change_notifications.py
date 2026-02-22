import unittest
import uuid
from datetime import datetime, time, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.api.meeting_schedules import (
    _build_schedule_change_message_html,
    _extract_unique_notification_targets,
    _has_schedule_notification_changes,
    _notify_schedule_change,
)


class MeetingScheduleChangeNotificationTests(unittest.TestCase):
    def test_extract_unique_notification_targets_deduplicates_values(self) -> None:
        targets = _extract_unique_notification_targets(
            [
                {"chat_id": "100", "thread_id": None},
                {"chat_id": 100, "thread_id": None},
                {"chat_id": "100", "thread_id": "12"},
                {"chat_id": "bad", "thread_id": None},
                {"chat_id": "", "thread_id": None},
            ]
        )

        self.assertEqual(targets, [(100, None), (100, 12)])

    def test_build_message_for_deleted_schedule_includes_previous_time_and_mentions(self) -> None:
        previous_snapshot = {
            "title": "Еженедельная планерка",
            "next_occurrence_skip": False,
            "next_occurrence_time_override": None,
            "next_occurrence_dt": datetime(2026, 3, 2, 12, 0),
            "participant_ids": [],
            "telegram_targets": [],
        }

        message = _build_schedule_change_message_html(
            previous_snapshot=previous_snapshot,
            schedule=None,
            deleted=True,
            participants_mentions="@alice @bob",
        )

        self.assertIn("Расписание удалено", message)
        self.assertIn("Было:", message)
        self.assertIn("Участники: @alice @bob", message)

    def test_build_message_for_reschedule_marks_transfer(self) -> None:
        now = datetime.utcnow()
        previous_snapshot = {
            "title": "Планерка",
            "next_occurrence_skip": False,
            "next_occurrence_time_override": None,
            "next_occurrence_dt": now + timedelta(days=1),
            "participant_ids": [],
            "telegram_targets": [],
        }
        schedule = SimpleNamespace(
            title="Планерка",
            recurrence="on_demand",
            next_occurrence_at=now + timedelta(days=2),
            next_occurrence_skip=False,
            next_occurrence_time_override=None,
            time_utc=time(12, 0),
        )

        message = _build_schedule_change_message_html(
            previous_snapshot=previous_snapshot,
            schedule=schedule,
            deleted=False,
            participants_mentions="",
        )

        self.assertIn("Ближайшая встреча перенесена", message)
        self.assertIn("Стало:", message)

    def test_build_message_has_blank_lines_between_sections(self) -> None:
        now = datetime.utcnow()
        previous_snapshot = {
            "title": "Тест",
            "next_occurrence_skip": False,
            "next_occurrence_time_override": None,
            "next_occurrence_dt": now + timedelta(days=1),
            "participant_ids": [],
            "telegram_targets": [],
        }
        schedule = SimpleNamespace(
            title="Тест",
            recurrence="on_demand",
            next_occurrence_at=now + timedelta(days=2),
            next_occurrence_skip=False,
            next_occurrence_time_override=None,
            time_utc=time(12, 0),
        )

        message = _build_schedule_change_message_html(
            previous_snapshot=previous_snapshot,
            schedule=schedule,
            deleted=False,
            participants_mentions="@alice @bob",
        )

        self.assertIn("Внимание! ⚠️\n\nПо встрече", message)
        self.assertIn("перенесена.\n\nБыло:", message)
        self.assertIn("</b>\n\nУчастники: @alice @bob", message)

    def test_has_schedule_notification_changes_returns_false_for_identical_snapshot(self) -> None:
        next_occurrence = datetime(2026, 3, 2, 12, 0)
        participant_id = uuid.uuid4()
        previous_snapshot = {
            "title": "Планерка",
            "next_occurrence_skip": False,
            "next_occurrence_time_override": None,
            "next_occurrence_dt": next_occurrence,
            "participant_ids": [participant_id],
            "telegram_targets": [{"chat_id": "100", "thread_id": None}],
        }
        schedule = SimpleNamespace(
            title="Планерка",
            participant_ids=[participant_id],
            telegram_targets=[{"chat_id": 100, "thread_id": None}],
            next_occurrence_skip=False,
            next_occurrence_time_override=None,
            recurrence="on_demand",
            next_occurrence_at=next_occurrence,
            day_of_week=1,
            time_utc=time(12, 0),
        )

        self.assertFalse(_has_schedule_notification_changes(previous_snapshot, schedule))

    def test_has_schedule_notification_changes_detects_next_occurrence_update(self) -> None:
        previous_snapshot = {
            "title": "Планерка",
            "next_occurrence_skip": False,
            "next_occurrence_time_override": None,
            "next_occurrence_dt": datetime(2026, 3, 2, 12, 0),
            "participant_ids": [],
            "telegram_targets": [],
        }
        schedule = SimpleNamespace(
            title="Планерка",
            participant_ids=[],
            telegram_targets=[],
            next_occurrence_skip=False,
            next_occurrence_time_override=None,
            recurrence="on_demand",
            next_occurrence_at=datetime(2026, 3, 3, 12, 0),
            day_of_week=2,
            time_utc=time(12, 0),
        )

        self.assertTrue(_has_schedule_notification_changes(previous_snapshot, schedule))


class NotifyScheduleChangeTests(unittest.IsolatedAsyncioTestCase):
    async def test_notify_schedule_change_sends_message_to_unique_targets(self) -> None:
        bot = SimpleNamespace(send_message=AsyncMock())
        request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(bot=bot)))
        session = SimpleNamespace()

        previous_snapshot = {
            "title": "Планерка",
            "next_occurrence_skip": False,
            "next_occurrence_time_override": None,
            "next_occurrence_dt": datetime(2026, 3, 2, 12, 0),
            "participant_ids": [uuid.uuid4()],
            "telegram_targets": [
                {"chat_id": "100", "thread_id": None},
                {"chat_id": "100", "thread_id": None},
                {"chat_id": "100", "thread_id": 10},
                {"chat_id": "bad", "thread_id": None},
            ],
        }

        with patch(
            "app.api.meeting_schedules._build_participants_mentions",
            AsyncMock(return_value="@alice"),
        ):
            await _notify_schedule_change(
                request,
                session,
                previous_snapshot=previous_snapshot,
                schedule=None,
                deleted=True,
            )

        self.assertEqual(bot.send_message.await_count, 2)
        first_call = bot.send_message.await_args_list[0].kwargs
        second_call = bot.send_message.await_args_list[1].kwargs

        self.assertEqual(first_call["chat_id"], 100)
        self.assertEqual(first_call["parse_mode"], "HTML")
        self.assertIn("Участники: @alice", first_call["text"])
        self.assertNotIn("message_thread_id", first_call)
        self.assertEqual(second_call["message_thread_id"], 10)
