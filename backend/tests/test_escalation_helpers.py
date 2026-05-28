import unittest
import uuid
from datetime import date
from types import SimpleNamespace

from app.bot.handlers.escalation import (
    build_escalation_dm_text,
    parse_escalation_callback,
)
from app.services.notification_service import (
    build_counterpart_message,
    resolve_counterpart_telegram_id,
)


def _member(
    *, full_name: str = "Иван Иванов",
    username: str | None = "ivan",
    telegram_id: int | None = 100,
) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        full_name=full_name,
        telegram_username=username,
        telegram_id=telegram_id,
    )


def _task(*, assignee=None, created_by=None, short_id: int = 42,
          title: str = "Подготовить отчёт") -> SimpleNamespace:
    return SimpleNamespace(
        short_id=short_id,
        title=title,
        deadline=date(2026, 5, 1),
        assignee=assignee,
        created_by=created_by,
        assignee_id=getattr(assignee, "id", None),
        created_by_id=getattr(created_by, "id", None),
    )


class ParseEscalationCallbackTests(unittest.TestCase):
    def test_parse_complete(self) -> None:
        self.assertEqual(
            parse_escalation_callback("esc:complete:42"),
            ("complete", 42, None),
        )

    def test_parse_cancel(self) -> None:
        self.assertEqual(
            parse_escalation_callback("esc:cancel:42"),
            ("cancel", 42, None),
        )

    def test_parse_extend(self) -> None:
        self.assertEqual(
            parse_escalation_callback("esc:extend:7"),
            ("extend", 7, None),
        )

    def test_parse_back(self) -> None:
        self.assertEqual(
            parse_escalation_callback("esc:back:42"),
            ("back", 42, None),
        )

    def test_parse_extdays(self) -> None:
        self.assertEqual(
            parse_escalation_callback("esc:extdays:42:14"),
            ("extdays", 42, 14),
        )

    def test_parse_reason(self) -> None:
        self.assertEqual(
            parse_escalation_callback("esc:reason:42:obsolete"),
            ("reason", 42, "obsolete"),
        )

    def test_parse_reason_other(self) -> None:
        self.assertEqual(
            parse_escalation_callback("esc:reason:7:other"),
            ("reason", 7, "other"),
        )

    def test_parse_wrong_prefix_raises(self) -> None:
        with self.assertRaises(ValueError):
            parse_escalation_callback("foo:complete:42")

    def test_parse_unknown_action_raises(self) -> None:
        with self.assertRaises(ValueError):
            parse_escalation_callback("esc:explode:42")

    def test_parse_non_integer_short_id_raises(self) -> None:
        with self.assertRaises(ValueError):
            parse_escalation_callback("esc:complete:abc")

    def test_parse_extdays_bad_days_raises(self) -> None:
        with self.assertRaises(ValueError):
            parse_escalation_callback("esc:extdays:42:notanumber")

    def test_parse_extdays_missing_days_raises(self) -> None:
        with self.assertRaises(ValueError):
            parse_escalation_callback("esc:extdays:42")

    def test_parse_empty_raises(self) -> None:
        with self.assertRaises(ValueError):
            parse_escalation_callback("")


class BuildEscalationDmTextTests(unittest.TestCase):
    def test_first_time_text_contains_core_fields(self) -> None:
        task = _task(short_id=42, title="Подготовить отчёт")
        text = build_escalation_dm_text(task, days_overdue=30, is_repeat=False)
        self.assertIn("#42", text)
        self.assertIn("Подготовить отчёт", text)
        self.assertIn("01.05.2026", text)
        self.assertIn("30", text)

    def test_first_time_intro_mentions_day_count(self) -> None:
        task = _task()
        text = build_escalation_dm_text(task, days_overdue=30, is_repeat=False)
        # First-time intro should mention the number of days the task is overdue.
        self.assertIn("30 дней", text)
        self.assertNotIn("ещё неделя", text)

    def test_repeat_intro_differs_from_first_time(self) -> None:
        task = _task()
        first = build_escalation_dm_text(task, days_overdue=40, is_repeat=False)
        repeat = build_escalation_dm_text(task, days_overdue=40, is_repeat=True)
        self.assertNotEqual(first, repeat)
        self.assertIn("неделя", repeat.lower())

    def test_handles_missing_deadline(self) -> None:
        task = _task()
        task.deadline = None
        text = build_escalation_dm_text(task, days_overdue=30, is_repeat=False)
        self.assertIn("#42", text)


class ResolveCounterpartTelegramIdTests(unittest.TestCase):
    def test_assignee_acts_returns_author_tg_id(self) -> None:
        author = _member(full_name="Автор", telegram_id=111)
        assignee = _member(full_name="Исполнитель", telegram_id=222)
        task = _task(assignee=assignee, created_by=author)
        self.assertEqual(resolve_counterpart_telegram_id(task, assignee), 111)

    def test_author_acts_returns_assignee_tg_id(self) -> None:
        author = _member(full_name="Автор", telegram_id=111)
        assignee = _member(full_name="Исполнитель", telegram_id=222)
        task = _task(assignee=assignee, created_by=author)
        self.assertEqual(resolve_counterpart_telegram_id(task, author), 222)

    def test_no_counterpart_returns_none(self) -> None:
        author = _member(full_name="Автор", telegram_id=111)
        task = _task(assignee=None, created_by=author)
        self.assertIsNone(resolve_counterpart_telegram_id(task, author))

    def test_counterpart_is_actor_returns_none(self) -> None:
        # Same person is both author and assignee.
        person = _member(full_name="Соло", telegram_id=111)
        task = _task(assignee=person, created_by=person)
        self.assertIsNone(resolve_counterpart_telegram_id(task, person))

    def test_counterpart_without_tg_id_returns_none(self) -> None:
        author = _member(full_name="Автор", telegram_id=None)
        assignee = _member(full_name="Исполнитель", telegram_id=222)
        task = _task(assignee=assignee, created_by=author)
        self.assertIsNone(resolve_counterpart_telegram_id(task, assignee))

    def test_actor_matches_by_id_not_identity(self) -> None:
        # Actor instance differs but shares the assignee_id -> treated as assignee.
        assignee = _member(full_name="Исполнитель", telegram_id=222)
        author = _member(full_name="Автор", telegram_id=111)
        task = _task(assignee=assignee, created_by=author)
        actor_copy = SimpleNamespace(
            id=assignee.id, full_name="Исполнитель", telegram_username="x", telegram_id=222
        )
        self.assertEqual(resolve_counterpart_telegram_id(task, actor_copy), 111)


class BuildCounterpartMessageTests(unittest.TestCase):
    def test_completed_message(self) -> None:
        actor = _member(full_name="Иван Иванов")
        task = _task(short_id=42, title="Подготовить отчёт")
        text = build_counterpart_message(actor, "completed", task)
        self.assertIn("#42", text)
        self.assertIn("Подготовить отчёт", text)
        self.assertIn("заверш", text.lower())
        self.assertIn("Иван Иванов", text)

    def test_cancelled_message(self) -> None:
        actor = _member(full_name="Иван Иванов")
        task = _task()
        text = build_counterpart_message(actor, "cancelled", task)
        self.assertIn("отмен", text.lower())

    def test_extended_message(self) -> None:
        actor = _member(full_name="Иван Иванов")
        task = _task()
        text = build_counterpart_message(actor, "extended", task)
        self.assertIn("продл", text.lower())

    def test_unknown_action_raises(self) -> None:
        actor = _member()
        task = _task()
        with self.assertRaises(KeyError):
            build_counterpart_message(actor, "exploded", task)


if __name__ == "__main__":
    unittest.main()
