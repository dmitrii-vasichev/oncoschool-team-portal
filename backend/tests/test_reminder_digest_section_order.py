import unittest
import uuid
from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

from app.services.reminder_service import (
    ReminderService,
    normalize_digest_sections_order,
    normalize_upcoming_days,
)


class ReminderDigestSectionOrderTests(unittest.IsolatedAsyncioTestCase):
    def test_normalize_digest_sections_order_defaults(self) -> None:
        self.assertEqual(
            normalize_digest_sections_order(None),
            ["overdue", "upcoming", "in_progress", "new"],
        )

    def test_normalize_digest_sections_order_filters_and_completes(self) -> None:
        self.assertEqual(
            normalize_digest_sections_order(["new", "invalid", "new", "overdue"]),
            ["new", "overdue", "upcoming", "in_progress"],
        )

    def test_normalize_upcoming_days_clamps_range(self) -> None:
        self.assertEqual(normalize_upcoming_days(None), 3)
        self.assertEqual(normalize_upcoming_days(-2), 0)
        self.assertEqual(normalize_upcoming_days(99), 7)
        self.assertEqual(normalize_upcoming_days("5"), 5)

    async def test_send_daily_digest_uses_configured_section_order(self) -> None:
        service = ReminderService(bot=AsyncMock(), session_maker=AsyncMock())
        service.task_repo = SimpleNamespace(get_by_assignee=AsyncMock())
        service._send_safe = AsyncMock()

        today = date(2026, 2, 26)
        tasks = [
            SimpleNamespace(
                short_id=101,
                title="Просроченная",
                priority="high",
                status="in_progress",
                deadline=today - timedelta(days=1),
                completed_at=None,
            ),
            SimpleNamespace(
                short_id=102,
                title="Срочная новая",
                priority="medium",
                status="new",
                deadline=today + timedelta(days=1),
                completed_at=None,
            ),
            SimpleNamespace(
                short_id=103,
                title="Новая без дедлайна",
                priority="low",
                status="new",
                deadline=None,
                completed_at=None,
            ),
            SimpleNamespace(
                short_id=104,
                title="В работе",
                priority="urgent",
                status="in_progress",
                deadline=None,
                completed_at=None,
            ),
        ]
        service.task_repo.get_by_assignee.return_value = tasks

        member = SimpleNamespace(id=uuid.uuid4(), telegram_id=123456)
        reminder_settings = SimpleNamespace(
            include_overdue=True,
            include_upcoming=True,
            include_in_progress=True,
            include_new=True,
            digest_sections_order=["new", "in_progress", "upcoming", "overdue"],
        )

        await service._send_daily_digest(
            session=AsyncMock(),
            member=member,
            rs=reminder_settings,
            today=today,
        )

        self.assertEqual(service._send_safe.await_count, 1)
        sent_text = service._send_safe.await_args.args[1]
        sent_kwargs = service._send_safe.await_args.kwargs

        new_idx = sent_text.find("🆕 Новые")
        in_progress_idx = sent_text.find("🔄 В работе")
        upcoming_idx = sent_text.find("📅 Ближайшие")
        overdue_idx = sent_text.find("🔴 Просроченные")

        self.assertGreaterEqual(new_idx, 0)
        self.assertGreaterEqual(in_progress_idx, 0)
        self.assertGreaterEqual(upcoming_idx, 0)
        self.assertGreaterEqual(overdue_idx, 0)
        self.assertLess(new_idx, in_progress_idx)
        self.assertLess(in_progress_idx, upcoming_idx)
        self.assertLess(upcoming_idx, overdue_idx)
        self.assertEqual(sent_kwargs.get("parse_mode"), "HTML")

    async def test_send_daily_digest_applies_task_line_format(self) -> None:
        service = ReminderService(bot=AsyncMock(), session_maker=AsyncMock())
        service.task_repo = SimpleNamespace(get_by_assignee=AsyncMock())
        service._send_safe = AsyncMock()

        today = date(2026, 2, 26)
        tasks = [
            SimpleNamespace(
                short_id=305,
                title="Подготовить презентацию",
                priority="urgent",
                status="new",
                deadline=today + timedelta(days=1),
                completed_at=None,
            ),
        ]
        service.task_repo.get_by_assignee.return_value = tasks

        member = SimpleNamespace(id=uuid.uuid4(), telegram_id=123456)
        reminder_settings = SimpleNamespace(
            include_overdue=False,
            include_upcoming=True,
            include_in_progress=False,
            include_new=True,
            digest_sections_order=["upcoming", "new", "in_progress", "overdue"],
            task_line_show_number=False,
            task_line_show_title=True,
            task_line_show_deadline=True,
            task_line_show_priority=True,
            task_line_fields_order=["title", "priority", "deadline", "number"],
        )

        await service._send_daily_digest(
            session=AsyncMock(),
            member=member,
            rs=reminder_settings,
            today=today,
        )

        self.assertEqual(service._send_safe.await_count, 1)
        sent_text = service._send_safe.await_args.args[1]
        self.assertIn("Подготовить презентацию", sent_text)
        self.assertIn("⚡ urgent", sent_text)
        self.assertIn("📅 27.02", sent_text)
        self.assertNotIn("#305", sent_text)

        title_idx = sent_text.find("Подготовить презентацию")
        priority_idx = sent_text.find("⚡ urgent")
        deadline_idx = sent_text.find("📅 27.02")
        self.assertLess(title_idx, priority_idx)
        self.assertLess(priority_idx, deadline_idx)

    async def test_send_daily_digest_escapes_html_sensitive_task_text(self) -> None:
        service = ReminderService(bot=AsyncMock(), session_maker=AsyncMock())
        service.task_repo = SimpleNamespace(get_by_assignee=AsyncMock())
        service._send_safe = AsyncMock()

        today = date(2026, 2, 26)
        tasks = [
            SimpleNamespace(
                short_id=777,
                title="Проверить <b>контракт</b> & согласовать",
                priority="high",
                status="new",
                deadline=today,
                completed_at=None,
            ),
        ]
        service.task_repo.get_by_assignee.return_value = tasks

        member = SimpleNamespace(id=uuid.uuid4(), telegram_id=123456)
        reminder_settings = SimpleNamespace(
            include_overdue=False,
            include_upcoming=True,
            include_in_progress=False,
            include_new=False,
            upcoming_days=0,
            digest_sections_order=["upcoming", "overdue", "in_progress", "new"],
            task_line_show_number=True,
            task_line_show_title=True,
            task_line_show_deadline=True,
            task_line_show_priority=True,
            task_line_fields_order=["number", "title", "deadline", "priority"],
        )

        await service._send_daily_digest(
            session=AsyncMock(),
            member=member,
            rs=reminder_settings,
            today=today,
        )

        self.assertEqual(service._send_safe.await_count, 1)
        sent_text = service._send_safe.await_args.args[1]
        sent_kwargs = service._send_safe.await_args.kwargs
        self.assertIn(
            "#777 · Проверить &lt;b&gt;контракт&lt;/b&gt; &amp; согласовать · 🗓 26.02 · ⚡ high",
            sent_text,
        )
        self.assertEqual(sent_kwargs.get("parse_mode"), "HTML")

    async def test_send_daily_digest_upcoming_zero_uses_today_label(self) -> None:
        service = ReminderService(bot=AsyncMock(), session_maker=AsyncMock())
        service.task_repo = SimpleNamespace(get_by_assignee=AsyncMock())
        service._send_safe = AsyncMock()

        today = date(2026, 2, 26)
        tasks = [
            SimpleNamespace(
                short_id=410,
                title="Сдать документы",
                priority="high",
                status="new",
                deadline=today,
                completed_at=None,
            ),
        ]
        service.task_repo.get_by_assignee.return_value = tasks

        member = SimpleNamespace(id=uuid.uuid4(), telegram_id=123456)
        reminder_settings = SimpleNamespace(
            include_overdue=False,
            include_upcoming=True,
            include_in_progress=False,
            include_new=False,
            upcoming_days=0,
            digest_sections_order=["upcoming", "overdue", "in_progress", "new"],
            task_line_show_number=True,
            task_line_show_title=True,
            task_line_show_deadline=True,
            task_line_show_priority=True,
            task_line_fields_order=["number", "title", "deadline", "priority"],
        )

        await service._send_daily_digest(
            session=AsyncMock(),
            member=member,
            rs=reminder_settings,
            today=today,
        )

        self.assertEqual(service._send_safe.await_count, 1)
        sent_text = service._send_safe.await_args.args[1]
        self.assertIn("⏰ Дедлайны сегодня (1)", sent_text)
        self.assertIn("#410", sent_text)
        self.assertIn("🗓 26.02", sent_text)
        self.assertIn("⚡ high", sent_text)
        self.assertNotIn("Ближайшие по дедлайну", sent_text)

    async def test_send_daily_digest_today_respects_field_flags_and_order(self) -> None:
        service = ReminderService(bot=AsyncMock(), session_maker=AsyncMock())
        service.task_repo = SimpleNamespace(get_by_assignee=AsyncMock())
        service._send_safe = AsyncMock()

        today = date(2026, 2, 26)
        tasks = [
            SimpleNamespace(
                short_id=920,
                title="Только заголовок и дедлайн",
                priority="urgent",
                status="new",
                deadline=today,
                completed_at=None,
            ),
        ]
        service.task_repo.get_by_assignee.return_value = tasks

        member = SimpleNamespace(id=uuid.uuid4(), telegram_id=123456)
        reminder_settings = SimpleNamespace(
            include_overdue=False,
            include_upcoming=True,
            include_in_progress=False,
            include_new=False,
            upcoming_days=0,
            digest_sections_order=["upcoming", "overdue", "in_progress", "new"],
            task_line_show_number=False,
            task_line_show_title=True,
            task_line_show_deadline=True,
            task_line_show_priority=False,
            task_line_fields_order=["title", "deadline", "number", "priority"],
        )

        await service._send_daily_digest(
            session=AsyncMock(),
            member=member,
            rs=reminder_settings,
            today=today,
        )

        self.assertEqual(service._send_safe.await_count, 1)
        sent_text = service._send_safe.await_args.args[1]
        self.assertIn("Только заголовок и дедлайн", sent_text)
        self.assertIn("🗓 26.02", sent_text)
        self.assertNotIn("#920", sent_text)
        self.assertNotIn("⚡ urgent", sent_text)

    async def test_send_daily_digest_does_not_duplicate_tasks_in_later_sections(self) -> None:
        service = ReminderService(bot=AsyncMock(), session_maker=AsyncMock())
        service.task_repo = SimpleNamespace(get_by_assignee=AsyncMock())
        service._send_safe = AsyncMock()

        today = date(2026, 2, 26)
        tasks = [
            SimpleNamespace(
                short_id=501,
                title="Просроченная в работе",
                priority="high",
                status="in_progress",
                deadline=today - timedelta(days=1),
                completed_at=None,
            ),
            SimpleNamespace(
                short_id=502,
                title="Новая с дедлайном",
                priority="medium",
                status="new",
                deadline=today + timedelta(days=1),
                completed_at=None,
            ),
            SimpleNamespace(
                short_id=503,
                title="Обычная в работе",
                priority="low",
                status="in_progress",
                deadline=None,
                completed_at=None,
            ),
            SimpleNamespace(
                short_id=504,
                title="Обычная новая",
                priority="urgent",
                status="new",
                deadline=None,
                completed_at=None,
            ),
        ]
        service.task_repo.get_by_assignee.return_value = tasks

        member = SimpleNamespace(id=uuid.uuid4(), telegram_id=123456)
        reminder_settings = SimpleNamespace(
            include_overdue=True,
            include_upcoming=True,
            include_in_progress=True,
            include_new=True,
            upcoming_days=3,
            digest_sections_order=["overdue", "upcoming", "in_progress", "new"],
            task_line_show_number=True,
            task_line_show_title=True,
            task_line_show_deadline=True,
            task_line_show_priority=True,
            task_line_fields_order=["number", "title", "deadline", "priority"],
        )

        await service._send_daily_digest(
            session=AsyncMock(),
            member=member,
            rs=reminder_settings,
            today=today,
        )

        self.assertEqual(service._send_safe.await_count, 1)
        sent_text = service._send_safe.await_args.args[1]

        self.assertEqual(sent_text.count("#501"), 1)
        self.assertEqual(sent_text.count("#502"), 1)
        self.assertEqual(sent_text.count("#503"), 1)
        self.assertEqual(sent_text.count("#504"), 1)


if __name__ == "__main__":
    unittest.main()
