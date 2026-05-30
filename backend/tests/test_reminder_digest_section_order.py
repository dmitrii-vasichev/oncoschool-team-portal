import unittest
import uuid
from datetime import date, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

from app.services.reminder_service import (
    ReminderService,
    build_overdue_tasks_report_keyboard,
    build_overdue_tasks_report_text,
    normalize_digest_sections_order,
    normalize_upcoming_days,
)


def _empty_result_session() -> AsyncMock:
    """A mocked session whose execute() yields empty results.

    Several digest queries run via ``session.execute``: the close-candidates
    section (Task 14, ``scalars().all()``), and the personal Pulse block
    (Task 15) -- ``scalars().all()`` for "what changed" events plus a
    ``scalar()`` count for the weekly recap. These formatting-only unit tests
    have no DB rows for the stand-in member, so every query must come back
    empty (no rows, count 0).
    """
    session = AsyncMock()
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    result.scalar.return_value = 0
    session.execute.return_value = result
    return session


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
            session=_empty_result_session(),
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
        self.assertNotIn("был ", sent_text)
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
            session=_empty_result_session(),
            member=member,
            rs=reminder_settings,
            today=today,
        )

        self.assertEqual(service._send_safe.await_count, 1)
        sent_text = service._send_safe.await_args.args[1]
        self.assertIn("Подготовить презентацию", sent_text)
        self.assertIn("Срочно", sent_text)
        self.assertNotIn("⚡ urgent", sent_text)
        self.assertIn("📅 27.02", sent_text)
        self.assertNotIn("#305", sent_text)

        title_idx = sent_text.find("Подготовить презентацию")
        priority_idx = sent_text.find("Срочно")
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
            session=_empty_result_session(),
            member=member,
            rs=reminder_settings,
            today=today,
        )

        self.assertEqual(service._send_safe.await_count, 1)
        sent_text = service._send_safe.await_args.args[1]
        sent_kwargs = service._send_safe.await_args.kwargs
        self.assertIn(
            "#777 · Проверить &lt;b&gt;контракт&lt;/b&gt; &amp; согласовать · 📅 26.02 · Срочно",
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
            session=_empty_result_session(),
            member=member,
            rs=reminder_settings,
            today=today,
        )

        self.assertEqual(service._send_safe.await_count, 1)
        sent_text = service._send_safe.await_args.args[1]
        self.assertIn("⏰ Дедлайны сегодня (1)", sent_text)
        self.assertIn("#410", sent_text)
        self.assertIn("📅 26.02", sent_text)
        self.assertIn("Срочно", sent_text)
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
            session=_empty_result_session(),
            member=member,
            rs=reminder_settings,
            today=today,
        )

        self.assertEqual(service._send_safe.await_count, 1)
        sent_text = service._send_safe.await_args.args[1]
        self.assertIn("Только заголовок и дедлайн", sent_text)
        self.assertIn("📅 26.02", sent_text)
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
            session=_empty_result_session(),
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


class OverdueTasksReportFormatTests(unittest.TestCase):
    def test_build_overdue_tasks_report_text_groups_by_age_and_assignee(self) -> None:
        today = date(2026, 5, 15)
        push_title = "Сделать пуш для возврата участников эфира"
        summary_title = (
            "Собрать сводную таблицу по теплому трафику"
        )
        tasks = [
            SimpleNamespace(
                short_id=234,
                title=push_title,
                deadline=today - timedelta(days=6),
                assignee=SimpleNamespace(full_name="Елена Полищук"),
            ),
            SimpleNamespace(
                short_id=219,
                title="Провести созвон с переводчиком на БНЗТ",
                deadline=today - timedelta(days=3),
                assignee=SimpleNamespace(full_name="Оксана Гончарук"),
            ),
            SimpleNamespace(
                short_id=220,
                title="Прохождение воронок с учетом обновлений",
                deadline=today - timedelta(days=2),
                assignee=SimpleNamespace(full_name="Андрей Поспелов"),
            ),
            SimpleNamespace(
                short_id=43,
                title=summary_title,
                deadline=today - timedelta(days=79),
                assignee=SimpleNamespace(full_name="Дарья Плешкова"),
            ),
            SimpleNamespace(
                short_id=232,
                title="Сделать новый тренинг для НКО на ГК по ТЗ",
                deadline=today - timedelta(days=1),
                assignee=SimpleNamespace(full_name="Елена Полищук"),
            ),
            SimpleNamespace(
                short_id=207,
                title="Записи вебинара на 24 часа",
                deadline=today - timedelta(days=10),
                assignee=SimpleNamespace(full_name="Елена Полищук"),
            ),
        ]

        report = build_overdue_tasks_report_text(tasks, today=today)

        self.assertIn("⏰ Просроченные задачи: 6", report)
        self.assertIn("По давности:", report)
        self.assertIn("🔴 Больше 7 дней: 2", report)
        self.assertIn("🟠 3-7 дней: 2", report)
        self.assertIn("🟡 1-2 дня: 2", report)
        self.assertIn("По ответственным:", report)
        self.assertLess(
            report.find("👤 Елена Полищук — 3"),
            report.find("👤 Андрей Поспелов — 1"),
        )
        self.assertIn("Давно просрочены:", report)
        self.assertLess(
            report.find(
                "1. Собрать сводную таблицу по теплому трафику"
            ),
            report.find("2. Записи вебинара на 24 часа"),
        )
        self.assertIn("📅 25.02 · просрочено на 79 дней", report)
        self.assertIn("📅 05.05 · просрочено на 10 дней", report)
        self.assertNotIn("#43", report)
        self.assertNotIn("#207", report)
        self.assertNotIn("#234", report)

    def test_build_overdue_tasks_report_text_limits_long_sections(self) -> None:
        today = date(2026, 5, 15)
        tasks = [
            SimpleNamespace(
                short_id=index,
                title=f"Задача {index}",
                deadline=today - timedelta(days=index),
                assignee=SimpleNamespace(full_name=f"Участник {index}"),
            )
            for index in range(1, 9)
        ]

        report = build_overdue_tasks_report_text(tasks, today=today)

        self.assertIn("... и ещё 3 исполнителя", report)
        self.assertIn("Показаны 5 самых давних из 8.", report)
        self.assertIn("1. Задача 8", report)
        self.assertIn("5. Задача 4", report)
        self.assertNotIn("6. Задача 3", report)

    def test_build_overdue_tasks_report_keyboard_opens_team_overdue_list(self) -> None:
        keyboard = build_overdue_tasks_report_keyboard()

        self.assertEqual(
            keyboard.inline_keyboard[0][0].text,
            "📋 Показать все просроченные",
        )
        self.assertIn("team", keyboard.inline_keyboard[0][0].callback_data)
        self.assertIn("overdue", keyboard.inline_keyboard[0][0].callback_data)


if __name__ == "__main__":
    unittest.main()
