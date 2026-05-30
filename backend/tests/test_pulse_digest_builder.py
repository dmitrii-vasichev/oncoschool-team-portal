"""Pure unit tests for the company Pulse digest builder.

No DB, no async, no aiogram: transient ``ActivityEvent`` objects are built in
memory and passed straight to ``build_company_digest``.
"""

from app.db.models import ActivityEvent
from app.services.pulse_digest import build_company_digest


def _ev(t, payload):
    return ActivityEvent(
        event_type=t,
        visibility=("company" if t == "task_completed" else "department"),
        payload=payload,
    )


def test_empty_returns_none():
    assert build_company_digest([], "Europe/Moscow") is None


def test_completion_is_redacted():
    out = build_company_digest(
        [
            _ev(
                "task_completed",
                {
                    "actor_name": "Anna",
                    "department_name": "Mkt",
                    "task_title": "Secret",
                    "task_short_id": 9,
                },
            )
        ],
        "Europe/Moscow",
    )
    assert out is not None
    assert "Anna" in out
    assert "Mkt" in out
    # Task title and short_id must NOT leak into the company-wide digest.
    assert "Secret" not in out
    assert "#9" not in out


def test_only_progress_returns_none():
    out = build_company_digest(
        [_ev("progress_update", {"actor_name": "Bob", "progress_percent": 50, "task_title": "X"})],
        "Europe/Moscow",
    )
    assert out is None


def test_blocker_section_redacted():
    out = build_company_digest(
        [
            _ev(
                "blocker_raised",
                {
                    "actor_name": "Igor",
                    "department_name": "Sales",
                    "task_title": "T",
                    "blocker_text": "need access",
                },
            )
        ],
        "Europe/Moscow",
    )
    assert out is not None
    assert "Igor" in out
    assert "Sales" in out
    assert "need access" not in out
    assert "T" not in out  # task title must not leak
    assert "Блокер" in out  # section present


def test_mixed_completion_and_blocker():
    out = build_company_digest(
        [
            _ev(
                "task_completed",
                {"actor_name": "Anna", "department_name": "Mkt", "task_title": "Q3 report"},
            ),
            _ev(
                "task_completed",
                {"actor_name": "Boris", "department_name": "Dev", "task_title": "Fix bug"},
            ),
            _ev(
                "blocker_raised",
                {"actor_name": "Igor", "department_name": "Sales", "blocker_text": "no access"},
            ),
        ],
        "Europe/Moscow",
    )
    assert out is not None
    # Header + counts.
    assert "Пульс команды" in out
    assert "закрыто 2" in out
    assert "блокеров 1" in out
    # Sections.
    assert "Закрыто" in out
    assert "Блокеры" in out
    # Redaction: no titles leak.
    assert "Q3 report" not in out
    assert "Fix bug" not in out
    assert "no access" not in out
    # Actors + departments shown.
    assert "Anna (Mkt)" in out
    assert "Boris (Dev)" in out
    assert "Igor (Sales)" in out


def test_completion_without_department():
    out = build_company_digest(
        [_ev("task_completed", {"actor_name": "Solo", "task_title": "X"})],
        "Europe/Moscow",
    )
    assert out is not None
    assert "• Solo" in out
    # No empty parentheses when department is missing.
    assert "()" not in out


def test_actor_name_is_html_escaped():
    out = build_company_digest(
        [_ev("task_completed", {"actor_name": "A<b>x</b>", "department_name": "D&D"})],
        "Europe/Moscow",
    )
    assert out is not None
    # Raw user-supplied markup must be escaped so it cannot break the HTML message.
    assert "A<b>x</b>" not in out
    assert "A&lt;b&gt;x&lt;/b&gt;" in out
    assert "D&amp;D" in out
