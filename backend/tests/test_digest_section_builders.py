"""Pure unit tests for daily-digest section builders (Tasks 14 & 15).

These exercise the text builders without touching the DB. Tasks/members are
constructed with SimpleNamespace, mirroring tests/test_group_task_mentions.py.
"""

import uuid
import unittest
from datetime import date, timedelta
from types import SimpleNamespace

from app.services.reminder_service import (
    build_close_candidates_section,
    build_moderator_escalation_block,
)


def _task(
    *,
    short_id: int,
    title: str,
    deadline: date,
    assignee_name: str | None = None,
) -> SimpleNamespace:
    assignee = (
        SimpleNamespace(full_name=assignee_name) if assignee_name is not None else None
    )
    return SimpleNamespace(
        id=uuid.uuid4(),
        short_id=short_id,
        title=title,
        deadline=deadline,
        assignee=assignee,
    )


class CloseCandidatesSectionTests(unittest.TestCase):
    def test_empty_returns_none(self) -> None:
        self.assertIsNone(build_close_candidates_section([], date(2026, 5, 27)))

    def test_section_header_and_hint(self) -> None:
        today = date(2026, 5, 27)
        tasks = [_task(short_id=12, title="Сделать отчёт", deadline=today - timedelta(days=20))]
        section = build_close_candidates_section(tasks, today)
        assert section is not None
        self.assertIn("Кандидаты на закрытие", section)
        self.assertIn("≥14 дней", section)
        self.assertIn("Проверь", section)

    def test_task_line_short_id_title_and_day_count(self) -> None:
        today = date(2026, 5, 27)
        tasks = [_task(short_id=42, title="Релиз API", deadline=today - timedelta(days=15))]
        section = build_close_candidates_section(tasks, today)
        assert section is not None
        self.assertIn("#42", section)
        self.assertIn("Релиз API", section)
        # 15 -> "дней" (pluralization)
        self.assertIn("15 дней", section)

    def test_russian_pluralization(self) -> None:
        today = date(2026, 5, 27)
        # 21 days -> "21 день", 22 -> "22 дня", 25 -> "25 дней"
        tasks = [
            _task(short_id=1, title="a", deadline=today - timedelta(days=21)),
            _task(short_id=2, title="b", deadline=today - timedelta(days=22)),
            _task(short_id=3, title="c", deadline=today - timedelta(days=25)),
        ]
        section = build_close_candidates_section(tasks, today)
        assert section is not None
        self.assertIn("21 день", section)
        self.assertIn("22 дня", section)
        self.assertIn("25 дней", section)

    def test_html_escapes_title(self) -> None:
        today = date(2026, 5, 27)
        tasks = [
            _task(
                short_id=7,
                title="<b>bold</b> & <i>",
                deadline=today - timedelta(days=18),
            )
        ]
        section = build_close_candidates_section(tasks, today)
        assert section is not None
        self.assertIn("&lt;b&gt;bold&lt;/b&gt; &amp; &lt;i&gt;", section)
        self.assertNotIn("<b>bold</b>", section)


class ModeratorEscalationBlockTests(unittest.TestCase):
    def test_both_empty_returns_none(self) -> None:
        self.assertIsNone(build_moderator_escalation_block([], [], date(2026, 5, 27)))

    def test_only_stuck(self) -> None:
        today = date(2026, 5, 27)
        stuck = [
            _task(
                short_id=100,
                title="Stuck task",
                deadline=today - timedelta(days=35),
                assignee_name="Иван Иванов",
            )
        ]
        block = build_moderator_escalation_block(stuck, [], today)
        assert block is not None
        self.assertIn("Контроль", block)
        self.assertIn("≥30 дней без реакции", block)
        self.assertIn("#100", block)
        self.assertIn("Иван Иванов", block)
        self.assertIn("35 дней", block)
        self.assertNotIn("Авто-отменено", block)

    def test_only_autocancelled(self) -> None:
        today = date(2026, 5, 27)
        auto = [
            _task(
                short_id=200,
                title="Old & dead",
                deadline=today - timedelta(days=70),
            )
        ]
        block = build_moderator_escalation_block([], auto, today)
        assert block is not None
        self.assertIn("Контроль", block)
        self.assertIn("Авто-отменено за сегодня", block)
        self.assertIn("#200", block)
        self.assertIn("Old &amp; dead", block)
        self.assertNotIn("≥30 дней без реакции", block)

    def test_both_present(self) -> None:
        today = date(2026, 5, 27)
        stuck = [
            _task(
                short_id=1,
                title="s",
                deadline=today - timedelta(days=40),
                assignee_name="Петр Петров",
            )
        ]
        auto = [_task(short_id=2, title="a", deadline=today - timedelta(days=65))]
        block = build_moderator_escalation_block(stuck, auto, today)
        assert block is not None
        self.assertIn("≥30 дней без реакции", block)
        self.assertIn("Авто-отменено за сегодня", block)
        self.assertIn("#1", block)
        self.assertIn("#2", block)

    def test_stuck_handles_missing_assignee(self) -> None:
        today = date(2026, 5, 27)
        stuck = [
            _task(short_id=5, title="no assignee", deadline=today - timedelta(days=33))
        ]
        block = build_moderator_escalation_block(stuck, [], today)
        assert block is not None
        # _task_assignee_name returns "Не назначен" when assignee is None.
        self.assertIn("Не назначен", block)


if __name__ == "__main__":
    unittest.main()
